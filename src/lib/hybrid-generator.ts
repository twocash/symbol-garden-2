/**
 * Hybrid SVG Generator - Sprouts native-quality icons from library DNA
 *
 * Core workflow:
 * 1. User has ingested an icon library (e.g., Feather, Lucide, Heroicons)
 * 2. User needs an icon concept that doesn't exist in their library
 * 3. This generator creates a NEW icon that perfectly matches the library's style
 *
 * The key insight: We use the LIBRARY ITSELF as the source of truth for style,
 * not generic rules. Every generated icon should be indistinguishable from
 * the originals in the user's chosen library.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Icon } from '../types/schema';
import { getDecomposition, Decomposition } from './decomposition-service';
import { findSimilarIcons, findExemplarIcons, findExemplarIconsWithTraits, getConceptHints, SimilarityResult } from './similar-icon-finder';
import { buildSvgPrompt, combineSvgPrompt, BuiltSvgPrompt, StyleSpec, parseStyleDNA } from './svg-prompt-builder';
import { analyzeLibrary, LibraryAnalysis, quickAnalyzeLibrary } from './library-analyzer';
import { validateSvg, ValidationResult, formatValidationResult, normalizeSvg } from './svg-validator';
import { getStructuralReference, StructuralReference } from './iconify-service';
import { enforceStyle, rulesFromStyleDNA, ComplianceResult, formatComplianceResult, EnforcementRules, FEATHER_RULES } from './style-enforcer';
import { SVGProcessor, createProfileFromRules, ProcessResult, formatProcessResult } from './svg-processor';

/**
 * Configuration for icon generation
 */
export interface GenerationConfig {
  /** The concept/name of the icon to generate */
  concept: string;

  /** Optional description for additional context */
  description?: string;

  /** The ingested icon library to match style from */
  library: Icon[];

  /** Library identifier (for caching) */
  libraryId?: string;

  /** Pre-computed library analysis (if available) */
  libraryAnalysis?: LibraryAnalysis;

  // Tuneable parameters
  /** Number of similar icons to use as few-shot examples (1-8, default: 4) */
  fewShotCount?: number;

  /** How to get decomposition: 'static' = cache only, 'dynamic' = LLM, 'auto' = try cache first */
  decompositionMode?: 'static' | 'dynamic' | 'auto';

  /** Include pattern library in prompt (default: true) */
  includePatternLibrary?: boolean;

  /** Generation temperature (0-1, default: 0.2) */
  temperature?: number;

  /** Optional API key (falls back to env var) */
  apiKey?: string;

  /** Validate coordinates and auto-fix if needed (default: true) */
  validateCoordinates?: boolean;

  /** Auto-fix out-of-bounds SVGs by scaling (default: true) */
  autoFixBounds?: boolean;

  /** Maximum retry attempts for invalid SVGs (default: 2) */
  maxRetries?: number;

  /** Style DNA / Geometric Autopsy manifest text */
  styleManifest?: string;

  /** Variant index for shuffling few-shot examples (0 = no shuffle) */
  variantIndex?: number;

  /** Allow creative interpretation instead of exact path following (for variants) */
  allowCreativeInterpretation?: boolean;

  /** P1c: Use Reference Oracle to get cross-library structural consensus (default: true) */
  useReferenceOracle?: boolean;
}

/**
 * Result of icon generation
 */
export interface GenerationResult {
  /** The generated SVG code */
  svg: string;

  /** Number of generation attempts */
  attempts: number;

  /** The decomposition used (if any) */
  decomposition: Decomposition | null;

  /** Names of icons used as few-shot examples */
  fewShotExamples: string[];

  /** Estimated tokens used */
  tokensUsed: number;

  /** Whether the decomposition came from cache or was generated */
  decompositionSource: 'static' | 'dynamic' | 'none';

  /** The prompt that was used (for debugging) */
  prompt?: BuiltSvgPrompt;

  /** Validation result for the generated SVG */
  validation?: ValidationResult;

  /** Whether the SVG was auto-fixed */
  wasFixed?: boolean;

