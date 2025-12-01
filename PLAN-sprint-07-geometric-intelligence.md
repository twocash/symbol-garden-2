# Sprint 07: Geometric Intelligence - Implementation Plan

> **Version:** 1.0
> **Target Branch:** `goofy-aryabhata` (current worktree)
> **PRD Reference:** Sprint 07 - Geometric Intelligence
> **Goal:** Transition Kitbash from "Semantic Collage" to "Geometric Assembly"

---

## Executive Summary

Currently, Kitbash fails to build simple objects (like a Rocket or TV) because it searches for icons with similar **names** rather than similar **shapes**. This sprint injects **Geometric Awareness** into the indexing and planning pipeline.

**Key Insight:** A "Battery" can become a "Rocket Body" because they're both **capsules** (vertical rounded rectangles). We teach the system to think in shapes, not just words.

---

## Current Architecture Analysis

### Existing Files to Modify

| File | Current State | Sprint 07 Changes |
|------|--------------|-------------------|
| `src/types/schema.ts` | Has `IconComponentSchema` with category, semanticTags | Add `geometricType` field |
| `src/lib/component-indexer.ts` | Indexes by name, tag, category | Add `geometric:*` index keys + geometry extraction |
| `src/lib/kitbash-engine.ts` | Uses `identifySourceIcons()` for semantic names | Replace with `decomposeToPrimitives()` + shape search |
| `src/lib/decomposition-service.ts` | Returns semantic components | Add `getGeometricDecomposition()` variant |

### Key Constraint

Icons are stored as a **single path string** (`Icon.path`). Components are extracted dynamically during enrichment and indexed in memory. The geometric classification must happen at indexing time.

---

## Phase 1: Geometric Indexing (Data Layer)

**Goal:** Every indexed component knows its visual topology (circle, capsule, triangle, etc.)

### Task 1.1: Update Schema with GeometricType

**File:** `src/types/schema.ts`

```typescript
// NEW: Geometric topology for Kitbash "Blueprint" matching
export const GeometricTypeSchema = z.enum([
  'circle',      // Perfect circle or ring
  'square',      // Equal sides, sharp or rounded
  'rect',        // Non-square rectangle
  'capsule',     // Pill shape (rounded rectangle with full radius ends)
  'triangle',    // Three-sided polygon
  'line',        // Straight stroke
  'curve',       // Simple arc or squiggle
  'L-shape',     // 90-degree bend
  'U-shape',     // Open container/cup shape
  'cross',       // Plus or X shape
  'complex',     // Irregular or detailed shape (fallback)
]);
export type GeometricType = z.infer<typeof GeometricTypeSchema>;

// Update IconComponentSchema
export const IconComponentSchema = z.object({
  name: z.string(),
  category: ComponentCategorySchema,
  geometricType: GeometricTypeSchema.default('complex'), // NEW
  pathData: z.string(),
  elementType: z.enum(['path', 'circle', 'rect', 'line', 'polyline', 'ellipse']),
  boundingBox: BoundingBoxSchema,
  semanticTags: z.array(z.string()),
  sourceIcon: z.string(),
  weight: z.number().min(0).max(1),
});
```

**Rationale:** The `geometricType` field describes the visual shape topology independent of what the icon "means". A battery body, mic body, and rocket fuselage are all `capsule` shapes.

---

### Task 1.2: Update Component Indexer Prompt

**File:** `src/lib/component-indexer.ts`

Update the `indexIconComponents()` function's LLM prompt to extract geometry:

```typescript
const prompt = `You are an SVG icon analyst. Analyze this icon "${icon.name}" and identify its visual components.

## SVG CODE
${fullSvg}

## ELEMENTS FOUND (${elements.length} total)
${elements.map((el, i) => `${i + 1}. <${el.type}> at approximately (${el.boundingBox.centerX.toFixed(1)}, ${el.boundingBox.centerY.toFixed(1)})`).join('\n')}

## YOUR TASK
For EACH element/path in this icon, identify:

1. **name**: Short semantic name (e.g., "user-head", "arrow-shaft", "document-body")
2. **category**: One of: body, head, modifier, container, indicator, detail, connector
3. **geometricType**: Analyze the shape topology. Choose ONE:
   - circle: Perfect circle or ring
   - square: Equal sides, sharp or rounded corners
   - rect: Non-square rectangle
   - capsule: Pill shape (rounded rectangle with full radius ends)
   - triangle: Three-sided polygon
   - line: Straight stroke
   - curve: Simple arc or squiggle
   - L-shape: 90-degree bend
   - U-shape: Open container/cup shape
   - cross: Plus or X shape
   - complex: Irregular or detailed shape
