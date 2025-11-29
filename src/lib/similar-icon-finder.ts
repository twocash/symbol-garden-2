/**
 * Similar Icon Finder - Finds structurally similar icons for few-shot examples
 *
 * Uses multiple strategies (in priority order):
 * 1. AI-enriched metadata (semanticCategory, geometricTraits, complexity)
 * 2. Tag/synonym matching from enrichment
 * 3. Keyword similarity in names
 * 4. Pattern-based matching from library analysis
 *
 * The AI enrichment data (from /api/enrich) is the primary source of truth
 * for finding structurally similar icons.
 */

import { Icon, SemanticCategory, GeometricTrait } from '../types/schema';
import { PatternType } from './pattern-library';
import { LibraryAnalysis } from './library-analyzer';

export interface SimilarityResult {
  icon: Icon;
  score: number;
  matchReason: string;
}

/**
 * Concept hints - maps concepts to expected semantic categories and traits
 * Used when we need to guess what category a novel concept belongs to
 */
const CONCEPT_HINTS: Record<string, { category?: SemanticCategory; traits?: GeometricTrait[] }> = {
  // Objects
  rocket: { category: 'object', traits: ['symmetry'] },
  brain: { category: 'object', traits: ['compound'] },
  robot: { category: 'object', traits: ['symmetry', 'compound'] },
  car: { category: 'object', traits: ['symmetry'] },
  plane: { category: 'object', traits: ['symmetry'] },
  boat: { category: 'object', traits: ['symmetry'] },

  // Actions
  download: { category: 'action', traits: ['open-path'] },
  upload: { category: 'action', traits: ['open-path'] },
  sync: { category: 'action', traits: ['symmetry'] },
  refresh: { category: 'action', traits: ['open-path'] },

  // UI
  dashboard: { category: 'ui', traits: ['compound', 'nested'] },
  sidebar: { category: 'ui', traits: ['compound'] },
  modal: { category: 'ui', traits: ['containment', 'nested'] },

  // Abstract
  ai: { category: 'abstract', traits: ['compound'] },
  network: { category: 'abstract', traits: ['compound', 'intersection'] },
  data: { category: 'abstract', traits: ['compound'] },
};

/**
 * Common icon categories and their keywords
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Objects & Items
  container: ['box', 'package', 'gift', 'bag', 'basket', 'cart', 'trash', 'folder', 'briefcase'],
  device: ['phone', 'camera', 'monitor', 'laptop', 'tablet', 'tv', 'speaker', 'headphones', 'watch'],
  tool: ['hammer', 'wrench', 'scissors', 'pen', 'pencil', 'brush', 'ruler', 'compass'],

  // Nature
  weather: ['sun', 'moon', 'cloud', 'rain', 'snow', 'wind', 'thunder', 'umbrella'],
  nature: ['tree', 'leaf', 'flower', 'mountain', 'wave', 'fire', 'star'],

  // UI & Actions
  media: ['play', 'pause', 'stop', 'forward', 'rewind', 'volume', 'music', 'video'],
  navigation: ['arrow', 'chevron', 'menu', 'home', 'search', 'settings', 'filter'],
  communication: ['mail', 'message', 'chat', 'phone', 'bell', 'notification'],
  user: ['user', 'users', 'person', 'profile', 'avatar', 'account'],

  // Shapes & Symbols
  shape: ['circle', 'square', 'triangle', 'heart', 'star', 'diamond'],
  symbol: ['check', 'x', 'plus', 'minus', 'info', 'warning', 'help'],
};

/**
 * Calculate keyword similarity between concept and icon name
 */
function keywordSimilarity(concept: string, iconName: string): number {
  const conceptWords = concept.toLowerCase().split(/[\s-_]+/);
  const iconWords = iconName.toLowerCase().split(/[\s-_]+/);

  let matches = 0;
  for (const cWord of conceptWords) {
    for (const iWord of iconWords) {
      if (cWord === iWord) {
        matches += 1.0;
      } else if (cWord.includes(iWord) || iWord.includes(cWord)) {
        matches += 0.5;
      } else if (levenshteinDistance(cWord, iWord) <= 2) {
        matches += 0.3;
      }
    }
  }

  return matches / Math.max(conceptWords.length, 1);
}

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find the category for a concept
 */
function findCategory(concept: string): string | null {
  const normalized = concept.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw) || kw.includes(normalized))) {
      return category;
    }
  }

  return null;
}