  /** P1c: Structural reference from cross-library analysis (if used) */
  structuralReference?: StructuralReference | null;

  /** F1: Style compliance result from the Sprout Engine */
  compliance?: ComplianceResult;
}

// Cache for library analyses
const libraryAnalysisCache = new Map<string, LibraryAnalysis>();

/**
 * Get or create library analysis
 */
async function getLibraryAnalysis(
  libraryId: string,
  library: Icon[],
  apiKey?: string,
  forceRefresh: boolean = false
): Promise<LibraryAnalysis> {
  // Check cache
  if (!forceRefresh && libraryAnalysisCache.has(libraryId)) {
    return libraryAnalysisCache.get(libraryId)!;
  }

  // Quick analysis (no LLM) if no API key or for speed
  if (!apiKey) {
    const quickResult = quickAnalyzeLibrary(libraryId, library) as LibraryAnalysis;
    libraryAnalysisCache.set(libraryId, quickResult);
    return quickResult;
  }

  // Full analysis with LLM
  const fullResult = await analyzeLibrary(libraryId, library, {
    generateDecompositions: true,
    maxDecompositions: 30,
    extractStyleRules: true,
    apiKey,
  });

  libraryAnalysisCache.set(libraryId, fullResult);
  return fullResult;
}

/**
 * Extract clean SVG from LLM response
 */
function extractSvg(response: string): string {
  let svg = response.trim();

  // Remove markdown code fences
  svg = svg.replace(/```svg\n?/g, '').replace(/```\n?/g, '').trim();

  // Extract just the SVG if there's extra text
  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/);
  if (svgMatch) {
    svg = svgMatch[0];
  }

  return svg;
}

/**
 * Validate SVG structure
 */
function isValidSvg(svg: string): boolean {
  return (
    svg.startsWith('<svg') &&
    svg.endsWith('</svg>') &&
    svg.includes('viewBox') &&
    (svg.includes('<path') || svg.includes('<circle') || svg.includes('<rect') || svg.includes('<line'))
  );
}

/**
 * Generate an icon that matches the style of an ingested library
 *
 * This is the main entry point for sprouting native-quality icons.
 */
