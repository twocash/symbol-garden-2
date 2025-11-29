/**
 * Kitbash Engine - Assembly from existing components
 *
 * Part of the Sprout Engine (F4)
 *
 * Philosophy: Assemble icons from proven parts instead of generating from scratch.
 * LLMs are good at concepts but bad at precise geometry. The Kitbash Engine
 * leverages existing library components to create mathematically identical results.
 *
 * Process:
 * 1. Decompose concept into required parts (e.g., "secure user" → ["user", "shield"])
 * 2. Search component index for matches
 * 3. Calculate coverage (% of parts found)
 * 4. If coverage > 70%: GRAFT (mechanical assembly)
 * 5. If coverage < 70%: HYBRID (AI fills gaps)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Icon
 } from '@/types/schema';
import { IconComponent, searchComponents, findByCategory } from './component-indexer';
import { getDecomposition, Decomposition } from './decomposition-service';
import { enforceStyle, EnforcementRules, FEATHER_RULES } from './style-enforcer';

/**
 * Assembly strategy based on component coverage
 */
export type AssemblyStrategy =
  | 'graft'    // 100% parts found, pure mechanical assembly
  | 'hybrid'   // Some parts found, AI fills gaps
  | 'generate' // No parts found, full AI generation
  | 'adapt';   // Single part found, modify existing

/**
 * Transform to apply to a component
 */
export interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
  rotate?: number;
}

/**
 * Position for a component in a layout
 */
export interface Position {
  x: number;
  y: number;
  scale: number;
  zIndex: number;
}

/**
 * A matched component from the library
 */
export interface KitbashMatch {
  /** What we're looking for */
  partName: string;
  /** Source icon ID */
  sourceIcon: string;
  /** The actual component */
  component: IconComponent;
  /** Match confidence 0-1 */
  confidence: number;
  /** Transform needed to fit in composition */
  transformRequired: Transform;
}

/**
 * Skeleton layout options for composing parts
 */
export interface SkeletonLayout {
  /** Layout name (e.g., "shield-behind", "badge-corner") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Where each part goes (partName → position) */
  positions: Record<string, Position>;
  /** Simple wireframe SVG preview */
  preview?: string;
}

/**
 * A plan for assembling an icon from existing parts
 */
export interface KitbashPlan {
  /** Original concept */
  concept: string;
  /** Parts we need */
  requiredParts: string[];
  /** Parts we found in the library */
  foundParts: KitbashMatch[];
  /** Parts we couldn't find (AI must generate) */
  missingParts: string[];
  /** Coverage ratio 0-1 */
  coverage: number;
  /** Strategy based on coverage */
  strategy: AssemblyStrategy;
  /** Suggested layout options */
  suggestedLayouts: SkeletonLayout[];
  /** Decomposition used */
  decomposition: Decomposition | null;
}

/**
 * Result of executing a kitbash plan
 */
export interface KitbashResult {
  /** The assembled SVG */
  svg: string;
  /** Plan that was executed */
  plan: KitbashPlan;
  /** Which layout was used */
  layout: SkeletonLayout;
  /** Whether AI generation was needed */
  usedGeneration: boolean;
  /** Parts that were generated (if hybrid) */
  generatedParts: string[];
}

/**
 * Find component matches for a part name
 */
function findComponentMatches(
  partName: string,
  componentIndex: Map<string, IconComponent[]>
): IconComponent[] {
  // Direct search
  const direct = searchComponents(componentIndex, partName);
  if (direct.length > 0) {
    return direct;
  }

  // Try variations
  const variations = [
    partName.toLowerCase(),
    `${partName}-body`,
    `${partName}-outline`,
    `${partName}-icon`,
    partName.replace(/-/g, ' '),
  ];

  for (const variation of variations) {
    const matches = searchComponents(componentIndex, variation);
    if (matches.length > 0) {
      return matches;
    }
  }

  return [];
}

/**
 * Select the best match from candidates
 */