4. **semanticTags**: 2-4 tags describing function/meaning

IMPORTANT: For geometricType, analyze the ACTUAL SHAPE, not the meaning.
- A battery body is a "capsule" (rounded rectangle)
- A stop button is a "square"
- A play button is a "triangle"
- A radio button is a "circle"

Respond with valid JSON only:
{
  "components": [
    {
      "elementIndex": 0,
      "name": "...",
      "category": "...",
      "geometricType": "...",
      "semanticTags": ["..."]
    }
  ]
}`;
```

---

### Task 1.3: Add Geometric Indexing Keys

**File:** `src/lib/component-indexer.ts`

Update `buildComponentIndex()` to add `geometric:*` keys:

```typescript
export async function buildComponentIndex(
  icons: Icon[],
  apiKey?: string,
  onProgress?: (current: number, total: number, iconName: string) => void
): Promise<Map<string, IconComponent[]>> {
  const index = new Map<string, IconComponent[]>();
  // ... existing code ...

  for (const component of components) {
    // Existing indexes: name, tag, category, source
    // ...existing code...

    // NEW: Index by geometric type
    if (component.geometricType && component.geometricType !== 'complex') {
      const geoKey = `geometric:${component.geometricType}`;
      const geoExisting = index.get(geoKey) || [];
      geoExisting.push(component);
      index.set(geoKey, geoExisting);
    }
  }

  return index;
}
```

Add a helper function for geometric searches:

```typescript
/**
 * Find components by geometric type (the "Blueprint Protocol")
 */
export function findByGeometry(
  index: Map<string, IconComponent[]>,
  type: GeometricType
): IconComponent[] {
  return index.get(`geometric:${type}`) || [];
}
```

---

### Task 1.4: Update searchComponents for Geometric Queries

**File:** `src/lib/component-indexer.ts`

```typescript
export function searchComponents(
  index: Map<string, IconComponent[]>,
  query: string
): IconComponent[] {
  const results: IconComponent[] = [];
  const queryLower = query.toLowerCase();

  // Direct name match
  const nameMatch = index.get(queryLower);
  if (nameMatch) results.push(...nameMatch);

  // Tag match
  const tagMatch = index.get(`tag:${queryLower}`);
  if (tagMatch) results.push(...tagMatch);

  // NEW: Geometric match (explicit prefix)
  if (queryLower.startsWith('geometric:')) {
    const geoMatch = index.get(queryLower);
    if (geoMatch) results.push(...geoMatch);
  } else {
    // Also try implicit geometric match
    const geoMatch = index.get(`geometric:${queryLower}`);
    if (geoMatch) results.push(...geoMatch);
  }

  // Source match
  const sourceMatch = index.get(`source:${queryLower}`);
  if (sourceMatch) results.push(...sourceMatch);

  // Partial match fallback
  // ... existing code ...

  return [...new Set(results)]; // Deduplicate
}
```

---

## Phase 2: Blueprint Protocol (Logic Layer)

**Goal:** Kitbash plans by shape requirements, not by icon names.

### Task 2.1: Add Geometric Decomposition Function

**File:** `src/lib/decomposition-service.ts`

Add a new function that breaks concepts into geometric primitives:

```typescript
/**
 * Geometric primitive for Kitbash Blueprint Protocol
 */
export interface GeometricPrimitive {
  role: string;           // e.g., "body", "nose", "fins"
  shape: GeometricType;   // e.g., "capsule", "triangle"
  aspect?: 'tall' | 'wide' | 'square';  // Optional aspect ratio hint
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Blueprint - geometric decomposition for Kitbash
 */
export interface Blueprint {
  concept: string;
  primitives: GeometricPrimitive[];
  assembly: string[];  // Connection rules
  source: 'static' | 'dynamic';
}

/**
 * Decompose a concept into geometric primitives (Sprint 07: Blueprint Protocol)
 *
 * Instead of: "rocket" → ["fuselage", "nose-cone", "fins"]
 * We get:     "rocket" → [{ role: "body", shape: "capsule", aspect: "tall" },
 *                         { role: "nose", shape: "triangle", position: "top" },
 *                         { role: "fins", shape: "triangle", position: "bottom" }]
 */
export async function getGeometricDecomposition(
  concept: string,
  apiKey?: string
): Promise<Blueprint> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  if (!resolvedApiKey) {
    // Return basic fallback
    return {
      concept,
      primitives: [{ role: 'main', shape: 'complex' }],
      assembly: [],
      source: 'static',
    };
  }

  const genAI = new GoogleGenerativeAI(resolvedApiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are a geometric shape analyst. Break down "${concept}" into GEOMETRIC PRIMITIVES for icon construction.

IMPORTANT: Think about SHAPES, not semantics. What primitive forms make up this concept?

Available shapes:
- circle: Perfect circle or ring
- square: Equal sides
- rect: Non-square rectangle
- capsule: Pill/stadium shape (rounded rectangle with semicircle ends)
- triangle: Three-sided
- line: Straight stroke
- curve: Arc or squiggle
- L-shape: 90-degree bend
- U-shape: Open container shape
- cross: Plus or X shape
- complex: Only if truly irregular

Examples:
- "rocket" → [{ role: "body", shape: "capsule", aspect: "tall" },
              { role: "nose", shape: "triangle", position: "top" },
              { role: "fins", shape: "triangle", position: "bottom" }]
- "TV" → [{ role: "screen", shape: "rect" },
          { role: "stand", shape: "rect", aspect: "wide" }]
- "battery" → [{ role: "case", shape: "capsule" },
               { role: "terminal", shape: "rect", position: "top" }]
- "play button" → [{ role: "main", shape: "triangle" }]

For "${concept}", provide the geometric breakdown.

Respond with valid JSON only:
{
  "primitives": [
    { "role": "...", "shape": "...", "aspect": "tall|wide|square", "position": "top|bottom|left|right|center" }
  ],
  "assembly": ["Nose aligns to top of body", "Fins attach to bottom of body"]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    });

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      concept,
      primitives: parsed.primitives || [],
      assembly: parsed.assembly || [],
      source: 'dynamic',
    };
  } catch (error) {
    console.error('[Decomposition] Geometric decomposition failed:', error);
    return {
      concept,
      primitives: [{ role: 'main', shape: 'complex' }],
      assembly: [],
      source: 'dynamic',
    };
  }
}
```

---

### Task 2.2: Update Kitbash Engine to Use Blueprint Protocol

**File:** `src/lib/kitbash-engine.ts`

Replace `identifySourceIcons()` with shape-based planning:

```typescript
import { getGeometricDecomposition, Blueprint, GeometricPrimitive } from './decomposition-service';
import { findByGeometry, GeometricType } from './component-indexer';

/**
 * A geometric match from the library (Sprint 07)
 */
export interface GeometricMatch {
  primitive: GeometricPrimitive;  // What we're looking for
  component: IconComponent;        // What we found
  sourceIcon: string;              // Where it came from
  confidence: number;              // Match quality
}

/**
 * Find components matching a geometric primitive
 */
function findGeometricMatches(
  primitive: GeometricPrimitive,
  componentIndex: Map<string, IconComponent[]>
): IconComponent[] {
  // Direct geometric type match
  const geometricMatches = findByGeometry(componentIndex, primitive.shape as GeometricType);

  // Filter by aspect ratio if specified
  if (primitive.aspect && geometricMatches.length > 0) {
    return geometricMatches.filter(comp => {
      const bbox = comp.boundingBox;
      const aspectRatio = bbox.width / bbox.height;

      if (primitive.aspect === 'tall') return aspectRatio < 0.8;
      if (primitive.aspect === 'wide') return aspectRatio > 1.2;
      if (primitive.aspect === 'square') return aspectRatio >= 0.8 && aspectRatio <= 1.2;
      return true;
    });
  }

  return geometricMatches;
}

/**
 * Select the best geometric match from candidates
 */
function selectBestGeometricMatch(
  primitive: GeometricPrimitive,
  candidates: IconComponent[]
): GeometricMatch | null {
  if (candidates.length === 0) return null;

  // Score candidates
  const scored = candidates.map(comp => {
    let score = 0;

    // Prefer simpler components (lower weight = less visual mass = simpler)
    score += (1 - comp.weight) * 30;

    // Prefer body/container categories for structural parts
    if (comp.category === 'body' || comp.category === 'container') {
      score += 20;
    }

    // Penalize complex geometricType
    if (comp.geometricType === 'complex') {
      score -= 50;
    }

    return { component: comp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    primitive,
    component: best.component,
    sourceIcon: best.component.sourceIcon,
    confidence: Math.min(1, best.score / 50),
  };
}

/**
 * Plan Kitbash using Blueprint Protocol (Sprint 07)
 */
export async function planKitbashGeometric(
  concept: string,
  componentIndex: Map<string, IconComponent[]>,
  apiKey?: string
): Promise<KitbashPlan> {
  // 1. Get geometric decomposition (shapes, not names)
  const blueprint = await getGeometricDecomposition(concept, apiKey);
  console.log(`[Kitbash] Blueprint for "${concept}":`, blueprint.primitives);

  // 2. Search library for each shape
  const foundParts: KitbashMatch[] = [];
  const missingParts: string[] = [];

  for (const primitive of blueprint.primitives) {
    const candidates = findGeometricMatches(primitive, componentIndex);

    if (candidates.length > 0) {
      const match = selectBestGeometricMatch(primitive, candidates);
      if (match) {
        foundParts.push({
          partName: `${primitive.role} (${primitive.shape})`,
          sourceIcon: match.sourceIcon,
          component: match.component,
          confidence: match.confidence,
          transformRequired: { scale: 1, translateX: 0, translateY: 0 },
        });
      }
    } else {
      missingParts.push(`${primitive.role} (${primitive.shape})`);
    }
  }

  // 3. Calculate coverage
  const coverage = blueprint.primitives.length > 0
    ? foundParts.length / blueprint.primitives.length
    : 0;

  // 4. Determine strategy
  let strategy: AssemblyStrategy;
  if (coverage >= 0.9) strategy = 'graft';
  else if (coverage >= 0.5) strategy = 'hybrid';
  else if (foundParts.length === 1) strategy = 'adapt';
  else strategy = 'generate';

  console.log(`[Kitbash] Blueprint coverage: ${(coverage * 100).toFixed(0)}%, Strategy: ${strategy}`);

  // 5. Generate layout suggestions with assembly hints
  const suggestedLayouts = await generateLayoutsFromBlueprint(
    concept,
    foundParts,
    missingParts,
    blueprint.assembly,
    apiKey
  );

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
```