export async function generateIcon(config: GenerationConfig): Promise<GenerationResult> {
  const {
    concept,
    description,
    library,
    libraryId = 'default',
    fewShotCount = 4,
    decompositionMode = 'auto',
    includePatternLibrary = true,
    temperature = 0.2,
    apiKey,
    validateCoordinates = true,
    autoFixBounds = true,
    maxRetries = 2,
    styleManifest,
    variantIndex = 0,
    allowCreativeInterpretation = false,
    useReferenceOracle = true,  // P1c: Enable by default
  } = config;

  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    throw new Error('No API key available. Set GOOGLE_API_KEY or pass apiKey in config.');
  }

  console.log(`[HybridGenerator] Generating "${concept}" in style of ${libraryId} (${library.length} icons)`);

  // Step 1: Get or compute library analysis
  let libraryAnalysis = config.libraryAnalysis;
  if (!libraryAnalysis) {
    // Quick analysis without LLM for speed
    libraryAnalysis = quickAnalyzeLibrary(libraryId, library) as LibraryAnalysis;
  }

  // Step 2: Find exemplar icons for few-shot examples
  // Use trait-aware selection if icons have enrichment data, otherwise fall back to basic selection
  // For variants, we get more icons and rotate the selection to get different examples
  const exemplarPoolSize = fewShotCount + (variantIndex * 2); // Get extra icons for rotation

  // Check if library has enrichment data
  const hasEnrichment = library.some(i => i.aiMetadata);

  let exemplarIcons: Icon[];
  if (hasEnrichment) {
    // Use trait-aware selection (leverages aiMetadata for smart matching)
    exemplarIcons = findExemplarIconsWithTraits(library, exemplarPoolSize, concept);
    const hints = getConceptHints(concept);
    console.log(`[HybridGenerator] Using trait-aware selection (target: ${hints.category || 'any'}, traits: ${hints.traits?.join(', ') || 'none'})`);
  } else {
    // Fall back to basic exemplar selection
    exemplarIcons = findExemplarIcons(library, exemplarPoolSize, concept);
  }

  // For variants > 0, rotate the selection to use different examples
  if (variantIndex > 0 && exemplarIcons.length > fewShotCount) {
    // Rotate the array by variantIndex positions
    const rotateBy = variantIndex % exemplarIcons.length;
    exemplarIcons = [
      ...exemplarIcons.slice(rotateBy),
      ...exemplarIcons.slice(0, rotateBy)
    ].slice(0, fewShotCount);
  } else {
    exemplarIcons = exemplarIcons.slice(0, fewShotCount);
  }

  // Log selected exemplars with their traits if available
  const exemplarInfo = exemplarIcons.map(i => {
    const traits = i.aiMetadata?.geometricTraits?.slice(0, 2).join(',') || '';
    return traits ? `${i.name}(${traits})` : i.name;
  }).join(', ');
  console.log(`[HybridGenerator] Found ${exemplarIcons.length} exemplar icons: ${exemplarInfo}`);

  // Step 3: Get decomposition
  let decomposition: Decomposition | null = null;
  let decompositionSource: 'static' | 'dynamic' | 'none' = 'none';

  if (decompositionMode === 'dynamic' || decompositionMode === 'auto') {
    decomposition = await getDecomposition(concept, decompositionMode, exemplarIcons, resolvedApiKey);
    if (decomposition) {
      decompositionSource = decomposition.source;
      console.log(`[HybridGenerator] Using ${decompositionSource} decomposition with ${decomposition.components.length} components`);
    }
  }

  // Step 4: Parse Style DNA if provided
  let styleSpec: StyleSpec | undefined;
  if (styleManifest) {
    styleSpec = parseStyleDNA(styleManifest);
    console.log(`[HybridGenerator] Parsed Style DNA: linecap=${styleSpec.strokeLinecap || 'default'}, linejoin=${styleSpec.strokeLinejoin || 'default'}`);
  }

  // Step 4b: P1c - Get structural reference from Iconify (cross-library consensus)
  let structuralReference: StructuralReference | null = null;
  if (useReferenceOracle) {
    try {
      structuralReference = await getStructuralReference(concept, {
        maxIcons: 6,
        maxPerCollection: 1,
        apiKey: resolvedApiKey,
      });
      if (structuralReference) {
        console.log(`[HybridGenerator] Reference Oracle: Found ${structuralReference.iconCount} icons across ${structuralReference.collections.length} libraries`);
        if (structuralReference.consensus.elements.length > 0) {
          console.log(`[HybridGenerator] Consensus elements: ${structuralReference.consensus.elements.slice(0, 3).join(', ')}`);
        }
      }
    } catch (error) {
      console.warn(`[HybridGenerator] Reference Oracle failed (continuing without):`, error);
      // Continue without structural reference - it's optional
    }
  }

  // Step 5: Build prompt
  const prompt = buildSvgPrompt({
    concept,
    description,
    similarIcons: exemplarIcons,
    decomposition,
    libraryAnalysis,
    styleSpec,
    structuralReference,  // P1c: Cross-library consensus
    includePatternLibrary,
    includeFewShot: true,
    includeDecomposition: true,
    includeStructuralReference: true,  // P1c: Include if available
    maxFewShotExamples: fewShotCount,
    onlyRelevantPatterns: true,
    allowCreativeInterpretation,
  });

  if (allowCreativeInterpretation) {
    console.log(`[HybridGenerator] Creative interpretation ENABLED for this variant`);
  }

  console.log(`[HybridGenerator] Prompt built: ~${prompt.estimatedTokens} tokens`);

  // Step 6: Generate with LLM (with retry logic for validation failures)
  // Note: Using gemini-2.5-flash for better SVG generation quality (proven in spike tests)
  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const fullPrompt = combineSvgPrompt(prompt);

  let svg = '';
  let attempts = 0;
  let validation: ValidationResult | undefined;
  let wasFixed = false;

  while (attempts < maxRetries + 1) {
    attempts++;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature: temperature + (attempts - 1) * 0.1 },
    });

    const responseText = result.response.text();
    svg = extractSvg(responseText);

    if (!isValidSvg(svg)) {
      console.warn(`[HybridGenerator] Generated SVG may be invalid (attempt ${attempts}): ${svg.substring(0, 100)}...`);
      continue;
    }

    // Validate coordinates if enabled
    if (validateCoordinates) {
      validation = validateSvg(svg, {
        viewBoxSize: 24,
        warningMargin: 1,
        autoFix: autoFixBounds,
        fixPadding: 2,
      });

      console.log(`[HybridGenerator] Validation (attempt ${attempts}): ${validation.isValid ? 'PASS' : 'FAIL'}`);

      if (!validation.isValid) {
        // Log the validation errors
        for (const error of validation.errors) {
          console.warn(`  [Validation] ${error.type}: ${error.message}`);
        }

        // If auto-fix is enabled and we have a fixed version, use it
        if (autoFixBounds && validation.fixedSvg) {
          console.log(`[HybridGenerator] Auto-fixing out-of-bounds SVG`);
          svg = validation.fixedSvg;
          wasFixed = true;
          break;
        }

        // Otherwise retry with slightly higher temperature
        if (attempts < maxRetries + 1) {
          console.log(`[HybridGenerator] Retrying generation (attempt ${attempts + 1})...`);
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
      } else {
        // Validation passed
        break;
      }
    } else {
      // No validation requested
      break;
    }
  }

  // Log any warnings from pre-processing validation
  if (validation?.warnings.length) {
    for (const warning of validation.warnings) {
      console.log(`  [Validation] WARNING: ${warning.message}`);
    }
  }

  // =========================================================================
  // IRON DOME: Unified SVG Processing
  // This replaces separate validation + enforcement + optimization steps
  // with a single, consolidated pipeline that guarantees style compliance
  // =========================================================================

  // Build enforcement rules from style spec or use defaults
  const rules: EnforcementRules = styleSpec
    ? rulesFromStyleDNA(styleSpec)
    : FEATHER_RULES; // Default to Feather-style rules

  // Create style profile for the processor
  const profile = createProfileFromRules(rules, 'generate');

  // Process through the Iron Dome
  const processResult = SVGProcessor.process(svg, 'generate', profile);

  // Log processing result
  console.log(`[IronDome] Processed SVG: ${processResult.modified ? 'MODIFIED' : 'UNCHANGED'}`);
  if (processResult.compliance) {
    console.log(`[IronDome] Style compliance: ${processResult.compliance.passed ? 'PASS' : 'FAIL'} (Score: ${processResult.compliance.score}/100)`);
    if (processResult.compliance.changes.length > 0) {
      console.log(`[IronDome] Auto-fixed: ${processResult.compliance.changes.map(c => c.attribute).join(', ')}`);
    }
  }
  if (processResult.warnings.length > 0) {
    for (const w of processResult.warnings) {
      console.log(`[IronDome] Warning: ${w}`);
    }
  }

  // Use the processed SVG
  svg = processResult.svg;

  // Extract compliance for return value (for backward compatibility)
  const compliance = processResult.compliance || undefined;

  return {
    svg,
    attempts,
    decomposition,
    fewShotExamples: exemplarIcons.map(i => i.name),
    tokensUsed: prompt.estimatedTokens * attempts,
    decompositionSource,
    prompt,
    validation,
    wasFixed,
    structuralReference,  // P1c: Include cross-library consensus if used
    compliance,  // F1: Include style compliance result
  };
}

