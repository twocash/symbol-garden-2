/**
 * Decomposition Service - Provides structural breakdowns for icon generation
 *
 * Two-tier system:
 * 1. Static: Pre-computed decompositions from decompositions.json (no LLM cost)
 * 2. Dynamic: On-demand LLM generation for novel concepts (cached after first use)
 *
 * Sprint 07: Added Geometric Decomposition for Blueprint Protocol
 * - Breaks concepts into geometric primitives (capsule, triangle, circle)
 * - Enables shape-based component matching in Kitbash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Icon, SemanticCategory, GeometricTrait, GeometricType } from '../types/schema';
import { PatternType } from './pattern-library';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Concept hints for semantic guidance in decomposition
 * Maps concept patterns to expected category and geometric traits
 */
const DECOMPOSITION_HINTS: Record<string, { category?: SemanticCategory; traits?: GeometricTrait[]; guidance?: string }> = {
  // Objects with containment
  battery: { category: 'object', traits: ['containment', 'symmetry'], guidance: 'Container with internal indicator' },
  folder: { category: 'object', traits: ['containment', 'open-path'], guidance: 'Container that can open' },
  box: { category: 'object', traits: ['containment', 'symmetry'], guidance: '3D rectangular container' },
  gift: { category: 'object', traits: ['containment', 'compound'], guidance: 'Box with ribbon decoration' },

  // Objects with symmetry
  rocket: { category: 'object', traits: ['symmetry', 'compound'], guidance: 'Pointed body with fins' },
  plane: { category: 'object', traits: ['symmetry', 'compound'], guidance: 'Fuselage with wings' },
  heart: { category: 'abstract', traits: ['symmetry'], guidance: 'Two curved lobes meeting at point' },

  // Compound objects
  brain: { category: 'object', traits: ['compound'], guidance: 'Organic lobes with folds' },
  robot: { category: 'object', traits: ['symmetry', 'compound', 'nested'], guidance: 'Head with face elements' },

  // Intersection patterns
  scissors: { category: 'object', traits: ['intersection', 'symmetry'], guidance: 'Two blades crossing at pivot' },
  link: { category: 'object', traits: ['intersection'], guidance: 'Two rings interlocking' },
  network: { category: 'abstract', traits: ['intersection', 'compound'], guidance: 'Nodes with connecting lines' },

  // Actions
  download: { category: 'action', traits: ['open-path'], guidance: 'Arrow pointing down into target' },
  upload: { category: 'action', traits: ['open-path'], guidance: 'Arrow pointing up from source' },
  refresh: { category: 'action', traits: ['open-path', 'compound'], guidance: 'Circular arrows' },

  // UI elements
  dashboard: { category: 'ui', traits: ['compound', 'nested'], guidance: 'Multiple panels or widgets' },
  settings: { category: 'ui', traits: ['symmetry', 'compound'], guidance: 'Gear with teeth' },
};

/**
 * Get semantic hints for a concept
 */
function getDecompositionHints(concept: string): { category?: SemanticCategory; traits?: GeometricTrait[]; guidance?: string } {
  const normalized = concept.toLowerCase().replace(/[\s-_]+/g, '');

  // Direct match
  if (DECOMPOSITION_HINTS[normalized]) {
    return DECOMPOSITION_HINTS[normalized];
  }

  // Partial match
  for (const [key, hints] of Object.entries(DECOMPOSITION_HINTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return hints;
    }
  }

  // Infer from keywords
  if (/download|upload|send|receive|play|pause|stop|edit|delete|add|remove/.test(normalized)) {
    return { category: 'action', traits: ['open-path'] };
  }
  if (/arrow|chevron|menu|nav|tab|panel|modal|button|input/.test(normalized)) {
    return { category: 'ui' };
  }
  if (/warning|error|info|check|x|plus|minus/.test(normalized)) {
    return { category: 'abstract' };
  }

  return { category: 'object' };
}