---

### Task 2.3: Add Layout Generator with Assembly Constraints

**File:** `src/lib/kitbash-engine.ts`

```typescript
/**
 * Generate layouts using Blueprint assembly rules
 */
async function generateLayoutsFromBlueprint(
  concept: string,
  parts: KitbashMatch[],
  missingParts: string[] = [],
  assemblyRules: string[] = [],
  apiKey?: string
): Promise<SkeletonLayout[]> {
  const resolvedApiKey = apiKey || process.env.GOOGLE_API_KEY;
  const allPartNames = [...parts.map(p => p.partName), ...missingParts];

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
    ? `\n\nASSEMBLY CONSTRAINTS:\n${assemblyRules.map(r => `- ${r}`).join('\n')}`
    : '';

  const prompt = `You are an icon layout expert. Create layouts for "${concept}".

AVAILABLE PARTS:
${partInfo}
${missingParts.length > 0 ? `\nMISSING (need positions): ${missingParts.join(', ')}` : ''}
${assemblyInfo}

Canvas: 24×24 with 2px padding (usable: 2-22)

ALIGNMENT INSTRUCTIONS:
When positioning parts, specify exact alignment:
- "Align Center-Bottom of [Nose] to Center-Top of [Body]"
- "Align Center of [Badge] to Bottom-Right of [Container]"

Suggest 3 layouts with:
1. Standard: Follow assembly constraints literally
2. Compact: Badge-style overlay
3. Creative: Distinctive arrangement

For each part, specify: x, y (center), scale, zIndex, and alignment instruction.

JSON only:
{
  "layouts": [
    {
      "name": "standard",
      "description": "...",
      "positions": {
        "body (capsule)": { "x": 12, "y": 12, "scale": 0.8, "zIndex": 0, "align": "center" },
        "nose (triangle)": { "x": 12, "y": 4, "scale": 0.4, "zIndex": 1, "align": "center-bottom to center-top of body" }
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
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    return (parsed.layouts || []).map((l: any) => ({
      name: l.name || 'unknown',
      description: l.description || '',
      positions: l.positions || {},
    }));
  } catch (error) {
    console.error('[Kitbash] Layout generation failed:', error);
    return getDefaultLayouts(parts, missingParts);
  }
}
```

---

## Phase 3: Assembly & Polish

### Task 3.1: Update planKitbash to Use Geometric Mode

**File:** `src/lib/kitbash-engine.ts`

```typescript
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
    return planKitbashGeometric(concept, componentIndex, apiKey);
  }

  // Fallback to original semantic planning
  // ... existing planKitbash code ...
}
```

---

### Task 3.2: Update UI Feedback (AIIconGeneratorModal)

**File:** `src/components/dialogs/AIIconGeneratorModal.tsx`

Update the Kitbash results display to show geometric information:

```typescript
// In the plan display section, show geometric matches:
{plan.foundParts.map((part, i) => (
  <div key={i} className="flex items-center gap-2">
    <span className="text-green-600">✓</span>
    <span>
      {part.partName}
      <span className="text-muted-foreground text-xs ml-2">
        from {part.sourceIcon}
      </span>
    </span>
  </div>
))}