/**
 * Variation prompts to encourage different interpretations
 */
const VARIATION_HINTS = [
  '', // First variant: no hint, just the base concept
  'Use a more geometric, minimal interpretation.',
  'Use a more organic, flowing interpretation.',
  'Simplify to the absolute essential elements.',
  'Add subtle detail while maintaining the style.',
];

/**
 * Generate multiple icon variants with meaningful differences
 */
// Cache for Reference Oracle results to avoid repeated calls during variant generation
const referenceOracleCache = new Map<string, StructuralReference | null>();

export async function generateIconVariants(
  config: GenerationConfig,
  count: number = 3
): Promise<GenerationResult[]> {
  const results: GenerationResult[] = [];

  // Pre-fetch structural reference once for all variants (P1c optimization)
  // This avoids making 3 separate Reference Oracle calls
  const cacheKey = config.concept.toLowerCase().trim();
  if (config.useReferenceOracle !== false && !referenceOracleCache.has(cacheKey)) {
    try {
      const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
      const ref = await getStructuralReference(config.concept, {
        maxIcons: 6,
        maxPerCollection: 1,
        apiKey,
      });
      referenceOracleCache.set(cacheKey, ref);
      console.log(`[HybridGenerator] Pre-cached Reference Oracle for "${config.concept}"`);
    } catch (error) {
      console.warn(`[HybridGenerator] Reference Oracle pre-fetch failed:`, error);
      referenceOracleCache.set(cacheKey, null);
    }
  }

  for (let i = 0; i < count; i++) {
    // Add variation hint to description
    const hint = VARIATION_HINTS[i % VARIATION_HINTS.length];
    const variedDescription = config.description
      ? `${config.description}. ${hint}`.trim()
      : hint;

    // Vary temperature and create config for this variant
    // Enable creative interpretation for variants after the first
    // Disable Reference Oracle per-variant since we pre-fetched
    const variantConfig: GenerationConfig = {
      ...config,
      description: variedDescription || undefined,
      temperature: Math.min(0.9, (config.temperature || 0.2) + i * 0.2),
      variantIndex: i, // Pass variant index to rotate few-shot examples
      allowCreativeInterpretation: i > 0, // First variant follows exact paths, others are creative
      useReferenceOracle: false, // Already pre-fetched
    };

    console.log(`[HybridGenerator] Generating variant ${i + 1}/${count} (temp=${(variantConfig.temperature || 0.2).toFixed(1)}, hint="${hint || 'none'}")`);

    try {
      const result = await generateIcon(variantConfig);
      results.push(result);
    } catch (error) {
      console.error(`[HybridGenerator] Error generating variant ${i + 1}:`, error);
    }

    // Rate limiting
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return results;
}

/**
 * Pre-analyze a library for faster generation later
 *
 * Call this when a library is ingested to:
 * 1. Extract patterns and style rules
 * 2. Pre-generate decompositions for common icons
 * 3. Cache everything for fast generation
 */
export async function preAnalyzeLibrary(
  libraryId: string,
  icons: Icon[],
  apiKey?: string
): Promise<LibraryAnalysis> {
  console.log(`[HybridGenerator] Pre-analyzing library "${libraryId}" with ${icons.length} icons`);

  const analysis = await getLibraryAnalysis(libraryId, icons, apiKey, true);

  console.log(`[HybridGenerator] Analysis complete:`);
  console.log(`  - ${analysis.commonPatterns.length} pattern types detected`);
  console.log(`  - ${analysis.styleRules.length} style rules extracted`);
  console.log(`  - ${Object.keys(analysis.decompositions).length} decompositions generated`);

  return analysis;
}

/**
 * Check if a library has been analyzed
 */
export function hasLibraryAnalysis(libraryId: string): boolean {
  return libraryAnalysisCache.has(libraryId);
}

/**
 * Clear cached library analysis
 */
export function clearLibraryAnalysis(libraryId?: string): void {
  if (libraryId) {
    libraryAnalysisCache.delete(libraryId);
  } else {
    libraryAnalysisCache.clear();
  }
}

// =============================================================================
// KITBASH REFINERY - Transform draft assemblies into cohesive icons
// =============================================================================

/**
 * Configuration for icon refinement
 */
export interface RefinementConfig {
  /** The original concept (for context) */
  concept: string;

  /** Style DNA/manifest to enforce */
  styleManifest?: string;

  /** API key for Gemini */
  apiKey?: string;

  /** Temperature for generation (default: 0.1 for precise tracing) */
  temperature?: number;
}

/**
 * Result of icon refinement
 */
export interface RefinementResult {
  /** The refined SVG */
  svg: string;

  /** Was refinement successful? */
  success: boolean;

  /** What changes were made */
  changes: string[];

  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Refine a draft Kitbash assembly into a cohesive, production-ready icon
 *
 * This is the "Refinery" step that transforms mechanically-assembled Kitbash
 * output (which may have overlapping paths, disjointed corners) into a unified
 * vector that looks "drawn by a single hand."
 *
 * Strategy: Frame this as SVG CODE REFACTORING, not image generation.
 * Gemini is better at code manipulation than precise geometry generation.
 */
export async function refineIcon(
  draftSvg: string,
  config: RefinementConfig
): Promise<RefinementResult> {
  const startTime = performance.now();

  const resolvedApiKey = config.apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    return {
      svg: draftSvg,
      success: false,
      changes: ['No API key available'],
      processingTimeMs: performance.now() - startTime,
    };
  }

  console.log(`[Refinery] Starting refinement for "${config.concept}"`);

  // Build the refinement prompt
  const prompt = buildRefinementPrompt(draftSvg, config);

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature ?? 0.1, // Low temp for precise work
      },
    });

    const responseText = result.response.text();
    const refinedSvg = extractSvg(responseText);

    // Validate the refined SVG
    if (!isValidSvg(refinedSvg)) {
      console.warn('[Refinery] Refined SVG is invalid, returning draft');
      return {
        svg: draftSvg,
        success: false,
        changes: ['Refinement produced invalid SVG'],
        processingTimeMs: performance.now() - startTime,
      };
    }

    // Process through Iron Dome for final polish
    const rules = config.styleManifest
      ? rulesFromStyleDNA(parseStyleDNA(config.styleManifest))
      : FEATHER_RULES;

    const profile = createProfileFromRules(rules, 'generate');
    const processResult = SVGProcessor.process(refinedSvg, 'generate', profile);

    console.log(`[Refinery] Refinement complete: ${processResult.modified ? 'MODIFIED' : 'UNCHANGED'}`);

    return {
      svg: processResult.svg,
      success: true,
      changes: [
        'Merged overlapping paths',
        'Fixed disjointed corners',
        'Applied style enforcement',
        ...(processResult.compliance?.changes.map(c => `Fixed ${c.attribute}`) || []),
      ],
      processingTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    console.error('[Refinery] Error during refinement:', error);
    return {
      svg: draftSvg,
      success: false,
      changes: [`Error: ${error}`],
      processingTimeMs: performance.now() - startTime,
    };
  }
}

