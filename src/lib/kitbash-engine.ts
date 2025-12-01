/**
 * Kitbash Engine - Assembly from existing components
 *
 * Part of the Sprout Engine (F4)
 * Sprint 07: Enhanced with Blueprint Protocol (Geometric Intelligence)
 *
 * Philosophy: Assemble icons from proven parts instead of generating from scratch.
 * LLMs are good at concepts but bad at precise geometry. The Kitbash Engine
 * leverages existing library components to create mathematically identical results.
 *
 * Process:
 * 1. Decompose concept into geometric primitives (e.g., "rocket" → [capsule, triangle, triangle])
 * 2. Search component index for matching SHAPES (not names)
 * 3. Calculate coverage (% of primitives found)
 * 4. If coverage > 70%: GRAFT (mechanical assembly)
 * 5. If coverage < 70%: HYBRID (AI fills gaps)
 *
 * Sprint 07 Changes:
 * - Uses getGeometricDecomposition() for shape-based planning
 * - Searches by geometric type (capsule, triangle, etc.)
 * - Assembly uses Blueprint constraints
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Icon, GeometricType } from '@/types/schema';
import { IconComponent, searchComponents, findByCategory, findByGeometry } from './component-indexer';
import { getDecomposition, Decomposition, getGeometricDecomposition, Blueprint, GeometricPrimitive, formatBlueprint } from './decomposition-service';
import { enforceStyle, EnforcementRules, FEATHER_RULES } from './style-enforcer';

/**
 * Common icon names found in libraries - used for LLM guidance
 */
const COMMON_ICON_PARTS = [
  // Objects
  'user', 'users', 'person', 'home', 'house', 'building', 'office',
  'file', 'folder', 'document', 'book', 'notebook', 'clipboard',
  'lock', 'unlock', 'key', 'shield', 'security',
  'box', 'package', 'archive', 'briefcase', 'suitcase', 'bag',
  'mail', 'envelope', 'message', 'chat', 'comment', 'inbox',
  'phone', 'smartphone', 'tablet', 'laptop', 'monitor', 'desktop',
  'camera', 'image', 'photo', 'video', 'film', 'music',
  'clock', 'time', 'calendar', 'alarm', 'bell', 'notification',
  'cart', 'shopping', 'basket', 'credit-card', 'wallet', 'money',
  'heart', 'star', 'bookmark', 'flag', 'tag', 'label',
  'settings', 'gear', 'cog', 'sliders', 'tool', 'wrench',
  'search', 'zoom', 'filter', 'sort', 'eye', 'view',
  'cloud', 'sun', 'moon', 'globe', 'map', 'location', 'pin',
  'rocket', 'plane', 'car', 'truck', 'ship', 'train', 'bicycle',
  'brain', 'lightbulb', 'idea', 'puzzle', 'target', 'award',
  // Symbols
  'check', 'checkmark', 'x', 'close', 'plus', 'minus', 'add', 'remove',
  'arrow', 'chevron', 'caret', 'expand', 'collapse', 'refresh', 'sync',
  'download', 'upload', 'share', 'send', 'external', 'link',
  'edit', 'pencil', 'pen', 'trash', 'delete', 'copy', 'paste',
  'play', 'pause', 'stop', 'skip', 'forward', 'backward',
  // Containers
  'circle', 'square', 'triangle', 'hexagon', 'badge', 'frame',
];

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
 * Identify which library icons could be combined to create a new concept
 * Returns searchable icon names like ["briefcase", "lock"] not literal parts like ["case_body", "keyhole"]
 */