/**
 * Get expected category and traits for a concept
 * Exported so hybrid-generator can use it
 */
export function getConceptHints(concept: string): { category?: SemanticCategory; traits?: GeometricTrait[] } {
  const normalized = concept.toLowerCase().replace(/[\s-_]+/g, '');

  // Check direct match
  if (CONCEPT_HINTS[normalized]) {
    return CONCEPT_HINTS[normalized];
  }

  // Check partial match
  for (const [key, hints] of Object.entries(CONCEPT_HINTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return hints;
    }
  }

  // Infer from keywords
  const keywords = concept.toLowerCase();
  if (/download|upload|send|receive|play|pause|stop|edit|delete|add|remove/.test(keywords)) {
    return { category: 'action' };
  }
  if (/arrow|chevron|menu|nav|tab|panel|modal|button|input/.test(keywords)) {
    return { category: 'ui' };
  }
  if (/warning|error|info|check|x|plus|minus|heart|star/.test(keywords)) {
    return { category: 'abstract' };
  }

  // Default to object for physical things
  return { category: 'object' };
}

/**
 * Score an icon's similarity to a concept
 * Prioritizes AI-enriched metadata when available
 */
function scoreIcon(
  concept: string,
  icon: Icon,
  libraryAnalysis?: LibraryAnalysis
): SimilarityResult {
  let score = 0;
  const reasons: string[] = [];

  // Get expected category/traits for the concept
  const conceptHints = getConceptHints(concept);

  // ========================================
  // PRIORITY 1: AI-enriched metadata (highest weight)
  // ========================================
  if (icon.aiMetadata) {
    const meta = icon.aiMetadata;

    // Semantic category match (very important)
    if (conceptHints.category && meta.semanticCategory === conceptHints.category) {
      score += 4;
      reasons.push(`semantic: ${meta.semanticCategory}`);
    }

    // Geometric trait matching
    if (conceptHints.traits && meta.geometricTraits) {
      const traitMatches = conceptHints.traits.filter(t =>
        meta.geometricTraits.includes(t)
      );
      if (traitMatches.length > 0) {
        score += traitMatches.length * 1.5;
        reasons.push(`traits: ${traitMatches.join(', ')}`);
      }
    }

    // Prefer medium complexity (2-4) for good examples
    if (meta.complexity >= 2 && meta.complexity <= 4) {
      score += 0.5;
      reasons.push(`complexity: ${meta.complexity}`);
    }
  }

  // ========================================
  // PRIORITY 2: Direct name match
  // ========================================
  const nameScore = keywordSimilarity(concept, icon.name);
  if (nameScore > 0) {
    score += nameScore * 3;
    reasons.push(`name match (${nameScore.toFixed(2)})`);
  }

  // ========================================
  // PRIORITY 3: Tag and synonym matching
  // ========================================
  const allTags = [
    ...(icon.tags || []),
    ...(icon.synonyms || []),
  ];

  if (allTags.length > 0) {
    const conceptWords = concept.toLowerCase().split(/[\s-_]+/);
    const tagMatches = allTags.filter(tag => {
      const tagLower = tag.toLowerCase();
      return conceptWords.some(word =>
        tagLower.includes(word) || word.includes(tagLower)
      );
    });

    if (tagMatches.length > 0) {
      score += tagMatches.length * 2;
      reasons.push(`tags: ${tagMatches.slice(0, 3).join(', ')}`);
    }
  }

  // ========================================
  // PRIORITY 4: AI description match
  // ========================================
  if (icon.aiDescription) {
    const descWords = icon.aiDescription.toLowerCase();
    const conceptWords = concept.toLowerCase().split(/[\s-_]+/);
    const descMatches = conceptWords.filter(word =>
      word.length > 2 && descWords.includes(word)
    );
    if (descMatches.length > 0) {
      score += descMatches.length * 0.5;
      reasons.push(`description match`);
    }
  }

  // ========================================
  // PRIORITY 5: Fallback category matching (keyword-based)
  // ========================================
  if (!icon.aiMetadata) {
    const conceptCategory = findCategory(concept);
    const iconCategory = findCategory(icon.name);
    if (conceptCategory && iconCategory && conceptCategory === iconCategory) {
      score += 1.5;
      reasons.push(`keyword category: ${conceptCategory}`);
    }
  }

  // ========================================
  // PRIORITY 6: Pattern matching from library analysis
  // ========================================
  if (libraryAnalysis) {
    const iconPatterns = new Set<PatternType>();
    for (const [patternType, icons] of Object.entries(libraryAnalysis.examplesByPattern)) {
      if (icons.some(i => i.name === icon.name)) {
        iconPatterns.add(patternType as PatternType);
      }
    }
    if (iconPatterns.size > 0) {
      score += 0.5;
      reasons.push(`patterns: ${Array.from(iconPatterns).join(', ')}`);
    }
  }

  return {
    icon,
    score,
    matchReason: reasons.join('; ') || 'no specific match',
  };
}