/**
 * Build the prompt for the Refinery
 */
function buildRefinementPrompt(draftSvg: string, config: RefinementConfig): string {
  const styleInfo = config.styleManifest
    ? `\n\nSTYLE DNA TO PRESERVE:\n${config.styleManifest.slice(0, 500)}`
    : '\n\nSTYLE: Feather-style (stroke-width="2", stroke-linecap="round", stroke-linejoin="round")';

  return `You are an SVG code refactoring expert. I have a valid SVG that was mechanically
assembled from multiple icon components. It may contain visual artifacts:
- Overlapping stroke paths that should be merged
- Disjointed corners where paths should connect smoothly
- Redundant path segments that can be simplified

CONCEPT: "${config.concept}"
${styleInfo}

TASK: Refactor the SVG code to fix these artifacts while preserving the visual design.

RULES:
1. PRESERVE the exact visual geometry - do not add or remove shapes
2. MERGE overlapping paths into clean single strokes where appropriate
3. CONNECT disjointed path endpoints that are within 1-2px of each other
4. MAINTAIN all existing style attributes (stroke-width, stroke-linecap, etc.)
5. KEEP the viewBox and all root SVG attributes
6. Output valid SVG only - no explanation

INPUT SVG:
${draftSvg}

OUTPUT: The refactored SVG code only.`;
}