async function identifySourceIcons(
  concept: string,
  availableIcons: string[],
  apiKey?: string
): Promise<string[]> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    // Fallback: try to extract searchable terms from concept
    return concept.toLowerCase().split(/[\s-_]+/).filter(p =>
      p.length > 2 && COMMON_ICON_PARTS.includes(p)
    );
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Show available icons to help LLM make realistic suggestions
  const availableList = availableIcons.length > 0
    ? `\n\nAVAILABLE ICONS IN LIBRARY:\n${availableIcons.slice(0, 100).join(', ')}`
    : '';

  const prompt = `You are an icon composition expert. Given the concept "${concept}", identify which EXISTING icons from a typical icon library could be combined to create it.

IMPORTANT: Return common, generic icon names that would exist in most icon libraries. NOT literal part descriptions.

Examples:
- "secure user" → ["user", "shield"] or ["user", "lock"]
- "download folder" → ["folder", "arrow-down"] or ["folder", "download"]
- "video camera" → ["camera", "video"] or ["film", "camera"]
- "email notification" → ["mail", "bell"] or ["envelope", "notification"]
- "locked briefcase" → ["briefcase", "lock"]
- "cloud storage" → ["cloud", "database"] or ["cloud", "server"]
- "brain with lightbulb" → ["brain", "lightbulb"]
${availableList}

COMMON ICON NAMES TO USE:
${COMMON_ICON_PARTS.join(', ')}

For "${concept}", list 2-4 icon names that could be combined.
Return ONLY a JSON array of strings, no explanation:
["icon1", "icon2"]`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const text = result.response.text().trim();
    const arrayMatch = text.match(/\[[\s\S]*?\]/);
    if (!arrayMatch) {
      throw new Error('No JSON array in response');
    }

    const parsed = JSON.parse(arrayMatch[0]);
    console.log(`[Kitbash] Identified source icons for "${concept}":`, parsed);
    return parsed.filter((s: any) => typeof s === 'string');
  } catch (error) {
    console.error('[Kitbash] Error identifying source icons:', error);
    // Fallback to simple word extraction
    return concept.toLowerCase().split(/[\s-_]+/).filter(p =>
      p.length > 2 && COMMON_ICON_PARTS.includes(p)
    );
  }
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
  missingParts: string[] = [],
  apiKey?: string
): Promise<SkeletonLayout[]> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;

  // All part names (found + missing) for layout generation
  const allPartNames = [...parts.map(p => p.partName), ...missingParts];

  // Default layouts if no API key
  if (!resolvedApiKey) {
    return getDefaultLayouts(parts, missingParts);
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const partInfo = parts.map(p => {
    const bbox = p.component.boundingBox;
    return `- ${p.partName} (found): ${bbox.width.toFixed(0)}×${bbox.height.toFixed(0)} at (${bbox.centerX.toFixed(0)}, ${bbox.centerY.toFixed(0)})`;
  }).join('\n');

  const missingInfo = missingParts.length > 0
    ? `\n\nMissing parts (will be AI-generated, need positions):\n${missingParts.map(p => `- ${p}`).join('\n')}`
    : '';

  // Build list of all part names that need positions
  const allPartsForPrompt = allPartNames.join(', ');

  const prompt = `You are an icon composition expert. Create layouts for the concept "${concept}".

Components available:
${partInfo}${missingInfo}

IMPORTANT: You must provide positions for ALL these parts: ${allPartsForPrompt}

The canvas is 24×24 with 2px padding (usable area: 2-22).

Suggest 3 different spatial arrangements:
1. A conservative, common layout (how most icon sets would arrange these)
2. A compact, badge-style layout (one element as background, other as foreground)
3. A creative, distinctive layout (unique but still recognizable)

For each layout, specify:
- name: short identifier (e.g., "standard", "badge", "overlay")
- description: one sentence explanation
- positions: for EVERY part (${allPartsForPrompt}), give x, y (center point), scale (0.3-1.0), zIndex (0=back, 1=front)

Respond with valid JSON only:
{
  "layouts": [
    {
      "name": "standard",
      "description": "Parts arranged side by side",
      "positions": {
        "${allPartNames[0] || 'part1'}": { "x": 8, "y": 12, "scale": 0.7, "zIndex": 0 },
        "${allPartNames[1] || 'part2'}": { "x": 16, "y": 12, "scale": 0.5, "zIndex": 1 }
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
    return getDefaultLayouts(parts, missingParts);
  }
}

/**
 * Get default layouts when LLM is unavailable
 * Sprint 07: Uses position hints from blueprint primitives for smarter layouts
 */
function getDefaultLayouts(parts: KitbashMatch[], missingParts: string[] = []): SkeletonLayout[] {
  const layouts: SkeletonLayout[] = [];

  // Combine found and missing part names
  const allPartNames = [...parts.map(p => p.partName), ...missingParts];
  const totalParts = allPartNames.length;

  if (totalParts === 0) {
    return layouts;
  }

  if (totalParts === 1) {
    // Single part - center it
    layouts.push({
      name: 'centered',
      description: 'Component centered in canvas',
      positions: {
        [allPartNames[0]]: { x: 12, y: 12, scale: 0.9, zIndex: 0 },
      },
    });
    return layouts;
  }

  // Sprint 07: Parse position hints from part names (e.g., "body (capsule)" with position: 'center')
  // For now, use a simple heuristic based on role names
  const hasRocketLikeStructure = allPartNames.some(n => n.includes('body') || n.includes('case')) &&
                                   allPartNames.some(n => n.includes('nose') || n.includes('top') || n.includes('terminal')) ||
                                   allPartNames.some(n => n.includes('fins') || n.includes('bottom') || n.includes('base'));

  if (hasRocketLikeStructure && totalParts >= 2) {
    // Rocket-like: vertical structure with body in center, attachments top/bottom
    const positions: Record<string, Position> = {};

    for (const name of allPartNames) {
      const lowerName = name.toLowerCase();

      if (lowerName.includes('body') || lowerName.includes('case') || lowerName.includes('screen')) {
        // Main body: center, large
        positions[name] = { x: 12, y: 13, scale: 0.45, zIndex: 0 };
      } else if (lowerName.includes('nose') || lowerName.includes('terminal') || lowerName.includes('top')) {
        // Top attachment: above body, smaller, pointing up
        positions[name] = { x: 12, y: 5, scale: 0.35, zIndex: 1 };
      } else if (lowerName.includes('fins') || lowerName.includes('base') || lowerName.includes('stand')) {
        // Bottom attachment: below body
        positions[name] = { x: 12, y: 20, scale: 0.30, zIndex: 1 };
      } else {
        // Unknown: center it
        positions[name] = { x: 12, y: 12, scale: 0.4, zIndex: 2 };
      }
    }

    layouts.push({
      name: 'standard',
      description: 'Vertical structure with top and bottom attachments',
      positions,
    });

    // Compact variant
    const compactPositions: Record<string, Position> = {};
    for (const name of allPartNames) {
      const lowerName = name.toLowerCase();

      if (lowerName.includes('body') || lowerName.includes('case') || lowerName.includes('screen')) {
        compactPositions[name] = { x: 12, y: 12, scale: 0.55, zIndex: 0 };
      } else if (lowerName.includes('nose') || lowerName.includes('terminal') || lowerName.includes('top')) {
        compactPositions[name] = { x: 12, y: 4, scale: 0.30, zIndex: 1 };
      } else if (lowerName.includes('fins') || lowerName.includes('base') || lowerName.includes('stand')) {
        compactPositions[name] = { x: 12, y: 20, scale: 0.25, zIndex: 1 };
      } else {
        compactPositions[name] = { x: 12, y: 12, scale: 0.35, zIndex: 2 };
      }
    }

    layouts.push({
      name: 'compact',
      description: 'Tighter vertical arrangement',
      positions: compactPositions,
    });

    return layouts;
  }

  // Generic layouts for non-rocket-like structures
  if (totalParts === 2) {
    const [name1, name2] = allPartNames;

    // Standard: side by side
    layouts.push({
      name: 'side-by-side',
      description: 'Components arranged horizontally',
      positions: {
        [name1]: { x: 8, y: 12, scale: 0.6, zIndex: 0 },
        [name2]: { x: 16, y: 12, scale: 0.6, zIndex: 1 },
      },
    });

    // Badge: one behind, one in front
    layouts.push({
      name: 'badge',
      description: 'Second component as badge on first',
      positions: {
        [name1]: { x: 10, y: 12, scale: 0.8, zIndex: 0 },
        [name2]: { x: 17, y: 17, scale: 0.4, zIndex: 1 },
      },
    });

    // Overlay: centered overlap
    layouts.push({
      name: 'overlay',
      description: 'Components overlapping in center',
      positions: {
        [name1]: { x: 12, y: 12, scale: 0.7, zIndex: 0 },
        [name2]: { x: 12, y: 12, scale: 0.5, zIndex: 1 },
      },
    });
  }

  if (totalParts >= 3) {
    const positions: Record<string, Position> = {};
    const angle = (2 * Math.PI) / totalParts;

    allPartNames.forEach((name, i) => {
      const x = 12 + Math.cos(angle * i - Math.PI / 2) * 6;
      const y = 12 + Math.sin(angle * i - Math.PI / 2) * 6;
      positions[name] = { x, y, scale: 0.5, zIndex: i };
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
 * Apply scale and translate to SVG path data (bake transform into coordinates)
 * This properly handles SVG path commands and their coordinate types
 */
function applyTransformToPath(
  pathData: string,
  scale: number,
  translateX: number,
  translateY: number
): string {
  // SVG path command patterns and their coordinate counts
  // M/m, L/l, T/t: 2 coords (x,y)
  // H/h: 1 coord (x)
  // V/v: 1 coord (y)
  // C/c: 6 coords (x1,y1,x2,y2,x,y)
  // S/s, Q/q: 4 coords (x1,y1,x,y)
  // A/a: 7 values (rx,ry,angle,large-arc,sweep,x,y) - only last 2 are coords to transform

  const result: string[] = [];
  let i = 0;

  while (i < pathData.length) {
    // Skip whitespace
    while (i < pathData.length && /\s/.test(pathData[i])) {
      result.push(pathData[i]);
      i++;
    }

    if (i >= pathData.length) break;

    const char = pathData[i];

    // Check if it's a command letter
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(char)) {
      result.push(char);
      i++;

      // Parse numbers following the command
      const isRelative = char === char.toLowerCase();
      const cmd = char.toUpperCase();

      // For relative commands (lowercase), don't add translation, only scale
      // For absolute commands (uppercase), add translation too

      if (cmd === 'Z') {
        // No coordinates
        continue;
      }

      // Determine how many coordinate pairs this command expects
      let coordCount = 0;
      let isArc = false;
      switch (cmd) {
        case 'M': case 'L': case 'T': coordCount = 2; break;
        case 'H': coordCount = 1; break;  // x only
        case 'V': coordCount = 1; break;  // y only
        case 'C': coordCount = 6; break;
        case 'S': case 'Q': coordCount = 4; break;
        case 'A': coordCount = 7; isArc = true; break;
      }

      // Parse and transform coordinates
      let coordIndex = 0;
      while (coordIndex < coordCount || coordCount === 0) {
        // Skip whitespace and commas
        while (i < pathData.length && /[\s,]/.test(pathData[i])) {
          result.push(pathData[i]);
          i++;
        }

        if (i >= pathData.length) break;

        // Check for next command or end
        if (/[MmLlHhVvCcSsQqTtAaZz]/.test(pathData[i])) break;

        // Parse number
        let numStr = '';
        if (pathData[i] === '-' || pathData[i] === '+') {
          numStr += pathData[i];
          i++;
        }
        while (i < pathData.length && /[\d.]/.test(pathData[i])) {
          numStr += pathData[i];
          i++;
        }

        if (numStr === '') break;

        const num = parseFloat(numStr);
        let transformed: number;

        if (isArc && coordIndex < 5) {
          // Arc: first 5 values (rx, ry, angle, large-arc, sweep) - scale radii, keep others
          if (coordIndex < 2) {
            transformed = num * scale;  // Scale rx, ry
          } else {
            transformed = num;  // Keep angle, flags as-is
          }
        } else {
          // Determine if x or y coordinate
          const isY = (cmd === 'V') ||
                      (cmd === 'H' ? false :
                       (isArc ? coordIndex === 6 : coordIndex % 2 === 1));

          if (isRelative) {
            // Relative: only scale, no translation
            transformed = num * scale;
          } else {
            // Absolute: scale and translate
            if (isY) {
              transformed = num * scale + translateY;
            } else {
              transformed = num * scale + translateX;
            }
          }
        }

        result.push(transformed.toFixed(2));
        coordIndex++;

        // For repeating commands (like M with multiple points), reset
        if (coordIndex >= coordCount && coordCount > 0) {
          coordIndex = 0;
        }
      }
    } else {
      // Unknown character, just copy
      result.push(char);
      i++;
    }
  }

  return result.join('');
}

/**
 * Find matching position for a part, handling LLM key variations
 */
function findPositionForPart(partName: string, positions: Record<string, Position>): Position | null {
  // Direct match
  if (positions[partName]) return positions[partName];

  // Try lowercase
  const lowerName = partName.toLowerCase();
  for (const [key, pos] of Object.entries(positions)) {
    if (key.toLowerCase() === lowerName) return pos;
  }

  // Try just the role part (e.g., "body" from "body (capsule)")
  const roleMatch = partName.match(/^(\w+)\s*\(/);
  if (roleMatch) {
    const role = roleMatch[1];
    for (const [key, pos] of Object.entries(positions)) {
      if (key.toLowerCase().startsWith(role.toLowerCase())) return pos;
    }
  }

  return null;
}

/**
 * Build SVG from positioned components
 */
function buildSvgFromComponents(
  parts: KitbashMatch[],
  layout: SkeletonLayout,
  rules: EnforcementRules
): string {
  console.log(`[Kitbash] Building SVG with ${parts.length} parts`);
  console.log(`[Kitbash] Layout positions: ${Object.keys(layout.positions).join(', ')}`);
  console.log(`[Kitbash] Part names: ${parts.map(p => p.partName).join(', ')}`);

  // Sort by zIndex
  const sortedParts = [...parts].sort((a, b) => {
    const posA = findPositionForPart(a.partName, layout.positions);
    const posB = findPositionForPart(b.partName, layout.positions);
    return (posA?.zIndex || 0) - (posB?.zIndex || 0);
  });

  let paths = '';

  for (const part of sortedParts) {
    const position = findPositionForPart(part.partName, layout.positions);
    if (!position) {
      console.warn(`[Kitbash] No position found for "${part.partName}"`);
      continue;
    }

    const bbox = part.component.boundingBox;

    // Validate bounding box has required properties
    if (bbox.centerX === undefined || bbox.centerY === undefined) {
      console.warn(`[Kitbash] Missing centerX/centerY for "${part.partName}", using defaults`);
      bbox.centerX = bbox.x + bbox.width / 2;
      bbox.centerY = bbox.y + bbox.height / 2;
    }

    const scale = position.scale || 1;

    // Calculate translation to move component center to target position
    const translateX = (position.x || 12) - bbox.centerX * scale;
    const translateY = (position.y || 12) - bbox.centerY * scale;

    // Use a <g> wrapper with transform - this is the proper SVG way
    // The browser will handle the math correctly for all path commands
    const transform = `translate(${translateX.toFixed(2)} ${translateY.toFixed(2)}) scale(${scale.toFixed(2)})`;

    if (part.component.elementType === 'path') {
      paths += `<g transform="${transform}"><path d="${part.component.pathData}"/></g>\n`;
    } else if (part.component.elementType === 'circle') {
      paths += `<g transform="${transform}"><circle ${part.component.pathData}/></g>\n`;
    } else if (part.component.elementType === 'rect') {
      paths += `<g transform="${transform}"><rect ${part.component.pathData}/></g>\n`;
    } else if (part.component.elementType === 'line') {
      paths += `<g transform="${transform}"><line ${part.component.pathData}/></g>\n`;
    }
  }

  const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${rules.strokeWidth || 2}" stroke-linecap="${rules.strokeLinecap || 'round'}" stroke-linejoin="${rules.strokeLinejoin || 'round'}" xmlns="http://www.w3.org/2000/svg">
${paths}</svg>`;

  console.log(`[Kitbash] Generated SVG with ${(svg.match(/<path/g) || []).length} path elements`);
  console.log(`[Kitbash] SVG preview (first 500 chars): ${svg.substring(0, 500)}`);

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

// =============================================================================
// SPRINT 07: GEOMETRIC PLANNING (Blueprint Protocol)
// =============================================================================

/**
 * A geometric match from the library (Sprint 07)
 * Matches a geometric primitive (shape requirement) to a library component
 */
export interface GeometricMatch {
  /** The primitive we were looking for */
  primitive: GeometricPrimitive;
  /** The component we found */
  component: IconComponent;
  /** Source icon name */
  sourceIcon: string;
  /** Match confidence 0-1 */
  confidence: number;
}

/**
 * Find components matching a geometric primitive
 * Sprint 07: Shape-based search instead of name-based
 */
function findGeometricMatches(
  primitive: GeometricPrimitive,
  componentIndex: Map<string, IconComponent[]>
): IconComponent[] {
  // Direct geometric type match
  const geometricMatches = findByGeometry(componentIndex, primitive.shape);

  console.log(`[Kitbash] Searching for geometric:${primitive.shape} - found ${geometricMatches.length} matches`);

  // Filter by aspect ratio if specified
  if (primitive.aspect && geometricMatches.length > 0) {
    const filtered = geometricMatches.filter(comp => {
      const bbox = comp.boundingBox;
      const aspectRatio = bbox.width / bbox.height;

      // Relaxed thresholds: "tall" means height > width, "wide" means width > height
      if (primitive.aspect === 'tall') return aspectRatio <= 1.0; // height >= width
      if (primitive.aspect === 'wide') return aspectRatio >= 1.0; // width >= height
      if (primitive.aspect === 'square') return aspectRatio >= 0.7 && aspectRatio <= 1.4;
      return true;
    });

    // If aspect filtering eliminated all matches, return unfiltered (something is better than nothing)
    if (filtered.length === 0 && geometricMatches.length > 0) {
      console.log(`[Kitbash] Aspect filter (${primitive.aspect}) too strict, using unfiltered matches`);
      return geometricMatches;
    }
    return filtered;
  }

  return geometricMatches;
}

/**
 * Select the best geometric match from candidates
 * Sprint 07: Prefers simpler components for structural parts
 */
function selectBestGeometricMatch(
  primitive: GeometricPrimitive,
  candidates: IconComponent[]
): GeometricMatch | null {
  if (candidates.length === 0) return null;

  // Score candidates
  const scored = candidates.map(comp => {
    let score = 50; // Base score

    // Prefer simpler components (lower weight = less visual mass = simpler)
    score += (1 - comp.weight) * 30;

    // Prefer body/container categories for structural parts
    if (comp.category === 'body' || comp.category === 'container') {
      score += 20;
    }

    // Penalize complex geometricType (shouldn't match but could be fallback)
    if (comp.geometricType === 'complex') {
      score -= 50;
    }

    // Bonus if the shape matches exactly
    if (comp.geometricType === primitive.shape) {
      score += 30;
    }

    return { component: comp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    primitive,
    component: best.component,
    sourceIcon: best.component.sourceIcon,
    confidence: Math.min(1, best.score / 100),
  };
}

/**
 * Generate layouts from Blueprint assembly rules
 * Sprint 07: Uses geometric constraints for positioning
 * NOTE: LLM layout generation is unreliable, so we prefer deterministic defaults
 */
async function generateLayoutsFromBlueprint(
  concept: string,
  parts: KitbashMatch[],
  missingParts: string[] = [],
  assemblyRules: string[] = [],
  apiKey?: string
): Promise<SkeletonLayout[]> {
  // Sprint 07: Use deterministic layouts for rocket-like structures
  // The LLM was generating incorrect positions (e.g., nose bigger than body)
  const allPartNames = [...parts.map(p => p.partName), ...missingParts];

  // Check if this is a known structure type we can handle deterministically
  const hasVerticalStructure = allPartNames.some(n => n.toLowerCase().includes('body') || n.toLowerCase().includes('case')) &&
                               (allPartNames.some(n => n.toLowerCase().includes('nose') || n.toLowerCase().includes('top') || n.toLowerCase().includes('terminal')) ||
                                allPartNames.some(n => n.toLowerCase().includes('fins') || n.toLowerCase().includes('bottom') || n.toLowerCase().includes('base')));

  // For known structures, use deterministic layouts - more reliable than LLM
  if (hasVerticalStructure) {
    console.log('[Kitbash] Using deterministic vertical layout for known structure');
    return getDefaultLayouts(parts, missingParts);
  }

  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;

  if (!resolvedApiKey) {
    return getDefaultLayouts(parts, missingParts);
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const partInfo = parts.map(p => {
    const bbox = p.component.boundingBox;
    return `- ${p.partName}: ${bbox.width.toFixed(0)}×${bbox.height.toFixed(0)} from "${p.sourceIcon}"`;
  }).join('\n');

  const assemblyInfo = assemblyRules.length > 0
    ? `\n\nASSEMBLY CONSTRAINTS (follow these!):\n${assemblyRules.map(r => `- ${r}`).join('\n')}`
    : '';

  const prompt = `You are an icon layout expert. Create layouts for "${concept}".

AVAILABLE PARTS:
${partInfo}
${missingParts.length > 0 ? `\nMISSING (need positions for generation): ${missingParts.join(', ')}` : ''}
${assemblyInfo}

Canvas: 24×24 with 2px padding (usable: 2-22)

IMPORTANT RULES:
- Main body parts should be scale 0.4-0.6, NOT 0.8-1.0
- Attachment parts (nose, fins, badges) should be scale 0.2-0.4
- Parts should NOT overlap completely - they should be visually distinct
- "top" means low Y (y=3-6), "bottom" means high Y (y=18-21), "center" means y=10-14

Suggest 2 layouts:
1. Standard: Follow assembly constraints
2. Compact: Tighter arrangement

For each part, specify: x, y (center point), scale (0.2-0.6), zIndex (0=back, higher=front)

JSON only:
{
  "layouts": [
    {
      "name": "standard",
      "description": "...",
      "positions": {
        "body (capsule)": { "x": 12, "y": 13, "scale": 0.45, "zIndex": 0 },
        "nose (triangle)": { "x": 12, "y": 5, "scale": 0.3, "zIndex": 1 }
      }
    }
  ]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    const layouts = (parsed.layouts || []).map((l: any) => ({
      name: l.name || 'unknown',
      description: l.description || '',
      positions: l.positions || {},
    }));

    // Validate that all parts have positions
    for (const layout of layouts) {
      const missingPositions = allPartNames.filter(name => !findPositionForPart(name, layout.positions));
      if (missingPositions.length > 0) {
        console.warn(`[Kitbash] Layout "${layout.name}" missing positions for: ${missingPositions.join(', ')}`);
        // Fall back to defaults if LLM didn't provide all positions
        return getDefaultLayouts(parts, missingParts);
      }
    }

    return layouts;
  } catch (error) {
    console.error('[Kitbash] Blueprint layout generation failed:', error);
    return getDefaultLayouts(parts, missingParts);
  }
}

/**
 * Plan Kitbash using Blueprint Protocol (Sprint 07)
 * Uses geometric decomposition for shape-based matching
 */
async function planKitbashGeometric(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  apiKey?: string
): Promise<KitbashPlan> {
  // 1. Get geometric decomposition (shapes, not names)
  const blueprint = await getGeometricDecomposition(concept, apiKey);
  console.log(`[Kitbash] Blueprint for "${concept}":`);
  console.log(formatBlueprint(blueprint));

  // 2. Search library for each shape
  const foundParts: KitbashMatch[] = [];
  const missingParts: string[] = [];

  for (const primitive of blueprint.primitives) {
    const partLabel = `${primitive.role} (${primitive.shape})`;
    const candidates = findGeometricMatches(primitive, componentIndex);

    if (candidates.length > 0) {
      const match = selectBestGeometricMatch(primitive, candidates);
      if (match) {
        foundParts.push({
          partName: partLabel,
          sourceIcon: match.sourceIcon,
          component: match.component,
          confidence: match.confidence,
          transformRequired: { scale: 1, translateX: 0, translateY: 0 },
        });
        console.log(`[Kitbash] ✓ Found ${partLabel} from "${match.sourceIcon}" (${(match.confidence * 100).toFixed(0)}%)`);
      }
    } else {
      missingParts.push(partLabel);
      console.log(`[Kitbash] ✗ Missing ${partLabel}`);
    }
  }

  // 3. Calculate coverage
  const coverage = blueprint.primitives.length > 0
    ? foundParts.length / blueprint.primitives.length
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

  console.log(`[Kitbash] Blueprint coverage: ${(coverage * 100).toFixed(0)}%, Strategy: ${strategy}`);

  // 5. Generate layout suggestions with assembly hints
  let suggestedLayouts: SkeletonLayout[] = [];
  if (foundParts.length > 0 || missingParts.length > 0) {
    suggestedLayouts = await generateLayoutsFromBlueprint(
      concept,
      foundParts,
      missingParts,
      blueprint.assembly,
      apiKey
    );
  }

  // Get semantic decomposition for fallback/hybrid generation
  const decomposition = await getDecomposition(concept, 'auto', [], apiKey);

  return {
    concept,
    requiredParts: blueprint.primitives.map(p => `${p.role} (${p.shape})`),
    foundParts,
    missingParts,
    coverage,
    strategy,
    suggestedLayouts,
    decomposition,
  };
}

/**
 * Plan Kitbash using semantic matching (original method)
 * Kept for fallback when geometric matching fails
 */
async function planKitbashSemantic(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  apiKey?: string,
  availableIconNames?: string[]
): Promise<KitbashPlan> {
  // 1. Use LLM to identify which library icons could be combined
  // This returns searchable icon names like ["briefcase", "lock"]
  // NOT literal parts like ["case_body", "keyhole"]
  const requiredParts = await identifySourceIcons(
    concept,
    availableIconNames || [],
    apiKey
  );

  console.log(`[Kitbash] Planning "${concept}" - looking for icons:`, requiredParts);

  // Also get decomposition for the generation prompt (if needed later)
  const decomposition = await getDecomposition(concept, 'auto', [], apiKey);

  // 2. Search library for each icon
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

  console.log(`[Kitbash] Semantic coverage: ${(coverage * 100).toFixed(0)}%, Strategy: ${strategy}`);

  // 5. Generate layout suggestions (skip LLM call if no parts found)
  let suggestedLayouts: SkeletonLayout[] = [];
  if (foundParts.length > 0 || missingParts.length > 0) {
    suggestedLayouts = await generateLayouts(concept, foundParts, missingParts, apiKey);
  }

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
 * Plan how to assemble an icon from concept
 * Sprint 07: Now uses Blueprint Protocol (geometric) by default
 */
export async function planKitbash(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  apiKey?: string,
  availableIconNames?: string[],
  options?: { useGeometric?: boolean }
): Promise<KitbashPlan> {
  // Sprint 07: Default to geometric planning
  const useGeometric = options?.useGeometric ?? true;

  if (useGeometric) {
    const geometricPlan = await planKitbashGeometric(concept, componentIndex, apiKey);

    // If geometric planning found something, use it
    if (geometricPlan.coverage > 0) {
      return geometricPlan;
    }

    // Fall back to semantic planning if geometric found nothing
    console.log('[Kitbash] Geometric planning found no matches, falling back to semantic');
  }

  // Semantic planning (original method)
  return planKitbashSemantic(concept, componentIndex, apiKey, availableIconNames);
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