export interface Component {
  name: string;
  description: string;
  type: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'arc-loop';
  suggestedPath?: string;
  pierces?: boolean;
}

export interface Decomposition {
  concept: string;
  components: Component[];
  connectionRules: string[];
  patterns: PatternType[];
  source: 'static' | 'dynamic';
}

interface DecompositionsData {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
  };
  decompositions: Record<string, {
    components: Component[];
    connectionRules: string[];
    patterns: PatternType[];
  }>;
}

// In-memory cache for dynamic decompositions
const dynamicCache = new Map<string, Decomposition>();

// Static decompositions loaded from JSON
let staticDecompositions: DecompositionsData | null = null;

/**
 * Load static decompositions from JSON file
 */
function loadStaticDecompositions(): DecompositionsData {
  if (staticDecompositions) {
    return staticDecompositions;
  }

  try {
    // Try multiple paths for different execution contexts
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'decompositions.json'),
      path.join(__dirname, '../../..', 'data', 'decompositions.json'),
      path.join(__dirname, '../../../data', 'decompositions.json'),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        staticDecompositions = JSON.parse(data) as DecompositionsData;
        console.log(`[Decomposition] Loaded ${Object.keys(staticDecompositions.decompositions).length} static decompositions`);
        return staticDecompositions;
      }
    }

    console.warn('[Decomposition] Could not find decompositions.json');
    staticDecompositions = { _meta: { version: '0', description: '', lastUpdated: '' }, decompositions: {} };
    return staticDecompositions;
  } catch (error) {
    console.error('[Decomposition] Error loading decompositions.json:', error);
    staticDecompositions = { _meta: { version: '0', description: '', lastUpdated: '' }, decompositions: {} };
    return staticDecompositions;
  }
}

/**
 * Normalize a concept string for matching
 */
function normalizeConcept(concept: string): string {
  return concept
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Find best matching static decomposition
 */
function findStaticDecomposition(concept: string): Decomposition | null {
  const data = loadStaticDecompositions();
  const normalized = normalizeConcept(concept);

  // Exact match
  if (data.decompositions[normalized]) {
    const d = data.decompositions[normalized];
    return {
      concept: normalized,
      components: d.components,
      connectionRules: d.connectionRules,
      patterns: d.patterns,
      source: 'static',
    };
  }

  // Partial match - check if concept contains or is contained by a key
  for (const [key, value] of Object.entries(data.decompositions)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return {
        concept: key,
        components: value.components,
        connectionRules: value.connectionRules,
        patterns: value.patterns,
        source: 'static',
      };
    }
  }

  return null;
}

/**
 * Generate a decomposition dynamically using LLM
 */
async function generateDynamicDecomposition(
  concept: string,
  similarIcons: Icon[],
  apiKey?: string
): Promise<Decomposition> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    throw new Error('No API key available for dynamic decomposition. Please set your Google API key in System Settings.');
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Get semantic hints for this concept
  const hints = getDecompositionHints(concept);

  // Build semantic guidance section
  let semanticGuidance = '';
  if (hints.category || hints.traits || hints.guidance) {
    const parts: string[] = [];
    if (hints.category) {
      parts.push(`- Semantic Type: ${hints.category} (${hints.category === 'object' ? 'physical thing' : hints.category === 'action' ? 'represents an action/verb' : hints.category === 'ui' ? 'user interface element' : 'symbolic/conceptual'})`);
    }
    if (hints.traits?.length) {
      const traitDescriptions: Record<string, string> = {
        'containment': 'elements nested inside others (like battery charge in casing)',
        'intersection': 'overlapping/crossing strokes (like scissors blades)',
        'symmetry': 'bilateral or radial symmetry (mirror left/right)',
        'compound': 'multiple separate shapes forming one concept',
        'nested': 'recursive structure (folders in folders)',
        'open-path': 'unclosed strokes (arrows, checkmarks)',
        'fine-detail': 'small precise elements requiring careful placement',
      };
      const traitLines = hints.traits.map(t => `  - ${t}: ${traitDescriptions[t] || t}`);
      parts.push(`- Expected Geometric Traits:\n${traitLines.join('\n')}`);
    }
    if (hints.guidance) {
      parts.push(`- Visual Guidance: ${hints.guidance}`);
    }
    semanticGuidance = `\n\n## CONCEPT ANALYSIS\n${parts.join('\n')}`;
  }

  // Show exemplar icons with context if available
  const exemplarContext = similarIcons.length > 0
    ? `\n\n## REFERENCE ICONS FROM LIBRARY (study these for style)\n${similarIcons.slice(0, 4).map(i => {
      const meta = i.aiMetadata;
      const context = meta ? ` [${meta.semanticCategory}, complexity=${meta.complexity}${meta.geometricTraits?.length ? ', ' + meta.geometricTraits.join(', ') : ''}]` : '';
      return `### ${i.name}${context}\n<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n  <path d="${i.path}"/>\n</svg>`;
    }).join('\n\n')}`
    : '';

  const prompt = `You are an SVG icon architect for a Feather-style icon library.${semanticGuidance}

