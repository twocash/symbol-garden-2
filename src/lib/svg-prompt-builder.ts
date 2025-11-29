/**
 * SVG Prompt Builder - Assembles optimal prompts for SVG-native generation
 *
 * Combines:
 * - Pattern library (reusable SVG idioms)
 * - Few-shot examples (similar icons from library)
 * - Structural decomposition (component breakdown)
 * - Task instructions
 *
 * Note: This is separate from prompt-builder.ts which handles Imagen prompts.
 */

import { Icon } from '../types/schema';
import { formatPatternLibrary, getSuggestedPatterns } from './pattern-library';
import { Decomposition, formatDecompositionForPrompt } from './decomposition-service';
import { formatSimilarIconsForPrompt, formatSimilarIconsWithContext, IconStyleSpec } from './similar-icon-finder';
import { LibraryAnalysis } from './library-analyzer';

/**
 * Style specifications extracted from Style DNA / Geometric Autopsy
 */
export interface StyleSpec {
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  strokeWidth?: number;
  viewBoxSize?: number;
  padding?: number;  // Distance from edges
  // Raw Style DNA text for additional context
  rawManifest?: string;
}

export interface SvgPromptOptions {
  concept: string;
  description?: string;

  // Components to include
  includePatternLibrary?: boolean;
  includeFewShot?: boolean;
  includeDecomposition?: boolean;

  // Data sources
  similarIcons?: Icon[];
  decomposition?: Decomposition | null;
  libraryAnalysis?: LibraryAnalysis;
  styleSpec?: StyleSpec;  // Style DNA specifications

  // Fine-tuning
  maxFewShotExamples?: number;
  onlyRelevantPatterns?: boolean;

  // Variant generation - allows creative interpretation instead of exact path following
  allowCreativeInterpretation?: boolean;
}

export interface BuiltSvgPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
  components: {
    patternLibrary: boolean;
    fewShotCount: number;
    hasDecomposition: boolean;
  };
}

/**
 * Parse Style DNA / Geometric Autopsy text to extract structured parameters
 *
 * Looks for patterns like:
 * - stroke-linecap="butt"
 * - stroke-linejoin="miter"
 * - stroke-width: 2px
 * - viewBox: 24x24
 */
