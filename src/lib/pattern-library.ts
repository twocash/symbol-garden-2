/**
 * Pattern Library - Reusable SVG construction patterns for icon generation
 *
 * These patterns teach the LLM common idioms for constructing Feather-style icons.
 * Each pattern includes:
 * - Description of when to use it
 * - Example SVG syntax
 * - Key rules for correct implementation
 */

export type PatternType =
  | 'arc-loop'
  | 'container-with-lid'
  | 'through-line'
  | 'attached-handle'
  | 'symmetric-pair'
  | 'concentric-circles'
  | 'stacked-lines'
  | 'corner-anchored';

export interface Pattern {
  type: PatternType;
  name: string;
  description: string;
  example: string;
  rules: string[];
}

/**
 * Core pattern definitions for Feather-style icons
 */
export const PATTERNS: Pattern[] = [
  {
    type: 'arc-loop',
    name: 'Arc Loop',
    description: 'Decorative loops like bows, flourishes, or infinity curves',
    example: `M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z`,
    rules: [
      'Use arc notation: a<rx> <ry> <angle> <large-arc> <sweep> <dx> <dy>',
      'Start from connection point, arc outward, curve back',
      'Close with z or return to start point',
    ],
  },
  {
    type: 'container-with-lid',
    name: 'Container with Lid',
    description: 'Two-part containers like gift boxes, trash cans, packages',
    example: `Lid: M2 7h20v5H2z\nBody: M4 12v10h16V12`,
    rules: [
      'Lid is slightly wider than body',
      'Lid and body share a y-coordinate at connection',
      'Body is often U-shaped (open top) or closed rect',
    ],
  },
  {
    type: 'through-line',
    name: 'Through Line',
    description: 'Lines that visually pass through shapes (ribbons, seams, dividers)',
    example: `<line x1="12" y1="7" x2="12" y2="22"/>`,
    rules: [
      'Intentionally "pierces" other elements',
      'Creates visual continuity with same-color strokes',
      'Often used for ribbons, centerlines, or structural elements',
    ],
  },
  {
    type: 'attached-handle',
    name: 'Attached Handle',
    description: 'Handles or appendages connected to main bodies (cups, bags, magnifiers)',
    example: `Body ends at x=17\nHandle: M17 8h1a4 4 0 1 1 0 8h-1`,
    rules: [
      'Handle starts where body ends (same coordinate)',
      'They are SEPARATE path elements',
      'No visual overlap - they share a point, not an edge',
    ],
  },
  {
    type: 'symmetric-pair',
    name: 'Symmetric Pair',
    description: 'Mirrored elements like headphone earcups, wings, parentheses',
    example: `Left: M3 19a2 2 0 0 0 2 2h1...\nRight: M21 19a2 2 0 0 1-2 2h-1...`,
    rules: [
      'Mirror x-coordinates around center (x=12)',
      'Swap arc sweep direction (0↔1)',
      'Keep y-coordinates identical',
    ],
  },
  {
    type: 'concentric-circles',
    name: 'Concentric Circles',
    description: 'Nested circles like targets, eyes, record discs, camera lenses',
    example: `<circle cx="12" cy="12" r="10"/>\n<circle cx="12" cy="12" r="6"/>\n<circle cx="12" cy="12" r="2"/>`,
    rules: [
      'All circles share same center point',
      'Use <circle> elements, not path arcs',
      'Maintain consistent spacing between rings',
    ],
  },
  {
    type: 'stacked-lines',
    name: 'Stacked Lines',
    description: 'Parallel lines like menu icons, text representations, steam',
    example: `<line x1="6" y1="2" x2="6" y2="4"/>\n<line x1="10" y1="2" x2="10" y2="4"/>\n<line x1="14" y1="2" x2="14" y2="4"/>`,
    rules: [
      'Use <line> elements for simple straight lines',
      'Maintain consistent spacing',
      'Keep parallel (same y-coords for horizontal, same x-coords for vertical)',
    ],
  },
  {
    type: 'corner-anchored',
    name: 'Corner Anchored',
    description: 'Elements anchored to corners like resize handles, arrows pointing to corners',
    example: `<polyline points="15 3 21 3 21 9"/>\n<line x1="10" y1="14" x2="21" y2="3"/>`,
    rules: [
      'Anchor points at canvas corners or near edges',
      'Common coordinates: (3,3), (21,3), (3,21), (21,21)',
      'Use polyline for multi-segment corner shapes',
    ],
  },
];

/**
 * Format the pattern library for inclusion in prompts
 */
export function formatPatternLibrary(): string {
  const sections = PATTERNS.map(p => {
    const rulesText = p.rules.map(r => `  - ${r}`).join('\n');
    return `### ${p.name}
**Use for**: ${p.description}
**Example**:
\`\`\`
${p.example}
\`\`\`
**Rules**:
${rulesText}`;
  });

  return `## SVG CONSTRUCTION PATTERNS

${sections.join('\n\n')}`;
}

/**
 * Get patterns relevant to a specific icon concept
 * Uses keyword matching to suggest applicable patterns
 */
export function getSuggestedPatterns(concept: string, tags?: string[]): Pattern[] {
  const text = `${concept} ${(tags || []).join(' ')}`.toLowerCase();

  const suggestions: Pattern[] = [];

  // Arc loop patterns
  if (/bow|ribbon|infinity|heart|loop|flourish|decorat/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'arc-loop')!);
  }

  // Container with lid
  if (/gift|box|package|trash|bin|container|chest/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'container-with-lid')!);
  }

  // Through line
  if (/ribbon|seam|divide|split|cross|center/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'through-line')!);
  }

  // Attached handle
  if (/cup|mug|bag|magnif|search|pan|pot|bucket/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'attached-handle')!);
  }

  // Symmetric pair
  if (/headphone|wing|ear|glasses|binocular|parenthes/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'symmetric-pair')!);
  }

  // Concentric circles
  if (/target|eye|record|disc|lens|camera|bullseye|radio/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'concentric-circles')!);
  }

  // Stacked lines
  if (/menu|hamburger|list|text|steam|signal|wifi/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'stacked-lines')!);
  }

  // Corner anchored
  if (/resize|expand|maximize|external|arrow.*corner/.test(text)) {
    suggestions.push(PATTERNS.find(p => p.type === 'corner-anchored')!);
  }

  return suggestions;
}

/**
 * Get a specific pattern by type
 */
export function getPattern(type: PatternType): Pattern | undefined {
  return PATTERNS.find(p => p.type === type);
}