/**
 * Find similar icons from a library
 *
 * @param concept - The concept to find similar icons for
 * @param icons - All icons in the library
 * @param count - Number of similar icons to return
 * @param libraryAnalysis - Optional pre-computed library analysis
 */
export function findSimilarIcons(
  concept: string,
  icons: Icon[],
  count: number = 4,
  libraryAnalysis?: LibraryAnalysis
): SimilarityResult[] {
  if (icons.length === 0) {
    return [];
  }

  // Score all icons
  const scored = icons.map(icon => scoreIcon(concept, icon, libraryAnalysis));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Take top N, but ensure diversity
  const results: SimilarityResult[] = [];
  const usedCategories = new Set<string>();

  for (const result of scored) {
    if (results.length >= count) break;

    // Try to ensure category diversity
    const category = findCategory(result.icon.name);
    if (category && usedCategories.has(category) && results.length < count - 1) {
      // Skip if we already have an icon from this category (unless we need to fill)
      continue;
    }

    results.push(result);
    if (category) usedCategories.add(category);
  }

  // If we didn't get enough, fill with highest scoring remaining
  if (results.length < count) {
    for (const result of scored) {
      if (results.length >= count) break;
      if (!results.includes(result)) {
        results.push(result);
      }
    }
  }

  return results;
}

/**
 * Find icons that match specific patterns
 */
export function findIconsByPattern(
  patternType: PatternType,
  icons: Icon[],
  libraryAnalysis?: LibraryAnalysis,
  count: number = 3
): Icon[] {
  // If we have library analysis, use pre-computed pattern groups
  if (libraryAnalysis?.examplesByPattern[patternType]) {
    return libraryAnalysis.examplesByPattern[patternType].slice(0, count);
  }

  // Fallback: filter by pattern-related keywords
  const patternKeywords: Record<PatternType, string[]> = {
    'arc-loop': ['bow', 'ribbon', 'infinity', 'heart', 'loop'],
    'container-with-lid': ['gift', 'box', 'package', 'trash', 'chest'],
    'through-line': ['divide', 'split', 'ribbon'],
    'attached-handle': ['cup', 'mug', 'search', 'magnif'],
    'symmetric-pair': ['headphone', 'glasses', 'wing'],
    'concentric-circles': ['target', 'record', 'eye', 'lens'],
    'stacked-lines': ['menu', 'list', 'text', 'steam'],
    'corner-anchored': ['resize', 'expand', 'external'],
  };

  const keywords = patternKeywords[patternType] || [];
  const matching = icons.filter(icon =>
    keywords.some(kw => icon.name.toLowerCase().includes(kw))
  );

  return matching.slice(0, count);
}

/**
 * Format similar icons for prompt inclusion
 */
export function formatSimilarIconsForPrompt(icons: Icon[]): string {
  if (icons.length === 0) {
    return '';
  }

  const formatted = icons.map(icon => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="${icon.path}"/>
</svg>`;
    return `### ${icon.name}\n\`\`\`svg\n${svg}\n\`\`\``;
  });

  return `## REFERENCE EXAMPLES FROM LIBRARY\n\n${formatted.join('\n\n')}`;
}

/**
 * Exemplar icons that demonstrate good SVG construction patterns
 * These are known well-structured icons that serve as excellent few-shot examples
 */
const EXEMPLAR_ICON_NAMES = [
  // Container patterns
  'coffee', 'gift', 'package', 'archive', 'box', 'trash', 'folder',
  // Symmetric patterns
  'headphones', 'glasses', 'eye', 'heart',
  // Device patterns
  'camera', 'phone', 'monitor', 'tablet', 'tv',
  // Shape patterns
  'circle', 'square', 'triangle', 'star', 'hexagon',
  // Tool patterns
  'scissors', 'key', 'anchor', 'umbrella',
  // Nature patterns
  'sun', 'moon', 'cloud', 'feather', 'leaf',
];