## FEATHER ICONS STYLE RULES
- ViewBox: 0 0 24 24
- Stroke: 2px width, round linecap and linejoin
- Coordinates: Keep all points between 2 and 22 (2px padding from edges)
- Style: Minimal, geometric, clean strokes - NO fills
${exemplarContext}

## YOUR TASK: Decompose "${concept}" into SVG components

For EACH component, you MUST provide:
1. name: Short identifier (e.g., "body", "handle", "left_wing")
2. description: What this part represents visually
3. type: path | circle | rect | line | polyline
4. suggestedPath: EXACT, USABLE SVG path/element syntax

CRITICAL: The suggestedPath must be real SVG syntax that works in a 24x24 viewBox:
- For path: "M3 18v-6a9 9 0 0 1 18 0v6" (actual path d attribute)
- For line: "x1='6' y1='2' x2='6' y2='4'" (actual line attributes)
- For circle: "cx='12' cy='12' r='4'" (actual circle attributes)
- For rect: "x='3' y='7' width='14' height='10' rx='2'" (actual rect attributes)

Also specify:
- connectionRules: How components connect geometrically
- patterns: Which apply (arc-loop, container-with-lid, through-line, attached-handle, symmetric-pair)

Respond with valid JSON only:
{
  "components": [
    { "name": "...", "description": "...", "type": "path", "suggestedPath": "M..." }
  ],
  "connectionRules": ["..."],
  "patterns": ["..."]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      concept: normalizeConcept(concept),
      components: parsed.components || [],
      connectionRules: parsed.connectionRules || [],
      patterns: parsed.patterns || [],
      source: 'dynamic',
    };
  } catch (error) {
    console.error('[Decomposition] Error generating dynamic decomposition:', error);
    // Return minimal decomposition as fallback
    return {
      concept: normalizeConcept(concept),
      components: [
        {
          name: 'main_shape',
          description: `Main shape for ${concept}`,
          type: 'path',
        },
      ],
      connectionRules: [],
      patterns: [],
      source: 'dynamic',
    };
  }
}

/**
 * Get decomposition for a concept
 *
 * @param concept - The icon concept to decompose
 * @param mode - 'static' only uses cache, 'dynamic' always generates, 'auto' tries static first
 * @param similarIcons - Similar icons for context (used in dynamic mode)
 * @param apiKey - Optional API key for dynamic generation
 */
