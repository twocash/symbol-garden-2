/**
 * Library Analyzer - Extracts patterns and decompositions from ingested icon libraries
 *
 * Run once per library ingestion to:
 * 1. Analyze SVG structure of all icons
 * 2. Extract common patterns and construction idioms
 * 3. Build library-specific decomposition templates
 * 4. Cache results for use in generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Icon, SemanticCategory, GeometricTrait } from '../types/schema';
import { Decomposition, Component } from './decomposition-service';
import { PatternType, PATTERNS } from './pattern-library';

/**
 * Maps geometric traits from AI Enrichment to pattern types
 */
const TRAIT_TO_PATTERN: Partial<Record<GeometricTrait, PatternType[]>> = {
  'containment': ['container-with-lid'],
  'intersection': ['through-line'],
  'nested': ['container-with-lid', 'concentric-circles'],
  'symmetry': ['symmetric-pair'],
  'compound': ['stacked-lines'],
};

/**
 * Infer pattern type from an icon's enriched metadata
 */
function inferPatternsFromEnrichment(icon: Icon): PatternType[] {
  if (!icon.aiMetadata?.geometricTraits) return [];

  const patterns = new Set<PatternType>();

  for (const trait of icon.aiMetadata.geometricTraits) {
    const mapped = TRAIT_TO_PATTERN[trait];
    if (mapped) {
      mapped.forEach(p => patterns.add(p));
    }
  }

  return Array.from(patterns);
}

export interface LibraryAnalysis {
  libraryId: string;
  analyzedAt: string;
  iconCount: number;

  // Extracted patterns
  commonPatterns: ExtractedPattern[];

  // Library-specific style rules
  styleRules: StyleRule[];

  // Auto-generated decompositions for icons in the library
  decompositions: Record<string, Decomposition>;

  // Few-shot examples grouped by pattern type
  examplesByPattern: Record<PatternType, Icon[]>;

  // Enrichment-derived groupings (from AI Enrichment metadata)
  enrichmentStats?: EnrichmentStats;
  iconsByCategory?: Record<SemanticCategory, Icon[]>;
  iconsByComplexity?: Record<number, Icon[]>;
}

export interface ExtractedPattern {
  type: PatternType;
  frequency: number; // How many icons use this pattern
  examples: string[]; // Icon names that exemplify this pattern
  librarySpecificNotes: string; // How this library implements the pattern
}

export interface StyleRule {
  rule: string;
  confidence: number; // 0-1
  examples: string[];
}

export interface EnrichmentStats {
  enrichedCount: number;
  categoryDistribution: Record<SemanticCategory, number>;
  averageComplexity: number;
  traitDistribution: Record<GeometricTrait, number>;
}

/**
 * Analyze enrichment data from icons that have been processed by AI Enrichment
 */
function analyzeEnrichmentData(icons: Icon[]): {
  stats: EnrichmentStats;
  byCategory: Record<SemanticCategory, Icon[]>;
  byComplexity: Record<number, Icon[]>;
} {
  const enriched = icons.filter(i => i.aiMetadata);

  const categories: SemanticCategory[] = ['object', 'action', 'ui', 'abstract'];
  const byCategory: Record<SemanticCategory, Icon[]> = {
    object: [], action: [], ui: [], abstract: []
  };

  const byComplexity: Record<number, Icon[]> = {
    1: [], 2: [], 3: [], 4: [], 5: []
  };

  const categoryDistribution: Record<SemanticCategory, number> = {
    object: 0, action: 0, ui: 0, abstract: 0
  };

  const traitDistribution: Record<GeometricTrait, number> = {
    containment: 0, intersection: 0, nested: 0,
    'fine-detail': 0, symmetry: 0, 'open-path': 0, compound: 0
  };

  let totalComplexity = 0;

  for (const icon of enriched) {
    const meta = icon.aiMetadata!;

    // Category grouping
    if (meta.semanticCategory && byCategory[meta.semanticCategory]) {
      byCategory[meta.semanticCategory].push(icon);
      categoryDistribution[meta.semanticCategory]++;
    }

    // Complexity grouping
    if (meta.complexity >= 1 && meta.complexity <= 5) {
      byComplexity[meta.complexity].push(icon);
      totalComplexity += meta.complexity;
    }

    // Trait distribution
    if (meta.geometricTraits) {
      for (const trait of meta.geometricTraits) {
        if (trait in traitDistribution) {
          traitDistribution[trait]++;
        }
      }
    }
  }

  return {
    stats: {
      enrichedCount: enriched.length,
      categoryDistribution,
      averageComplexity: enriched.length > 0 ? totalComplexity / enriched.length : 0,
      traitDistribution,
    },
    byCategory,
    byComplexity,
  };
}

/**
 * Analyze an icon's SVG structure to detect patterns
 * Uses both SVG path analysis AND enrichment metadata when available
 */