/**
 * Find exemplar icons from a library for few-shot learning
 * These are well-constructed icons that demonstrate various patterns,
 * not necessarily semantically similar to the target concept.
 *
 * @param icons - All icons in the library
 * @param count - Number of exemplars to return
 * @param excludeConcept - Concept to avoid (don't include the target itself)
 */
export function findExemplarIcons(
  icons: Icon[],
  count: number = 4,
  excludeConcept?: string
): Icon[] {
  const normalized = excludeConcept?.toLowerCase().replace(/[\s-_]+/g, '') || '';

  // First, try to find known exemplars from the library
  const exemplars: Icon[] = [];
  const usedNames = new Set<string>();

  for (const name of EXEMPLAR_ICON_NAMES) {
    if (exemplars.length >= count) break;

    // Skip if this is the concept we're generating
    if (normalized && name.includes(normalized)) continue;

    // Find icon by name (fuzzy match)
    const match = icons.find(icon => {
      const iconName = icon.name.toLowerCase().replace(/[\s-_]+/g, '');
      return (
        iconName === name ||
        iconName.includes(name) ||
        name.includes(iconName)
      ) && icon.path && !usedNames.has(icon.name);
    });

    if (match) {
      exemplars.push(match);
      usedNames.add(match.name);
    }
  }

  // If we didn't find enough exemplars, add icons with good path diversity
  if (exemplars.length < count) {
    // Sort remaining icons by path length (medium complexity is ideal)
    const remaining = icons
      .filter(i => i.path && !usedNames.has(i.name))
      .sort((a, b) => {
        // Prefer icons with path length between 50-200 characters (medium complexity)
        const aLen = a.path?.length || 0;
        const bLen = b.path?.length || 0;
        const aScore = Math.abs(aLen - 125); // Closer to 125 is better
        const bScore = Math.abs(bLen - 125);
        return aScore - bScore;
      });

    for (const icon of remaining) {
      if (exemplars.length >= count) break;

      // Skip if name matches the concept
      const iconName = icon.name.toLowerCase().replace(/[\s-_]+/g, '');
      if (normalized && (iconName.includes(normalized) || normalized.includes(iconName))) continue;

      exemplars.push(icon);
    }
  }

  return exemplars;
}

/**
 * Score an icon for exemplar quality based on enriched metadata
 * Higher scores = better teaching example
 */
function scoreExemplarQuality(icon: Icon, targetTraits?: GeometricTrait[], targetCategory?: SemanticCategory): number {
  let score = 0;
  const meta = icon.aiMetadata;

  if (!meta) {
    // No enrichment - use path length heuristic (medium is best)
    const pathLen = icon.path?.length || 0;
    score = pathLen > 50 && pathLen < 200 ? 2 : 1;
    return score;
  }

  // Prefer medium complexity (2-3) as these are ideal teaching examples
  if (meta.complexity >= 2 && meta.complexity <= 3) {
    score += 3;
  } else if (meta.complexity === 4) {
    score += 1.5;
  } else if (meta.complexity === 1) {
    score += 1; // Too simple
  }
  // complexity 5 = too complex for exemplar, score stays 0

  // Boost icons that match target traits (most important factor)
  if (targetTraits && meta.geometricTraits) {
    const matchCount = targetTraits.filter(t => meta.geometricTraits.includes(t)).length;
    score += matchCount * 5; // Strong boost for matching traits
  }

  // Boost matching semantic category
  if (targetCategory && meta.semanticCategory === targetCategory) {
    score += 2;
  }

  // Prefer high confidence enrichments
  if (meta.confidence && meta.confidence >= 0.8) {
    score += 1;
  }

  // Bonus for symmetry trait (often produces cleaner examples)
  if (meta.geometricTraits?.includes('symmetry')) {
    score += 0.5;
  }

  // Slight penalty for fine-detail (can confuse simple concepts)
  if (meta.geometricTraits?.includes('fine-detail')) {
    score -= 0.5;
  }

  return score;
}