export async function getDecomposition(
  concept: string,
  mode: 'static' | 'dynamic' | 'auto' = 'auto',
  similarIcons: Icon[] = [],
  apiKey?: string
): Promise<Decomposition | null> {
  const normalized = normalizeConcept(concept);

  // Check dynamic cache first
  if (dynamicCache.has(normalized)) {
    console.log(`[Decomposition] Cache hit for "${normalized}"`);
    return dynamicCache.get(normalized)!;
  }

  // Try static decomposition
  if (mode === 'static' || mode === 'auto') {
    const staticResult = findStaticDecomposition(concept);
    if (staticResult) {
      console.log(`[Decomposition] Static match for "${concept}" -> "${staticResult.concept}"`);
      return staticResult;
    }
  }

  // Static-only mode and no match
  if (mode === 'static') {
    console.log(`[Decomposition] No static decomposition for "${concept}"`);
    return null;
  }

  // Generate dynamically
  console.log(`[Decomposition] Generating dynamic decomposition for "${concept}"`);
  const dynamicResult = await generateDynamicDecomposition(concept, similarIcons, apiKey);

  // Cache the result
  dynamicCache.set(normalized, dynamicResult);

  return dynamicResult;
}

/**
 * Format decomposition for inclusion in prompts
 */
export function formatDecompositionForPrompt(decomposition: Decomposition): string {
  const componentsList = decomposition.components
    .map((c, i) => {
      let line = `${i + 1}. ${c.name.toUpperCase()}: ${c.description}`;
      if (c.suggestedPath) {
        line += `\n   Suggested: \`${c.suggestedPath}\``;
      }
      if (c.pierces) {
        line += `\n   Note: This element intentionally pierces through others`;
      }
      return line;
    })
    .join('\n\n');

  const rulesText = decomposition.connectionRules.length > 0
    ? `\n\nCONNECTION RULES:\n${decomposition.connectionRules.map(r => `- ${r}`).join('\n')}`
    : '';

  const patternsText = decomposition.patterns.length > 0
    ? `\n\nAPPLICABLE PATTERNS: ${decomposition.patterns.join(', ')}`
    : '';

  return `## STRUCTURAL DECOMPOSITION FOR: ${decomposition.concept}

COMPONENTS (build in this order):

${componentsList}${rulesText}${patternsText}`;
}

/**
 * Get list of available static decompositions
 */
export function getAvailableDecompositions(): string[] {
  const data = loadStaticDecompositions();
  return Object.keys(data.decompositions);
}

/**
 * Clear the dynamic cache (useful for testing)
 */
export function clearDynamicCache(): void {
  dynamicCache.clear();
}

// =============================================================================
// SPRINT 07: GEOMETRIC DECOMPOSITION (Blueprint Protocol)
// =============================================================================

/**
 * A geometric primitive for Kitbash Blueprint Protocol
 * Describes a shape requirement independent of semantic meaning
 */