function detectPatternsInIcon(icon: Icon): PatternType[] {
  const patterns = new Set<PatternType>();
  const path = icon.path || '';

  // First, check if we have enrichment-derived patterns (higher quality)
  const enrichmentPatterns = inferPatternsFromEnrichment(icon);
  enrichmentPatterns.forEach(p => patterns.add(p));

  // Fallback to SVG path analysis for icons without enrichment
  if (!icon.aiMetadata) {
    // Arc loop detection (a command with curves returning to start)
    if (/a[\d.\s]+.*[zZ]/.test(path) || /[cC].*[cC].*[zZ]/.test(path)) {
      patterns.add('arc-loop');
    }

    // Container with lid (multiple M commands with rectangular shapes)
    if ((path.match(/M/g) || []).length >= 2 && /[hH].*[vV].*[hH]/.test(path)) {
      patterns.add('container-with-lid');
    }

    // Through line (line elements or simple M...L paths)
    if (/M\d+\s+\d+\s*[lLvVhH]/.test(path) && path.length < 30) {
      patterns.add('through-line');
    }

    // Symmetric pair detection (mirrored coordinates around x=12)
    const coords = path.match(/\d+(\.\d+)?/g) || [];
    const xCoords = coords.filter((_, i) => i % 2 === 0).map(Number);
    const hasSymmetry = xCoords.some(x => xCoords.includes(24 - x));
    if (hasSymmetry && xCoords.length > 4) {
      patterns.add('symmetric-pair');
    }

    // Concentric circles (multiple circle elements or arc commands with same center)
    if (icon.path?.includes('circle') || /a\d+\s+\d+\s+0\s+[01]\s+[01]/.test(path)) {
      patterns.add('concentric-circles');
    }
  }

  return Array.from(patterns);
}

/**
 * Analyze a batch of icons to extract common patterns
 */
function analyzePatternFrequency(icons: Icon[]): ExtractedPattern[] {
  const patternCounts = new Map<PatternType, { count: number; examples: string[] }>();

  // Initialize all pattern types
  for (const pattern of PATTERNS) {
    patternCounts.set(pattern.type, { count: 0, examples: [] });
  }

  // Count patterns in each icon
  for (const icon of icons) {
    const detected = detectPatternsInIcon(icon);
    for (const patternType of detected) {
      const entry = patternCounts.get(patternType)!;
      entry.count++;
      if (entry.examples.length < 5) {
        entry.examples.push(icon.name);
      }
    }
  }

  // Convert to array and sort by frequency
  return Array.from(patternCounts.entries())
    .map(([type, data]) => ({
      type,
      frequency: data.count,
      examples: data.examples,
      librarySpecificNotes: '',
    }))
    .filter(p => p.frequency > 0)
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Group icons by their dominant pattern for few-shot selection
 */
function groupIconsByPattern(icons: Icon[]): Record<PatternType, Icon[]> {
  const groups: Record<PatternType, Icon[]> = {} as Record<PatternType, Icon[]>;

  for (const pattern of PATTERNS) {
    groups[pattern.type] = [];
  }

  for (const icon of icons) {
    const patterns = detectPatternsInIcon(icon);
    for (const patternType of patterns) {
      if (groups[patternType].length < 10) {
        groups[patternType].push(icon);
      }
    }
  }

  return groups;
}

/**
 * Use LLM to extract style rules from a sample of icons
 */
async function extractStyleRules(
  icons: Icon[],
  apiKey?: string
): Promise<StyleRule[]> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    return [];
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Sample 15 diverse icons
  const step = Math.max(1, Math.floor(icons.length / 15));
  const samples = icons.filter((_, i) => i % step === 0).slice(0, 15);

  const svgSamples = samples.map(icon => {
    const svg = `<svg viewBox="0 0 24 24"><path d="${icon.path}"/></svg>`;
    return `${icon.name}: ${svg}`;
  }).join('\n\n');

  const prompt = `Analyze these SVG icons and extract the consistent style rules.

ICONS:
${svgSamples}

Extract rules about:
1. Stroke width and style
2. Corner radius conventions
3. Spacing and padding
4. Element sizing proportions
5. Common coordinate patterns

Return as JSON array:
[
  { "rule": "...", "confidence": 0.9, "examples": ["icon1", "icon2"] }
]`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const text = result.response.text();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('[LibraryAnalyzer] Error extracting style rules:', error);
  }

  return [];
}

/**
 * Generate decompositions for icons in the library using LLM
 */