function selectBestMatch(
  partName: string,
  candidates: IconComponent[]
): KitbashMatch {
  // Score candidates by relevance
  const scored = candidates.map(comp => {
    let score = 0;

    // Exact name match
    if (comp.name.toLowerCase() === partName.toLowerCase()) {
      score += 100;
    }

    // Contains part name
    if (comp.name.toLowerCase().includes(partName.toLowerCase())) {
      score += 50;
    }

    // Semantic tag match
    for (const tag of comp.semanticTags) {
      if (tag.toLowerCase().includes(partName.toLowerCase())) {
        score += 25;
      }
    }

    // Prefer body/container categories for main parts
    if (comp.category === 'body' || comp.category === 'container') {
      score += 10;
    }

    // Higher weight = more prominent component
    score += comp.weight * 20;

    return { component: comp, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  const confidence = Math.min(1, best.score / 150); // Normalize to 0-1

  return {
    partName,
    sourceIcon: best.component.sourceIcon,
    component: best.component,
    confidence,
    transformRequired: { scale: 1, translateX: 0, translateY: 0 },
  };
}

/**
 * Generate layout suggestions using LLM
 */
async function generateLayouts(
  concept: string,
  parts: KitbashMatch[],
  apiKey?: string
): Promise<SkeletonLayout[]> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;

  // Default layouts if no API key
  if (!resolvedApiKey) {
    return getDefaultLayouts(parts);
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const partNames = parts.map(p => p.partName).join(', ');
  const partInfo = parts.map(p => {
    const bbox = p.component.boundingBox;
    return `- ${p.partName}: ${bbox.width.toFixed(0)}×${bbox.height.toFixed(0)} at (${bbox.centerX.toFixed(0)}, ${bbox.centerY.toFixed(0)})`;
  }).join('\n');

  const prompt = `You are an icon composition expert. Given these components for the concept "${concept}":

${partInfo}

The canvas is 24×24 with 2px padding (usable area: 2-22).

Suggest 3 different spatial arrangements:
1. A conservative, common layout (how most icon sets would arrange these)
2. A compact, badge-style layout (one element as background, other as foreground)
3. A creative, distinctive layout (unique but still recognizable)

For each layout, specify:
- name: short identifier (e.g., "standard", "badge", "overlay")
- description: one sentence explanation
- positions: for each part, give x, y (center point), scale (0.3-1.0), zIndex (0=back, 1=front)

Respond with valid JSON only:
{
  "layouts": [
    {
      "name": "standard",
      "description": "Parts arranged side by side",
      "positions": {
        "user": { "x": 8, "y": 12, "scale": 0.7, "zIndex": 1 },
        "shield": { "x": 16, "y": 12, "scale": 0.7, "zIndex": 0 }
      }
    }
  ]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.layouts || []).map((l: any) => ({
      name: l.name || 'unknown',
      description: l.description || '',
      positions: l.positions || {},
    }));
  } catch (error) {
    console.error('[Kitbash] Error generating layouts:', error);
    return getDefaultLayouts(parts);
  }
}

/**
 * Get default layouts when LLM is unavailable
 */
function getDefaultLayouts(parts: KitbashMatch[]): SkeletonLayout[] {
  const layouts: SkeletonLayout[] = [];

  if (parts.length === 0) {
    return layouts;
  }

  if (parts.length === 1) {
    // Single part - center it
    layouts.push({
      name: 'centered',
      description: 'Component centered in canvas',
      positions: {
        [parts[0].partName]: { x: 12, y: 12, scale: 0.9, zIndex: 0 },
      },
    });
    return layouts;
  }

  if (parts.length === 2) {
    const [p1, p2] = parts;

    // Standard: side by side
    layouts.push({
      name: 'side-by-side',
      description: 'Components arranged horizontally',
      positions: {
        [p1.partName]: { x: 8, y: 12, scale: 0.6, zIndex: 0 },
        [p2.partName]: { x: 16, y: 12, scale: 0.6, zIndex: 1 },
      },
    });

    // Badge: one behind, one in front
    layouts.push({
      name: 'badge',
      description: 'Second component as badge on first',
      positions: {
        [p1.partName]: { x: 10, y: 12, scale: 0.8, zIndex: 0 },
        [p2.partName]: { x: 17, y: 17, scale: 0.4, zIndex: 1 },
      },
    });

    // Overlay: centered overlap
    layouts.push({
      name: 'overlay',
      description: 'Components overlapping in center',
      positions: {
        [p1.partName]: { x: 12, y: 12, scale: 0.7, zIndex: 0 },
        [p2.partName]: { x: 12, y: 12, scale: 0.5, zIndex: 1 },
      },
    });
  }

  if (parts.length >= 3) {
    const positions: Record<string, Position> = {};
    const angle = (2 * Math.PI) / parts.length;

    parts.forEach((p, i) => {
      const x = 12 + Math.cos(angle * i - Math.PI / 2) * 6;
      const y = 12 + Math.sin(angle * i - Math.PI / 2) * 6;
      positions[p.partName] = { x, y, scale: 0.5, zIndex: i };
    });

    layouts.push({
      name: 'radial',
      description: 'Components arranged in a circle',
      positions,
    });
  }

  return layouts;
}

/**
 * Transform SVG path data
 */
function transformPathData(
  pathData: string,
  transform: Transform,
  position: Position,
  originalBbox: { centerX: number; centerY: number; width: number; height: number }
): string {
  // Calculate the actual transform needed
  const targetScale = position.scale * transform.scale;
  const targetX = position.x;
  const targetY = position.y;

  // Calculate offset from original center to target center
  const offsetX = targetX - originalBbox.centerX * targetScale;
  const offsetY = targetY - originalBbox.centerY * targetScale;

  // Apply transform to path commands
  // This is a simplified approach - real implementation would parse and transform each command
  const transformed = pathData.replace(
    /(-?\d+\.?\d*)/g,
    (match, num, offset, str) => {
      const value = parseFloat(num);
      // Determine if this is an x or y coordinate based on position in command
      // This is a rough heuristic - proper SVG parsing would be more accurate
      const prevChar = str[offset - 1] || '';
      const isY = /[VvMmLlCcSsQqTtAa]/.test(prevChar) &&
                  str.slice(0, offset).split(/[VvMmLlCcSsQqTtAa]/).pop()?.split(/[\s,]+/).filter(Boolean).length! % 2 === 0;

      if (isY) {
        return String((value * targetScale + offsetY).toFixed(2));
      } else {
        return String((value * targetScale + offsetX).toFixed(2));
      }
    }
  );

  return transformed;
}

/**
 * Build SVG from positioned components
 */
function buildSvgFromComponents(
  parts: KitbashMatch[],
  layout: SkeletonLayout,
  rules: EnforcementRules
): string {
  // Sort by zIndex
  const sortedParts = [...parts].sort((a, b) => {
    const posA = layout.positions[a.partName];
    const posB = layout.positions[b.partName];
    return (posA?.zIndex || 0) - (posB?.zIndex || 0);
  });

  let paths = '';

  for (const part of sortedParts) {
    const position = layout.positions[part.partName];
    if (!position) continue;

    // For now, we'll use a transform attribute instead of modifying path data
    // This is more reliable and preserves the original path accuracy
    const bbox = part.component.boundingBox;
    const scaleX = position.scale;
    const scaleY = position.scale;

    // Calculate transform to move component to target position
    const translateX = position.x - bbox.centerX * scaleX;
    const translateY = position.y - bbox.centerY * scaleY;

    const transformAttr = `transform="translate(${translateX.toFixed(2)}, ${translateY.toFixed(2)}) scale(${scaleX.toFixed(2)})"`;

    if (part.component.elementType === 'path') {
      paths += `<path d="${part.component.pathData}" ${transformAttr} />\n`;
    } else if (part.component.elementType === 'circle') {
      paths += `<circle ${part.component.pathData} ${transformAttr} />\n`;
    } else if (part.component.elementType === 'rect') {
      paths += `<rect ${part.component.pathData} ${transformAttr} />\n`;
    } else if (part.component.elementType === 'line') {
      paths += `<line ${part.component.pathData} ${transformAttr} />\n`;
    }
  }

  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${rules.strokeWidth || 2}" stroke-linecap="${rules.strokeLinecap || 'round'}" stroke-linejoin="${rules.strokeLinejoin || 'round'}" xmlns="http://www.w3.org/2000/svg">
${paths}</svg>`;

  return svg;
}

/**
 * Generate missing parts using AI
 */
async function generateMissingParts(
  concept: string,
  missingParts: string[],
  existingParts: KitbashMatch[],
  layout: SkeletonLayout,
  apiKey?: string
): Promise<string> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    console.warn('[Kitbash] No API key for generating missing parts');
    return '';
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const existingInfo = existingParts.map(p => {
    const pos = layout.positions[p.partName];
    return `- ${p.partName}: positioned at (${pos?.x || 12}, ${pos?.y || 12}), scale ${pos?.scale || 1}`;
  }).join('\n');

  const missingInfo = missingParts.map(name => {
    const pos = layout.positions[name];
    return `- ${name}: should be at (${pos?.x || 12}, ${pos?.y || 12}), scale ${pos?.scale || 1}`;
  }).join('\n');

  const prompt = `Generate SVG path(s) for missing icon components.

Concept: "${concept}"

Already have these components positioned:
${existingInfo}

Need to generate:
${missingInfo}

Style requirements:
- stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
- Coordinate range: 0-24 (with 2px padding)
- Simple, clean strokes - no fills

Return ONLY the <path> elements needed, one per missing part.
Example: <path d="M12 2v4" />`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const text = result.response.text().trim();
    // Extract path elements
    const pathMatches = text.match(/<path[^>]*\/>/g);
    return pathMatches ? pathMatches.join('\n') : '';
  } catch (error) {
    console.error('[Kitbash] Error generating missing parts:', error);
    return '';
  }
}

/**
 * Plan how to assemble an icon from concept
 */
export async function planKitbash(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  apiKey?: string
): Promise<KitbashPlan> {
  // 1. Decompose concept into required parts
  const decomposition = await getDecomposition(concept, 'auto', [], apiKey);

  let requiredParts: string[] = [];
  if (decomposition && decomposition.components.length > 0) {
    requiredParts = decomposition.components.map(c => c.name);
  } else {
    // Fallback: try to extract parts from concept
    requiredParts = concept.toLowerCase().split(/[\s-_]+/).filter(p => p.length > 2);
  }

  console.log(`[Kitbash] Planning "${concept}" with required parts:`, requiredParts);

  // 2. Search library for each part
  const foundParts: KitbashMatch[] = [];
  const missingParts: string[] = [];

  for (const partName of requiredParts) {
    const matches = findComponentMatches(partName, componentIndex);
    if (matches.length > 0) {
      foundParts.push(selectBestMatch(partName, matches));
    } else {
      missingParts.push(partName);
    }
  }

  // 3. Calculate coverage
  const coverage = requiredParts.length > 0
    ? foundParts.length / requiredParts.length
    : 0;

  // 4. Determine strategy
  let strategy: AssemblyStrategy;
  if (coverage >= 0.9) {
    strategy = 'graft';
  } else if (coverage >= 0.5) {
    strategy = 'hybrid';
  } else if (foundParts.length === 1) {
    strategy = 'adapt';
  } else {
    strategy = 'generate';
  }

  console.log(`[Kitbash] Coverage: ${(coverage * 100).toFixed(0)}%, Strategy: ${strategy}`);

  // 5. Generate layout suggestions
  const suggestedLayouts = await generateLayouts(concept, foundParts, apiKey);

  return {
    concept,
    requiredParts,
    foundParts,
    missingParts,
    coverage,
    strategy,
    suggestedLayouts,
    decomposition,
  };
}

/**
 * Execute a kitbash plan to produce an SVG
 */
export async function executeKitbash(
  plan: KitbashPlan,
  layoutIndex: number = 0,
  rules: EnforcementRules = FEATHER_RULES,
  apiKey?: string
): Promise<KitbashResult> {
  const layout = plan.suggestedLayouts[layoutIndex] || plan.suggestedLayouts[0];

  if (!layout) {
    throw new Error('No layout available for kitbash');
  }

  console.log(`[Kitbash] Executing with layout "${layout.name}"`);

  let svg: string;
  let usedGeneration = false;
  const generatedParts: string[] = [];

  if (plan.strategy === 'graft') {
    // Pure mechanical assembly
    svg = buildSvgFromComponents(plan.foundParts, layout, rules);
  } else if (plan.strategy === 'hybrid') {
    // Build what we have, generate the rest
    svg = buildSvgFromComponents(plan.foundParts, layout, rules);

    const generated = await generateMissingParts(
      plan.concept,
      plan.missingParts,
      plan.foundParts,
      layout,
      apiKey
    );

    if (generated) {
      // Insert generated paths before closing </svg>
      svg = svg.replace('</svg>', `${generated}\n</svg>`);
      usedGeneration = true;
      generatedParts.push(...plan.missingParts);
    }
  } else {
    // Full generation - return empty svg (caller should use hybrid-generator)
    svg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"></svg>';
    usedGeneration = true;
    generatedParts.push(...plan.requiredParts);
  }

  // Apply style enforcement
  const compliance = enforceStyle(svg, rules);
  svg = compliance.autoFixed;

  return {
    svg,
    plan,
    layout,
    usedGeneration,
    generatedParts,
  };
}

/**
 * One-shot kitbash: plan and execute in one call
 */
export async function kitbash(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  options: {
    layoutIndex?: number;
    rules?: EnforcementRules;
    apiKey?: string;
  } = {}
): Promise<KitbashResult> {
  const plan = await planKitbash(concept, componentIndex, options.apiKey);
  return executeKitbash(
    plan,
    options.layoutIndex || 0,
    options.rules || FEATHER_RULES,
    options.apiKey
  );
}

/**
 * Check if a concept is kitbashable (has sufficient coverage)
 */
export async function isKitbashable(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  apiKey?: string
): Promise<{ kitbashable: boolean; coverage: number; strategy: AssemblyStrategy }> {
  const plan = await planKitbash(concept, componentIndex, apiKey);
  return {
    kitbashable: plan.strategy !== 'generate',
    coverage: plan.coverage,
    strategy: plan.strategy,
  };
}

/**
 * Format kitbash plan for logging/display
 */
export function formatKitbashPlan(plan: KitbashPlan): string {
  const lines: string[] = [];

  lines.push(`Concept: ${plan.concept}`);
  lines.push(`Strategy: ${plan.strategy.toUpperCase()} (${(plan.coverage * 100).toFixed(0)}% coverage)`);
  lines.push('');

  if (plan.foundParts.length > 0) {
    lines.push('Found Parts:');
    for (const part of plan.foundParts) {
      lines.push(`  ✓ ${part.partName} (${(part.confidence * 100).toFixed(0)}% confidence) from ${part.sourceIcon}`);
    }
  }

  if (plan.missingParts.length > 0) {
    lines.push('Missing Parts:');
    for (const part of plan.missingParts) {
      lines.push(`  ✗ ${part}`);
    }
  }

  if (plan.suggestedLayouts.length > 0) {
    lines.push('');
    lines.push('Suggested Layouts:');
    for (const layout of plan.suggestedLayouts) {
      lines.push(`  • ${layout.name}: ${layout.description}`);
    }
  }

  return lines.join('\n');
}