/**
 * Find exemplar icons using trait-aware selection
 *
 * This improved version:
 * 1. Gets expected traits for the target concept
 * 2. Scores icons based on matching traits, complexity, and quality
 * 3. Selects a diverse set of high-quality teaching examples
 *
 * @param icons - All icons in the library
 * @param count - Number of exemplars to return
 * @param concept - Target concept (to match traits and avoid including itself)
 */
export function findExemplarIconsWithTraits(
  icons: Icon[],
  count: number = 4,
  concept?: string
): Icon[] {
  const normalized = concept?.toLowerCase().replace(/[\s-_]+/g, '') || '';

  // Get expected traits for this concept
  const hints = concept ? getConceptHints(concept) : {};
  const targetTraits = hints.traits;
  const targetCategory = hints.category;

  // Filter valid icons and exclude the concept itself
  const validIcons = icons.filter(icon => {
    if (!icon.path) return false;
    const iconName = icon.name.toLowerCase().replace(/[\s-_]+/g, '');
    if (normalized && (iconName.includes(normalized) || normalized.includes(iconName))) return false;
    return true;
  });

  // Score all icons for exemplar quality
  const scored = validIcons.map(icon => ({
    icon,
    score: scoreExemplarQuality(icon, targetTraits, targetCategory),
    hasMatchingTraits: targetTraits && icon.aiMetadata?.geometricTraits?.some(t => targetTraits.includes(t)) || false,
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select exemplars with diversity in mind
  const selected: Icon[] = [];
  const usedTraits = new Set<string>();
  const usedCategories = new Set<string>();

  for (const { icon, hasMatchingTraits } of scored) {
    if (selected.length >= count) break;

    const meta = icon.aiMetadata;

    // For the first selection, prioritize matching traits
    if (selected.length === 0 && targetTraits) {
      if (hasMatchingTraits) {
        selected.push(icon);
        if (meta?.geometricTraits) {
          meta.geometricTraits.forEach(t => usedTraits.add(t));
        }
        if (meta?.semanticCategory) {
          usedCategories.add(meta.semanticCategory);
        }
        continue;
      }
    }

    // For subsequent selections, prefer diversity
    let isDiverse = true;
    if (meta?.semanticCategory && usedCategories.has(meta.semanticCategory)) {
      // Already have this category - less diverse, but still consider if high scoring
      if (usedCategories.size >= 2) {
        isDiverse = false;
      }
    }

    if (isDiverse || selected.length < count - 1) {
      selected.push(icon);
      if (meta?.geometricTraits) {
        meta.geometricTraits.forEach(t => usedTraits.add(t));
      }
      if (meta?.semanticCategory) {
        usedCategories.add(meta.semanticCategory);
      }
    }
  }

  // Fill remaining slots with highest-scoring unused icons
  if (selected.length < count) {
    for (const { icon } of scored) {
      if (selected.length >= count) break;
      if (!selected.includes(icon)) {
        selected.push(icon);
      }
    }
  }

  return selected;
}

/**
 * Format icon with rich context for few-shot prompts
 *
 * Includes semantic category, complexity, and traits to help LLM understand WHY
 * this example is relevant and what patterns it demonstrates.
 */
export function formatIconWithContext(icon: Icon): string {
  const meta = icon.aiMetadata;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="${icon.path}" fill="none"/>
</svg>`;

  // Build context annotation
  const annotations: string[] = [];

  if (meta) {
    annotations.push(meta.semanticCategory);
    annotations.push(`complexity=${meta.complexity}`);
    if (meta.geometricTraits?.length) {
      annotations.push(meta.geometricTraits.join(', '));
    }
  }

  const contextLine = annotations.length > 0
    ? ` [${annotations.join(', ')}]`
    : '';

  // Add description if available
  const descLine = icon.aiDescription
    ? `\n_${icon.aiDescription}_`
    : '';

  return `### ${icon.name}${contextLine}${descLine}\n\`\`\`svg\n${svg}\n\`\`\``;
}

/**
 * Format similar icons with rich context for prompt inclusion
 * This version includes semantic metadata to help the LLM understand patterns
 */
export function formatSimilarIconsWithContext(icons: Icon[]): string {
  if (icons.length === 0) {
    return '';
  }

  const formatted = icons.map(icon => formatIconWithContext(icon));

  return `## REFERENCE EXAMPLES FROM LIBRARY\n\nStudy these examples to understand the icon style and patterns:\n\n${formatted.join('\n\n')}`;
}