async function generateLibraryDecompositions(
  icons: Icon[],
  maxIcons: number = 30,
  apiKey?: string
): Promise<Record<string, Decomposition>> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    return {};
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Select diverse icons for decomposition
  const step = Math.max(1, Math.floor(icons.length / maxIcons));
  const samples = icons.filter((_, i) => i % step === 0).slice(0, maxIcons);

  const decompositions: Record<string, Decomposition> = {};

  // Process in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < samples.length; i += batchSize) {
    const batch = samples.slice(i, i + batchSize);

    const prompt = `Decompose these icons into structural components.

ICONS:
${batch.map(icon => `${icon.name}: <path d="${icon.path}"/>`).join('\n')}

For each icon, identify the distinct visual components and how they connect.

Return as JSON:
{
  "iconName": {
    "components": [
      { "name": "...", "description": "...", "type": "path|circle|rect|line", "suggestedPath": "..." }
    ],
    "connectionRules": ["..."],
    "patterns": ["arc-loop", "container-with-lid", etc]
  }
}`;

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      });

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const [name, data] of Object.entries(parsed)) {
          const d = data as any;
          decompositions[name.toLowerCase()] = {
            concept: name.toLowerCase(),
            components: d.components || [],
            connectionRules: d.connectionRules || [],
            patterns: d.patterns || [],
            source: 'dynamic',
          };
        }
      }
    } catch (error) {
      console.error(`[LibraryAnalyzer] Error decomposing batch ${i}:`, error);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return decompositions;
}

/**
 * Analyze an entire icon library
 *
 * @param libraryId - Identifier for the library
 * @param icons - All icons in the library
 * @param options - Analysis options
 */
export async function analyzeLibrary(
  libraryId: string,
  icons: Icon[],
  options: {
    generateDecompositions?: boolean;
    maxDecompositions?: number;
    extractStyleRules?: boolean;
    apiKey?: string;
  } = {}
): Promise<LibraryAnalysis> {
  console.log(`[LibraryAnalyzer] Analyzing library "${libraryId}" with ${icons.length} icons`);

  const {
    generateDecompositions: shouldDecompose = true,
    maxDecompositions = 30,
    extractStyleRules: shouldExtractRules = true,
    apiKey,
  } = options;

  // Pattern frequency analysis (no LLM needed)
  const commonPatterns = analyzePatternFrequency(icons);
  console.log(`[LibraryAnalyzer] Detected ${commonPatterns.length} pattern types`);

  // Group icons by pattern (no LLM needed)
  const examplesByPattern = groupIconsByPattern(icons);

  // Style rules extraction (requires LLM)
  const styleRules = shouldExtractRules
    ? await extractStyleRules(icons, apiKey)
    : [];
  console.log(`[LibraryAnalyzer] Extracted ${styleRules.length} style rules`);

  // Decomposition generation (requires LLM)
  const decompositions = shouldDecompose
    ? await generateLibraryDecompositions(icons, maxDecompositions, apiKey)
    : {};
  console.log(`[LibraryAnalyzer] Generated ${Object.keys(decompositions).length} decompositions`);

  // Enrichment data analysis (no LLM - uses existing metadata)
  const { stats: enrichmentStats, byCategory: iconsByCategory, byComplexity: iconsByComplexity } =
    analyzeEnrichmentData(icons);

  if (enrichmentStats.enrichedCount > 0) {
    console.log(`[LibraryAnalyzer] Found ${enrichmentStats.enrichedCount} enriched icons`);
    console.log(`[LibraryAnalyzer] Category distribution:`, enrichmentStats.categoryDistribution);
    console.log(`[LibraryAnalyzer] Average complexity: ${enrichmentStats.averageComplexity.toFixed(2)}`);
  }

  return {
    libraryId,
    analyzedAt: new Date().toISOString(),
    iconCount: icons.length,
    commonPatterns,
    styleRules,
    decompositions,
    examplesByPattern,
    enrichmentStats,
    iconsByCategory,
    iconsByComplexity,
  };
}

/**
 * Quick analysis without LLM calls (pattern detection + enrichment data)
 */
export function quickAnalyzeLibrary(libraryId: string, icons: Icon[]): Partial<LibraryAnalysis> {
  const { stats: enrichmentStats, byCategory: iconsByCategory, byComplexity: iconsByComplexity } =
    analyzeEnrichmentData(icons);

  return {
    libraryId,
    analyzedAt: new Date().toISOString(),
    iconCount: icons.length,
    commonPatterns: analyzePatternFrequency(icons),
    examplesByPattern: groupIconsByPattern(icons),
    styleRules: [],
    decompositions: {},
    enrichmentStats,
    iconsByCategory,
    iconsByComplexity,
  };
}

/**
 * Analyze a library specifically for icon generation purposes
 * Uses enrichment data when available for better similar-icon matching
 */
export function analyzeForGeneration(libraryId: string, icons: Icon[]): {
  analysis: Partial<LibraryAnalysis>;
  hasEnrichment: boolean;
  enrichedCount: number;
} {
  const analysis = quickAnalyzeLibrary(libraryId, icons);
  const enrichedCount = analysis.enrichmentStats?.enrichedCount || 0;

  return {
    analysis,
    hasEnrichment: enrichedCount > 0,
    enrichedCount,
  };
}