export interface GeometricPrimitive {
  /** Role in the composition (e.g., "body", "nose", "fins") */
  role: string;
  /** Shape type to search for */
  shape: GeometricType;
  /** Aspect ratio hint */
  aspect?: 'tall' | 'wide' | 'square';
  /** Position in composition */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Blueprint - geometric decomposition for Kitbash assembly
 * Instead of "rocket" → ["fuselage", "nose-cone", "fins"]
 * We get: "rocket" → [{ role: "body", shape: "capsule" }, { role: "nose", shape: "triangle" }]
 */
export interface Blueprint {
  /** Original concept */
  concept: string;
  /** Geometric primitives needed */
  primitives: GeometricPrimitive[];
  /** Assembly instructions */
  assembly: string[];
  /** Source of this blueprint */
  source: 'static' | 'dynamic';
}

// Cache for geometric decompositions
const blueprintCache = new Map<string, Blueprint>();

// Static blueprints for common concepts
const STATIC_BLUEPRINTS: Record<string, Omit<Blueprint, 'concept' | 'source'>> = {
  rocket: {
    primitives: [
      { role: 'body', shape: 'capsule', aspect: 'tall', position: 'center' },
      { role: 'nose', shape: 'triangle', position: 'top' },
      { role: 'fins', shape: 'triangle', position: 'bottom' },
    ],
    assembly: [
      'Nose aligns center-bottom to center-top of body',
      'Fins attach to bottom-left and bottom-right of body',
    ],
  },
  tv: {
    primitives: [
      { role: 'screen', shape: 'rect', aspect: 'wide', position: 'center' },
      { role: 'stand', shape: 'rect', aspect: 'wide', position: 'bottom' },
    ],
    assembly: [
      'Stand aligns center-top to center-bottom of screen',
    ],
  },
  monitor: {
    primitives: [
      { role: 'screen', shape: 'rect', aspect: 'wide', position: 'center' },
      { role: 'stand', shape: 'rect', aspect: 'tall', position: 'bottom' },
      { role: 'base', shape: 'rect', aspect: 'wide', position: 'bottom' },
    ],
    assembly: [
      'Stand connects screen to base',
      'Base is wider than stand',
    ],
  },
  battery: {
    primitives: [
      { role: 'case', shape: 'capsule', aspect: 'tall', position: 'center' },
      { role: 'terminal', shape: 'rect', aspect: 'wide', position: 'top' },
    ],
    assembly: [
      'Terminal sits on top of case',
    ],
  },
  'play-button': {
    primitives: [
      { role: 'icon', shape: 'triangle', position: 'center' },
    ],
    assembly: [],
  },
  'stop-button': {
    primitives: [
      { role: 'icon', shape: 'square', position: 'center' },
    ],
    assembly: [],
  },
  target: {
    primitives: [
      { role: 'outer', shape: 'circle', position: 'center' },
      { role: 'middle', shape: 'circle', position: 'center' },
      { role: 'inner', shape: 'circle', position: 'center' },
    ],
    assembly: [
      'Circles are concentric (same center)',
      'Outer > middle > inner in radius',
    ],
  },
  microphone: {
    primitives: [
      { role: 'head', shape: 'capsule', position: 'top' },
      { role: 'stand', shape: 'line', position: 'bottom' },
      { role: 'base', shape: 'curve', position: 'bottom' },
    ],
    assembly: [
      'Stand extends from bottom of head',
      'Base curves under stand',
    ],
  },
  smartphone: {
    primitives: [
      { role: 'body', shape: 'capsule', aspect: 'tall', position: 'center' },
      { role: 'screen', shape: 'rect', position: 'center' },
    ],
    assembly: [
      'Screen is inset within body',
    ],
  },
};

/**
 * Get geometric decomposition for a concept (Sprint 07: Blueprint Protocol)
 *
 * Instead of semantic decomposition ("rocket" → "fuselage", "nose-cone"),
 * this returns geometric primitives ("rocket" → capsule + triangle + triangle)
 */
export async function getGeometricDecomposition(
  concept: string,
  apiKey?: string
): Promise<Blueprint> {
  const normalized = normalizeConcept(concept);

  // Check cache
  if (blueprintCache.has(normalized)) {
    console.log(`[Decomposition] Blueprint cache hit for "${normalized}"`);
    return blueprintCache.get(normalized)!;
  }

  // Check static blueprints
  if (STATIC_BLUEPRINTS[normalized]) {
    const blueprint: Blueprint = {
      concept: normalized,
      ...STATIC_BLUEPRINTS[normalized],
      source: 'static',
    };
    blueprintCache.set(normalized, blueprint);
    console.log(`[Decomposition] Static blueprint for "${normalized}"`);
    return blueprint;
  }

  // Check for partial matches in static blueprints
  for (const [key, value] of Object.entries(STATIC_BLUEPRINTS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      const blueprint: Blueprint = {
        concept: key,
        ...value,
        source: 'static',
      };
      blueprintCache.set(normalized, blueprint);
      console.log(`[Decomposition] Static blueprint partial match: "${normalized}" → "${key}"`);
      return blueprint;
    }
  }

  // Generate dynamically
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    console.warn('[Decomposition] No API key - returning basic blueprint');
    return {
      concept: normalized,
      primitives: [{ role: 'main', shape: 'complex', position: 'center' }],
      assembly: [],
      source: 'dynamic',
    };
  }