export function parseStyleDNA(manifest: string): StyleSpec {
  const spec: StyleSpec = {
    rawManifest: manifest,
  };

  // Parse stroke-linecap (look for quotes or description)
  const linecapMatch = manifest.match(/stroke-linecap[=:]["']?(butt|round|square)["']?/i)
    || manifest.match(/linecap[:\s]+(butt|round|square)/i)
    || manifest.match(/terminal[s]?[:\s]+(butt|round|square)/i);
  if (linecapMatch) {
    spec.strokeLinecap = linecapMatch[1].toLowerCase() as 'butt' | 'round' | 'square';
  }

  // Parse stroke-linejoin
  const linejoinMatch = manifest.match(/stroke-linejoin[=:]["']?(miter|round|bevel)["']?/i)
    || manifest.match(/linejoin[:\s]+(miter|round|bevel)/i)
    || manifest.match(/join[s]?[:\s]+(miter|round|bevel)/i);
  if (linejoinMatch) {
    spec.strokeLinejoin = linejoinMatch[1].toLowerCase() as 'miter' | 'round' | 'bevel';
  }

  // Parse stroke-width (look for various patterns)
  const strokeWidthMatch = manifest.match(/stroke-width[=:]["']?(\d+(?:\.\d+)?)(?:px)?["']?/i)
    || manifest.match(/stroke[:\s]+(\d+(?:\.\d+)?)\s*px/i)
    || manifest.match(/(\d+(?:\.\d+)?)\s*px\s*(?:uniform\s+)?stroke/i)
    || manifest.match(/weight[:\s]+(\d+(?:\.\d+)?)\s*px/i);
  if (strokeWidthMatch) {
    spec.strokeWidth = parseFloat(strokeWidthMatch[1]);
  }

  // Parse viewBox size (assume square) - look for NxN patterns
  const viewBoxMatch = manifest.match(/viewBox[=:]["']?\s*0\s+0\s+(\d+)\s+(\d+)/i)
    || manifest.match(/(\d+)\s*[x×]\s*(\d+)\s*(?:px)?\s*(?:grid|viewBox|canvas)/i)
    || manifest.match(/canvas[:\s]+(\d+)\s*[x×]\s*(\d+)/i);
  if (viewBoxMatch) {
    spec.viewBoxSize = Math.max(parseInt(viewBoxMatch[1]), parseInt(viewBoxMatch[2]));
  }

  // Parse padding (look for inset, padding, edge references)
  const paddingMatch = manifest.match(/padding[:\s]+(\d+(?:\.\d+)?)\s*px/i)
    || manifest.match(/(\d+(?:\.\d+)?)\s*px\s*(?:padding|margin|edge|inset)/i)
    || manifest.match(/(\d+(?:\.\d+)?)\s*px\s*inset/i);
  if (paddingMatch) {
    spec.padding = parseFloat(paddingMatch[1]);
  }

  return spec;
}

/**
 * Build SVG requirements based on style spec (defaults to Feather-like style)
 */
function buildSvgRequirements(styleSpec?: StyleSpec, allowCreativeInterpretation?: boolean): string {
  // Extract style parameters with sensible defaults
  const viewBox = styleSpec?.viewBoxSize || 24;
  const strokeWidth = styleSpec?.strokeWidth || 2;
  const linecap = styleSpec?.strokeLinecap || 'round';
  const linejoin = styleSpec?.strokeLinejoin || 'round';
  const padding = styleSpec?.padding || 2;
  const minCoord = padding;
  const maxCoord = viewBox - padding;

  // Different path instructions based on whether creative interpretation is allowed
  const pathInstructions = allowCreativeInterpretation
    ? `4. Use the decomposition as a GUIDE, but CREATE YOUR OWN UNIQUE interpretation
5. Vary the paths creatively while maintaining the same concept and style
6. Output ONLY the SVG code, no explanation or markdown`
    : `4. **USE THE EXACT PATH SYNTAX from the decomposition when provided**
5. Do NOT improvise paths - follow the decomposition precisely
6. Output ONLY the SVG code, no explanation or markdown`;

  return `
## SVG REQUIREMENTS

Output ONLY valid SVG code with these EXACT attributes on the root <svg> element:
- width="${viewBox}" height="${viewBox}" viewBox="0 0 ${viewBox} ${viewBox}"
- fill="none" stroke="currentColor" stroke-width="${strokeWidth}"
- stroke-linecap="${linecap}" stroke-linejoin="${linejoin}"

CRITICAL RULES:
1. All coordinates MUST be between ${minCoord} and ${maxCoord} (${padding}px padding from edges)
2. Use ONLY these elements: <path>, <line>, <polyline>, <rect>, <circle>
3. EVERY child element MUST include fill="none" explicitly (SVG attributes don't inherit!)
4. For small dots/points, use a short line segment (e.g., M 12 20 L 12.01 20) NOT a filled circle
5. Never use solid fills - this is a STROKE-ONLY icon system
${pathInstructions}
`;
}

/**
 * Estimate token count for a string (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for mixed code/text
  return Math.ceil(text.length / 4);
}

/**
 * Format style rules from library analysis
 */
function formatStyleRules(analysis: LibraryAnalysis): string {
  if (!analysis.styleRules || analysis.styleRules.length === 0) {
    return '';
  }

  const rules = analysis.styleRules
    .filter(r => r.confidence > 0.7)
    .slice(0, 5)
    .map(r => `- ${r.rule}`)
    .join('\n');

  return `## LIBRARY-SPECIFIC STYLE RULES\n\n${rules}`;
}

/**
 * Build the system prompt (context and rules)
 */
function buildSystemPrompt(options: SvgPromptOptions): string {
  // Determine library name from context (for intro text)
  const libraryName = options.libraryAnalysis?.libraryId || 'the target library';

  // Different instructions based on whether creative interpretation is allowed
  const decompositionInstruction = options.allowCreativeInterpretation
    ? 'When a STRUCTURAL DECOMPOSITION is provided below, use it as inspiration for the icon structure. You should CREATE YOUR OWN UNIQUE paths while maintaining the same general concept and component breakdown.'
    : 'IMPORTANT: When a STRUCTURAL DECOMPOSITION is provided below, you MUST use the exact suggestedPath values. Do not improvise or create your own paths - assemble the icon from the provided components.';

  const sections: string[] = [
    '# SVG Icon Generator',
    '',
    `You are an expert SVG icon designer. Your task is to generate icons that PERFECTLY match the style of ${libraryName}.`,
    '',
    decompositionInstruction,
  ];

  // Include Style DNA / Geometric Autopsy if available
  if (options.styleSpec?.rawManifest) {
    sections.push('', '## STYLE DNA (Design System Specification)', '');
    sections.push('The following is the extracted "Geometric Autopsy" of this icon library. You MUST match these specifications exactly:');
    sections.push('', options.styleSpec.rawManifest);
  }

  // Pattern library
  if (options.includePatternLibrary !== false) {
    if (options.onlyRelevantPatterns && options.concept) {
      // Only include relevant patterns
      const relevant = getSuggestedPatterns(options.concept);
      if (relevant.length > 0) {
        const relevantSection = relevant
          .map(p => `### ${p.name}\n${p.description}\nExample: \`${p.example}\``)
          .join('\n\n');
        sections.push('', '## RELEVANT PATTERNS', '', relevantSection);
      }
    } else {
      // Include full pattern library
      sections.push('', formatPatternLibrary());
    }
  }

  // Library-specific style rules
  if (options.libraryAnalysis) {
    const styleRules = formatStyleRules(options.libraryAnalysis);
    if (styleRules) {
      sections.push('', styleRules);
    }
  }

  // Few-shot examples (use rich context if icons have aiMetadata)
  // Pass styleSpec to formatters so examples have correct stroke attributes
  if (options.includeFewShot !== false && options.similarIcons && options.similarIcons.length > 0) {
    const maxExamples = options.maxFewShotExamples || 4;
    const examples = options.similarIcons.slice(0, maxExamples);

    // Convert StyleSpec to IconStyleSpec format for formatters
    const iconStyleSpec = options.styleSpec ? {
      strokeLinecap: options.styleSpec.strokeLinecap,
      strokeLinejoin: options.styleSpec.strokeLinejoin,
      strokeWidth: options.styleSpec.strokeWidth,
      viewBoxSize: options.styleSpec.viewBoxSize,
    } : undefined;

    // Use rich context formatting if any examples have aiMetadata
    const hasEnrichment = examples.some(i => i.aiMetadata);
    if (hasEnrichment) {
      sections.push('', formatSimilarIconsWithContext(examples, iconStyleSpec));
    } else {
      sections.push('', formatSimilarIconsForPrompt(examples, iconStyleSpec));
    }
  }

  // Requirements (now dynamic based on style spec)
  sections.push('', buildSvgRequirements(options.styleSpec, options.allowCreativeInterpretation));

  return sections.join('\n');
}

/**
 * Build the user prompt (specific task)
 */
function buildUserPrompt(options: SvgPromptOptions): string {
  const sections: string[] = [];

  // Task header
  const desc = options.description ? ` (${options.description})` : '';
  sections.push(`## TASK: Generate "${options.concept}" icon${desc}`);

  // Decomposition
  if (options.includeDecomposition !== false && options.decomposition) {
    sections.push('', formatDecompositionForPrompt(options.decomposition));
  }

  // Final instruction
  sections.push('', 'Generate the SVG now:');

  return sections.join('\n');
}

/**
 * Build a complete prompt for SVG generation
 */
export function buildSvgPrompt(options: SvgPromptOptions): BuiltSvgPrompt {
  const systemPrompt = buildSystemPrompt(options);
  const userPrompt = buildUserPrompt(options);

  const fullPrompt = systemPrompt + '\n\n' + userPrompt;

  return {
    systemPrompt,
    userPrompt,
    estimatedTokens: estimateTokens(fullPrompt),
    components: {
      patternLibrary: options.includePatternLibrary !== false,
      fewShotCount: options.similarIcons?.length || 0,
      hasDecomposition: !!options.decomposition,
    },
  };
}

/**
 * Build a minimal prompt (for cost-sensitive scenarios)
 */
export function buildMinimalSvgPrompt(
  concept: string,
  decomposition?: Decomposition | null
): BuiltSvgPrompt {
  return buildSvgPrompt({
    concept,
    decomposition,
    includePatternLibrary: false,
    includeFewShot: false,
    includeDecomposition: true,
  });
}

/**
 * Build a full prompt (maximum context)
 */
export function buildFullSvgPrompt(
  concept: string,
  description: string | undefined,
  similarIcons: Icon[],
  decomposition: Decomposition | null,
  libraryAnalysis?: LibraryAnalysis,
  styleSpec?: StyleSpec
): BuiltSvgPrompt {
  return buildSvgPrompt({
    concept,
    description,
    similarIcons,
    decomposition,
    libraryAnalysis,
    styleSpec,
    includePatternLibrary: true,
    includeFewShot: true,
    includeDecomposition: true,
    onlyRelevantPatterns: true,
    maxFewShotExamples: 4,
  });
}

/**
 * Combine system and user prompts for single-turn APIs
 */
export function combineSvgPrompt(built: BuiltSvgPrompt): string {
  return built.systemPrompt + '\n\n' + built.userPrompt;
}
