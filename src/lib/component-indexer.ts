/**
 * Component Indexer - Semantic and Geometric tagging of icon parts
 *
 * Part of the Sprout Engine (F3)
 * Updated Sprint 07: Geometric Intelligence
 *
 * Philosophy: Know WHAT is in the library (semantics) and HOW it is shaped (geometry).
 * This enables the Kitbash Engine to use "Blueprints" for assembly
 * (e.g. "I need a Capsule") rather than just names ("I need a Battery").
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  Icon,
  IconComponent,
  IconComponentIndex,
  ComponentCategory,
  GeometricType,
  BoundingBox,
} from '@/types/schema';
import { PATTERNS } from './pattern-library';

// Re-export types for use in other files
export type { ComponentCategory, GeometricType, IconComponent, BoundingBox, IconComponentIndex };

/**
 * Parse an SVG path's d attribute to extract basic bounding box
 * This is a simplified approximation - real SVG renderers would be more accurate
 */
function estimateBoundingBoxFromPath(d: string): BoundingBox {
  // Extract all numeric coordinates from the path
  const coords: number[] = [];
  const numberPattern = /-?\d+\.?\d*/g;
  let match;

  // Skip command letters and extract numbers
  const pathWithSpaces = d.replace(/([MLHVCSQTAZmlhvcsqtaz])/g, ' $1 ');
  const parts = pathWithSpaces.split(/\s+/).filter(Boolean);

  let lastX = 0;
  let lastY = 0;
  let currentCommand = 'M';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (/^[MLHVCSQTAZmlhvcsqtaz]$/.test(part)) {
      currentCommand = part;
      continue;
    }

    const num = parseFloat(part);
    if (isNaN(num)) continue;

    const isRelative = currentCommand === currentCommand.toLowerCase();
    const cmd = currentCommand.toUpperCase();

    switch (cmd) {
      case 'M':
      case 'L':
      case 'T':
        // x,y pairs
        if (i + 1 < parts.length && !isNaN(parseFloat(parts[i + 1]))) {
          const x = isRelative ? lastX + num : num;
          const y = isRelative ? lastY + parseFloat(parts[i + 1]) : parseFloat(parts[i + 1]);
          coords.push(x, y);
          lastX = x;
          lastY = y;
          i++; // Skip the y we just processed
        }
        break;
      case 'H':
        lastX = isRelative ? lastX + num : num;
        coords.push(lastX, lastY);
        break;
      case 'V':
        lastY = isRelative ? lastY + num : num;
        coords.push(lastX, lastY);
        break;
      case 'C':
        // 6 numbers: x1,y1,x2,y2,x,y - we care about endpoints
        coords.push(num);
        break;
      case 'S':
      case 'Q':
        // 4 numbers: control points and endpoint
        coords.push(num);
        break;
      case 'A':
        // 7 numbers: rx,ry,angle,largeArc,sweep,x,y
        coords.push(num);
        break;
      default:
        coords.push(num);
    }
  }

  if (coords.length < 2) {
    return { x: 0, y: 0, width: 24, height: 24, centerX: 12, centerY: 12 };
  }

  // Extract x and y coordinates
  const xCoords: number[] = [];
  const yCoords: number[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    xCoords.push(coords[i]);
    if (i + 1 < coords.length) {
      yCoords.push(coords[i + 1]);
    }
  }

  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);

  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  return {
    x: minX,
    y: minY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Extract bounding box from circle element attributes
 */
function boundingBoxFromCircle(attrs: string): BoundingBox {
  const cxMatch = attrs.match(/cx\s*=\s*["']([^"']+)["']/);
  const cyMatch = attrs.match(/cy\s*=\s*["']([^"']+)["']/);
  const rMatch = attrs.match(/r\s*=\s*["']([^"']+)["']/);

  const cx = cxMatch ? parseFloat(cxMatch[1]) : 12;
  const cy = cyMatch ? parseFloat(cyMatch[1]) : 12;
  const r = rMatch ? parseFloat(rMatch[1]) : 4;

  return {
    x: cx - r,
    y: cy - r,
    width: r * 2,
    height: r * 2,
    centerX: cx,
    centerY: cy,
  };
}

/**
 * Extract bounding box from rect element attributes
 */
function boundingBoxFromRect(attrs: string): BoundingBox {
  const xMatch = attrs.match(/\bx\s*=\s*["']([^"']+)["']/);
  const yMatch = attrs.match(/\by\s*=\s*["']([^"']+)["']/);
  const wMatch = attrs.match(/width\s*=\s*["']([^"']+)["']/);
  const hMatch = attrs.match(/height\s*=\s*["']([^"']+)["']/);

  const x = xMatch ? parseFloat(xMatch[1]) : 0;
  const y = yMatch ? parseFloat(yMatch[1]) : 0;
  const width = wMatch ? parseFloat(wMatch[1]) : 24;
  const height = hMatch ? parseFloat(hMatch[1]) : 24;

  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

/**
 * Extract bounding box from line element attributes
 */
function boundingBoxFromLine(attrs: string): BoundingBox {
  const x1Match = attrs.match(/x1\s*=\s*["']([^"']+)["']/);
  const y1Match = attrs.match(/y1\s*=\s*["']([^"']+)["']/);
  const x2Match = attrs.match(/x2\s*=\s*["']([^"']+)["']/);
  const y2Match = attrs.match(/y2\s*=\s*["']([^"']+)["']/);

  const x1 = x1Match ? parseFloat(x1Match[1]) : 0;
  const y1 = y1Match ? parseFloat(y1Match[1]) : 0;
  const x2 = x2Match ? parseFloat(x2Match[1]) : 24;
  const y2 = y2Match ? parseFloat(y2Match[1]) : 24;

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  return {
    x: minX,
    y: minY,
    width: maxX - minX || 1,
    height: maxY - minY || 1,
    centerX: (x1 + x2) / 2,
    centerY: (y1 + y2) / 2,
  };
}

/**
 * Parse SVG and extract individual elements with their data
 */
interface ParsedElement {
  type: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'ellipse';
  data: string; // d attribute for path, or full attributes for others
  boundingBox: BoundingBox;
}

function parseSvgElements(svgOrPath: string): ParsedElement[] {
  const elements: ParsedElement[] = [];

  // Check if this is just a path data string (d attribute) vs full SVG
  if (!svgOrPath.includes('<')) {
    // It's just path data
    return [{
      type: 'path',
      data: svgOrPath,
      boundingBox: estimateBoundingBoxFromPath(svgOrPath),
    }];
  }

  // Parse as full SVG
  const pathMatches = svgOrPath.matchAll(/<path[^>]*d\s*=\s*["']([^"']+)["'][^>]*\/?>/g);
  for (const match of pathMatches) {
    elements.push({
      type: 'path',
      data: match[1],
      boundingBox: estimateBoundingBoxFromPath(match[1]),
    });
  }

  const circleMatches = svgOrPath.matchAll(/<circle([^>]*)\/?>/g);
  for (const match of circleMatches) {
    elements.push({
      type: 'circle',
      data: match[1],
      boundingBox: boundingBoxFromCircle(match[1]),
    });
  }

  const rectMatches = svgOrPath.matchAll(/<rect([^>]*)\/?>/g);
  for (const match of rectMatches) {
    elements.push({
      type: 'rect',
      data: match[1],
      boundingBox: boundingBoxFromRect(match[1]),
    });
  }

  const lineMatches = svgOrPath.matchAll(/<line([^>]*)\/?>/g);
  for (const match of lineMatches) {
    elements.push({
      type: 'line',
      data: match[1],
      boundingBox: boundingBoxFromLine(match[1]),
    });
  }

  // If no elements found but there's path data in the string, try extracting it
  if (elements.length === 0) {
    const anyPathMatch = svgOrPath.match(/d\s*=\s*["']([^"']+)["']/);
    if (anyPathMatch) {
      elements.push({
        type: 'path',
        data: anyPathMatch[1],
        boundingBox: estimateBoundingBoxFromPath(anyPathMatch[1]),
      });
    }
  }

  return elements;
}

/**
 * Build full SVG from an icon for analysis
 */
function buildFullSvg(icon: Icon): string {
  const viewBox = icon.viewBox || '0 0 24 24';
  return `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
}

/**
 * Estimate the visual weight of an element relative to the whole icon
 */
function estimateWeight(bbox: BoundingBox): number {
  // Weight based on area relative to 24x24 canvas
  const area = bbox.width * bbox.height;
  const canvasArea = 24 * 24;
  return Math.min(1, area / canvasArea);
}

/**
 * Determine complexity based on component count and types
 */
function determineComplexity(components: IconComponent[]): 'simple' | 'moderate' | 'complex' {
  if (components.length <= 2) return 'simple';
  if (components.length <= 5) return 'moderate';
  return 'complex';
}

/**
 * Build component signature string for quick matching
 */
function buildSignature(components: IconComponent[]): string {
  return components
    .map(c => c.name.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .sort()
    .join('+');
}

/**
 * Index an icon's semantic and geometric components using LLM analysis
 * Sprint 07: Now extracts geometricType for Blueprint Protocol
 *
 * @param icon - The icon to analyze
 * @param apiKey - Google API key for Gemini
 * @returns Array of identified components with geometry classification
 */
export async function indexIconComponents(
  icon: Icon,
  apiKey?: string
): Promise<IconComponent[]> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    console.warn('[ComponentIndexer] No API key - returning basic component');
    // Return a basic component without LLM analysis
    const elements = parseSvgElements(icon.path);
    return elements.map((el, i) => ({
      name: `${icon.name}-part-${i + 1}`,
      category: 'body' as ComponentCategory,
      geometricType: inferGeometricTypeFromElement(el) as GeometricType,
      pathData: el.data,
      elementType: el.type,
      boundingBox: el.boundingBox,
      semanticTags: [],
      sourceIcon: icon.id,
      weight: estimateWeight(el.boundingBox),
    }));
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Parse the SVG to get elements
  const elements = parseSvgElements(icon.path);
  const fullSvg = buildFullSvg(icon);

  // Sprint 07: Updated prompt with geometricType extraction
  const prompt = `You are an SVG icon analyst. Analyze this icon "${icon.name}" and identify its visual components.

## SVG CODE
${fullSvg}

## ELEMENTS FOUND (${elements.length} total)
${elements.map((el, i) => `${i + 1}. <${el.type}> at approximately (${el.boundingBox.centerX.toFixed(1)}, ${el.boundingBox.centerY.toFixed(1)}) size: ${el.boundingBox.width.toFixed(1)}×${el.boundingBox.height.toFixed(1)}`).join('\n')}

## YOUR TASK
For EACH element/path in this icon, identify:

1. **name**: Short semantic name (e.g., "user-head", "arrow-shaft", "document-body", "check-mark")
2. **category**: One of: body, head, modifier, container, indicator, detail, connector
   - body: Main shape (torso, document rectangle, envelope body)
   - head: Top element of a figure (user head, arrow point)
   - modifier: Badge, status symbol added to main shape
   - container: Enclosing shape (circle, shield, square frame)
   - indicator: Action symbols (check, x, plus, minus, arrow)
   - detail: Internal lines, decorative elements
   - connector: Lines joining elements
3. **geometricType**: Analyze the VISUAL SHAPE topology. Choose ONE:
   - circle: Perfect circle or ring
   - square: Equal sides, sharp or rounded corners
   - rect: Non-square rectangle
   - capsule: Pill shape (rounded rectangle with semicircle ends)
   - triangle: Three-sided polygon
   - line: Straight stroke
   - curve: Simple arc or squiggle
   - L-shape: 90-degree bend
   - U-shape: Open container/cup shape
   - cross: Plus or X shape
   - complex: Irregular or detailed shape
4. **semanticTags**: 2-4 tags describing function/meaning

CRITICAL FOR geometricType:
- Analyze the ACTUAL SHAPE, not what it represents semantically
- A battery case is a "capsule" (rounded rectangle)
- A stop button is a "square"
- A play button is a "triangle"
- A radio button is a "circle"
- A checkmark is a "curve" or "L-shape"

IMPORTANT:
- Match element count: You have ${elements.length} element(s) to analyze
- Use lowercase-hyphenated names (e.g., "arrow-head" not "ArrowHead")
- Be specific to what this icon represents

Respond with valid JSON only:
{
  "components": [
    { "elementIndex": 0, "name": "...", "category": "...", "geometricType": "...", "semanticTags": ["..."] }
  ]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const llmComponents = parsed.components || [];

    // Map LLM results back to our elements
    const components: IconComponent[] = elements.map((el, i) => {
      const llmData = llmComponents.find((c: any) => c.elementIndex === i) || llmComponents[i];

      return {
        name: llmData?.name || `${icon.name}-part-${i + 1}`,
        category: (llmData?.category || 'body') as ComponentCategory,
        geometricType: (llmData?.geometricType || inferGeometricTypeFromElement(el)) as GeometricType,
        pathData: el.data,
        elementType: el.type,
        boundingBox: el.boundingBox,
        semanticTags: llmData?.semanticTags || [],
        sourceIcon: icon.id,
        weight: estimateWeight(el.boundingBox),
      };
    });

    return components;
  } catch (error) {
    console.error('[ComponentIndexer] Error analyzing icon:', error);
    // Return basic components on error with inferred geometry
    return elements.map((el, i) => ({
      name: `${icon.name}-part-${i + 1}`,
      category: 'body' as ComponentCategory,
      geometricType: inferGeometricTypeFromElement(el) as GeometricType,
      pathData: el.data,
      elementType: el.type,
      boundingBox: el.boundingBox,
      semanticTags: [],
      sourceIcon: icon.id,
      weight: estimateWeight(el.boundingBox),
    }));
  }
}

/**
 * Infer geometric type from element properties (fallback when LLM unavailable)
 */
function inferGeometricTypeFromElement(el: ParsedElement): GeometricType {
  const { type, boundingBox } = el;
  const aspectRatio = boundingBox.width / boundingBox.height;

  // Direct mapping for primitive SVG elements
  if (type === 'circle') return 'circle';
  if (type === 'line') return 'line';
  if (type === 'rect') {
    // Check if square vs rectangle
    if (Math.abs(aspectRatio - 1) < 0.2) return 'square';
    return 'rect';
  }

  // For paths, use heuristics based on bounding box
  if (type === 'path') {
    // Nearly square
    if (Math.abs(aspectRatio - 1) < 0.15) {
      // Could be circle, square, or cross
      return 'complex'; // Can't determine without path analysis
    }
    // Very wide or very tall could be capsule or rect
    if (aspectRatio > 2 || aspectRatio < 0.5) {
      return 'rect'; // Default to rect for elongated shapes
    }
  }

  return 'complex';
}

/**
 * Index a full icon with all its component metadata
 */
export async function indexIcon(
  icon: Icon,
  apiKey?: string
): Promise<IconComponentIndex> {
  const components = await indexIconComponents(icon, apiKey);

  return {
    iconId: icon.id,
    iconName: icon.name,
    components,
    componentSignature: buildSignature(components),
    complexity: determineComplexity(components),
  };
}

/**
 * Build a searchable index of all components in a library
 * Sprint 07: Now indexes by geometric type for Blueprint Protocol
 *
 * Returns a Map where keys are component names and values are arrays of matching components
 * Index key types:
 * - Direct name: "arrow-head" → components named arrow-head
 * - Tag: "tag:directional" → components with directional tag
 * - Category: "category:body" → components in body category
 * - Source: "source:battery" → components from battery icon
 * - Geometric: "geometric:capsule" → components with capsule shape (Sprint 07)
 */
export async function buildComponentIndex(
  icons: Icon[],
  apiKey?: string,
  onProgress?: (current: number, total: number, iconName: string) => void
): Promise<Map<string, IconComponent[]>> {
  const index = new Map<string, IconComponent[]>();
  const total = icons.length;

  for (let i = 0; i < icons.length; i++) {
    const icon = icons[i];

    if (onProgress) {
      onProgress(i + 1, total, icon.name);
    }

    try {
      const components = await indexIconComponents(icon, apiKey);

      // Index by component name for fast lookup
      for (const component of components) {
        // 1. Name match
        const existing = index.get(component.name) || [];
        existing.push(component);
        index.set(component.name, existing);

        // 2. Tag match
        for (const tag of component.semanticTags) {
          const tagKey = `tag:${tag}`;
          const tagExisting = index.get(tagKey) || [];
          tagExisting.push(component);
          index.set(tagKey, tagExisting);
        }

        // 3. Category match
        const catKey = `category:${component.category}`;
        const catExisting = index.get(catKey) || [];
        catExisting.push(component);
        index.set(catKey, catExisting);

        // 4. Source icon match (Semantic Bridge from Sprint 06)
        const sourceKey = `source:${icon.name.toLowerCase()}`;
        const sourceExisting = index.get(sourceKey) || [];
        sourceExisting.push(component);
        index.set(sourceKey, sourceExisting);

        // 5. Sprint 07: Geometric type match (Blueprint Protocol)
        // Enables "Give me a capsule" queries
        if (component.geometricType && component.geometricType !== 'complex') {
          const geoKey = `geometric:${component.geometricType}`;
          const geoExisting = index.get(geoKey) || [];
          geoExisting.push(component);
          index.set(geoKey, geoExisting);
        }
      }
    } catch (error) {
      console.error(`[ComponentIndexer] Error indexing ${icon.name}:`, error);
    }

    // Rate limiting - pause between icons to avoid API limits
    if (i < icons.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[ComponentIndexer] Indexed ${icons.length} icons with ${index.size} unique keys`);

  return index;
}

/**
 * Search the component index for matches
 * Sprint 07: Enhanced with geometric type support
 */
export function searchComponents(
  index: Map<string, IconComponent[]>,
  query: string
): IconComponent[] {
  const results: IconComponent[] = [];
  const queryLower = query.toLowerCase();

  // Direct name match
  const nameMatch = index.get(queryLower);
  if (nameMatch) {
    results.push(...nameMatch);
  }

  // Tag match
  const tagMatch = index.get(`tag:${queryLower}`);
  if (tagMatch) {
    results.push(...tagMatch);
  }

  // Sprint 07: Geometric match (explicit prefix)
  if (queryLower.startsWith('geometric:')) {
    const geoMatch = index.get(queryLower);
    if (geoMatch) {
      results.push(...geoMatch);
    }
  } else {
    // Also try implicit geometric match for shape names
    const geoMatch = index.get(`geometric:${queryLower}`);
    if (geoMatch) {
      results.push(...geoMatch);
    }
  }

  // Source match (explicit prefix)
  if (queryLower.startsWith('source:')) {
    const sourceMatch = index.get(queryLower);
    if (sourceMatch) {
      results.push(...sourceMatch);
    }
  } else {
    // Also try implicit source match
    const sourceMatch = index.get(`source:${queryLower}`);
    if (sourceMatch) {
      results.push(...sourceMatch);
    }
  }

  // Partial name match fallback
  if (results.length === 0) {
    for (const [key, components] of index) {
      if (key.includes(queryLower) &&
          !key.startsWith('tag:') &&
          !key.startsWith('category:') &&
          !key.startsWith('geometric:') &&
          !key.startsWith('source:')) {
        for (const comp of components) {
          if (!results.includes(comp)) {
            results.push(comp);
          }
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(results)];
}

/**
 * Find components by geometric type (Sprint 07: Blueprint Protocol)
 */
export function findByGeometry(
  index: Map<string, IconComponent[]>,
  type: GeometricType
): IconComponent[] {
  return index.get(`geometric:${type}`) || [];
}

/**
 * Find components by category
 */
export function findByCategory(
  index: Map<string, IconComponent[]>,
  category: ComponentCategory
): IconComponent[] {
  return index.get(`category:${category}`) || [];
}

/**
 * Serialize component index to JSON for storage
 */
export function serializeIndex(index: Map<string, IconComponent[]>): string {
  const obj: Record<string, IconComponent[]> = {};
  for (const [key, value] of index) {
    obj[key] = value;
  }
  return JSON.stringify(obj);
}

/**
 * Deserialize component index from JSON
 */
export function deserializeIndex(json: string): Map<string, IconComponent[]> {
  const obj = JSON.parse(json);
  const index = new Map<string, IconComponent[]>();
  for (const [key, value] of Object.entries(obj)) {
    index.set(key, value as IconComponent[]);
  }
  return index;
}

/**
 * Format component for display/logging
 * Sprint 07: Now includes geometricType
 */
export function formatComponent(component: IconComponent): string {
  const bbox = component.boundingBox;
  return `${component.name} (${component.category}/${component.geometricType}) @ [${bbox.x.toFixed(1)}, ${bbox.y.toFixed(1)}, ${bbox.width.toFixed(1)}×${bbox.height.toFixed(1)}]`;
}

/**
 * Format full icon index for logging
 */
export function formatIconIndex(index: IconComponentIndex): string {
  const lines: string[] = [];
  lines.push(`${index.iconName} (${index.complexity})`);
  lines.push(`Signature: ${index.componentSignature}`);
  lines.push(`Components:`);
  for (const comp of index.components) {
    lines.push(`  • ${formatComponent(comp)}`);
    if (comp.semanticTags.length > 0) {
      lines.push(`    Tags: ${comp.semanticTags.join(', ')}`);
    }
  }
  return lines.join('\n');
}