  console.log(`[Decomposition] Generating dynamic blueprint for "${normalized}"`);

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a geometric shape analyst. Break down "${concept}" into GEOMETRIC PRIMITIVES for icon construction.

IMPORTANT: Think about SHAPES, not semantics. What primitive forms make up this concept visually?

Available shapes:
- circle: Perfect circle or ring
- square: Equal-sided rectangle
- rect: Non-square rectangle
- capsule: Pill/stadium shape (rounded rectangle with semicircle ends)
- triangle: Three-sided polygon
- line: Straight stroke
- curve: Arc or squiggle
- L-shape: 90-degree bend
- U-shape: Open container shape
- cross: Plus or X shape
- complex: Only if truly irregular (avoid this if possible)

Examples:
- "rocket" → [{ role: "body", shape: "capsule", aspect: "tall" }, { role: "nose", shape: "triangle", position: "top" }, { role: "fins", shape: "triangle", position: "bottom" }]
- "TV" → [{ role: "screen", shape: "rect", aspect: "wide" }, { role: "stand", shape: "rect", position: "bottom" }]
- "battery" → [{ role: "case", shape: "capsule" }, { role: "terminal", shape: "rect", position: "top" }]
- "play button" → [{ role: "main", shape: "triangle" }]
- "eye" → [{ role: "outline", shape: "capsule", aspect: "wide" }, { role: "iris", shape: "circle", position: "center" }]

For "${concept}", provide the geometric breakdown.

Respond with valid JSON only:
{
  "primitives": [
    { "role": "...", "shape": "circle|square|rect|capsule|triangle|line|curve|L-shape|U-shape|cross|complex", "aspect": "tall|wide|square", "position": "top|bottom|left|right|center" }
  ],
  "assembly": ["How parts connect, e.g., 'Nose aligns to top of body'"]
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

    // Validate and normalize shapes
    const validShapes = ['circle', 'square', 'rect', 'capsule', 'triangle', 'line', 'curve', 'L-shape', 'U-shape', 'cross', 'complex'];
    const primitives: GeometricPrimitive[] = (parsed.primitives || []).map((p: any) => ({
      role: p.role || 'part',
      shape: validShapes.includes(p.shape) ? p.shape : 'complex',
      aspect: ['tall', 'wide', 'square'].includes(p.aspect) ? p.aspect : undefined,
      position: ['top', 'bottom', 'left', 'right', 'center'].includes(p.position) ? p.position : undefined,
    }));

    const blueprint: Blueprint = {
      concept: normalized,
      primitives,
      assembly: parsed.assembly || [],
      source: 'dynamic',
    };

    // Cache it
    blueprintCache.set(normalized, blueprint);

    return blueprint;
  } catch (error) {
    console.error('[Decomposition] Geometric decomposition failed:', error);
    return {
      concept: normalized,
      primitives: [{ role: 'main', shape: 'complex', position: 'center' }],
      assembly: [],
      source: 'dynamic',
    };
  }
}

/**
 * Format a blueprint for logging/display
 */
export function formatBlueprint(blueprint: Blueprint): string {
  const primitivesText = blueprint.primitives
    .map(p => {
      let text = `• ${p.role}: ${p.shape}`;
      if (p.aspect) text += ` (${p.aspect})`;
      if (p.position) text += ` @ ${p.position}`;
      return text;
    })
    .join('\n');

  const assemblyText = blueprint.assembly.length > 0
    ? `\nAssembly:\n${blueprint.assembly.map(a => `  - ${a}`).join('\n')}`
    : '';

  return `Blueprint for "${blueprint.concept}" (${blueprint.source}):\n${primitivesText}${assemblyText}`;
}

/**
 * Clear the blueprint cache
 */
export function clearBlueprintCache(): void {
  blueprintCache.clear();
}