// Example output:
// ✓ body (capsule) from battery
// ✓ nose (triangle) from play
// ✗ fins (triangle) - will generate
```

---

## Phase 4: Re-Enrichment Script

### Task 4.1: Create Re-enrichment Script

**File:** `scripts/re-enrich-geometric.ts`

```typescript
/**
 * Re-enrich existing icons with geometric type classification
 * Run: npx tsx scripts/re-enrich-geometric.ts
 */

import { Icon } from '../src/types/schema';
import { indexIconComponents } from '../src/lib/component-indexer';
import * as fs from 'fs';
import * as path from 'path';

async function reEnrich() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY required');
    process.exit(1);
  }

  // Load existing library
  const libPath = path.join(process.cwd(), 'data', 'feather-icons.json');
  const library = JSON.parse(fs.readFileSync(libPath, 'utf-8')) as Icon[];

  console.log(`Re-enriching ${library.length} icons with geometric types...`);

  let enriched = 0;
  for (const icon of library) {
    const components = await indexIconComponents(icon, apiKey);
    icon.components = components;
    icon.componentSignature = components
      .map(c => `${c.name}:${c.geometricType}`)
      .sort()
      .join('+');

    enriched++;
    if (enriched % 10 === 0) {
      console.log(`Progress: ${enriched}/${library.length}`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  // Save updated library
  fs.writeFileSync(libPath, JSON.stringify(library, null, 2));
  console.log('Done! Library updated with geometric types.');
}

reEnrich().catch(console.error);
```

---

## Testing Strategy

### Unit Tests

1. **Schema Tests**
   - Validate GeometricTypeSchema enum values
   - Ensure IconComponentSchema accepts geometricType

2. **Indexer Tests**
   - Verify `geometric:*` keys are created
   - Test `findByGeometry()` returns correct matches

3. **Blueprint Tests**
   - Verify `getGeometricDecomposition()` returns valid primitives
   - Test fallback for unknown concepts

### Integration Tests

1. **Kitbash Flow**
   - Input: "rocket" concept
   - Expected: Finds capsule (body) + triangle (nose/fins)
   - Coverage should be >50% with geometric matching

2. **Before/After Comparison**
   - Same concept with old (semantic) vs new (geometric) planning
   - Geometric should find more matches for abstract concepts

---

## Migration Notes

### Backward Compatibility

- The `geometricType` field defaults to `'complex'` for existing components
- Old component data without `geometricType` will still work
- The UI gracefully handles missing geometric info

### Performance Considerations

- Geometric indexing adds ~O(n) overhead during enrichment
- Index size increases by ~15-20% (new `geometric:*` keys)
- No runtime performance impact for searches (still O(1) lookup)

---

## Success Criteria

| Metric | Current | Target |
|--------|---------|--------|
| "Rocket" Kitbash coverage | 0% (no semantic match) | >60% (geometric match) |
| "TV" Kitbash coverage | 0% | >40% |
| Average Kitbash coverage | ~20% | >50% |
| Assembly visual quality | 2/10 | 6/10 |

---

## File Change Summary

| File | Changes |
|------|---------|
| `src/types/schema.ts` | Add `GeometricTypeSchema`, update `IconComponentSchema` |
| `src/lib/component-indexer.ts` | Update prompt, add `geometric:*` indexing, add `findByGeometry()` |
| `src/lib/decomposition-service.ts` | Add `getGeometricDecomposition()`, `Blueprint` type |
| `src/lib/kitbash-engine.ts` | Add `planKitbashGeometric()`, `findGeometricMatches()`, update layouts |
| `src/components/dialogs/AIIconGeneratorModal.tsx` | Update plan display for geometric info |
| `scripts/re-enrich-geometric.ts` | New script for re-enrichment |

---

## Implementation Order

1. **Phase 1 (Data Layer)** - ~1-2 hours
   - Task 1.1: Schema update
   - Task 1.2: Prompt update
   - Task 1.3-1.4: Indexing update

2. **Phase 2 (Logic Layer)** - ~2-3 hours
   - Task 2.1: Geometric decomposition
   - Task 2.2: Blueprint planning
   - Task 2.3: Layout with assembly

3. **Phase 3 (Polish)** - ~1 hour
   - Task 3.1: Wire up geometric mode
   - Task 3.2: UI updates

4. **Phase 4 (Testing)** - ~1 hour
   - Re-enrichment script
   - Manual testing with rocket/TV/etc.

**Total Estimated Effort:** 5-7 hours

---

*Ready for implementation. Proceed with Phase 1?*
