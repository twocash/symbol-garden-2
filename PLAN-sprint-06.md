# Sprint 06: Stability & Polish

> **Status:** ✅ COMPLETE
> **Branch:** busy-cerf
> **Predecessor:** devbridge-context.md v0.4.1

## Implementation Progress

### ✅ Completed
- [x] **Phase 1: Iron Dome** - `src/lib/svg-processor.ts` created
  - Dual-mode processing (`ingest` vs `generate`)
  - StyleProfile from EnforcementRules
  - Mode-aware SVGO configuration (disables mergePaths/convertShapeToPath in generate mode)
  - Integrated into `hybrid-generator.ts` and `kitbash-engine.ts`

- [x] **Phase 2: Semantic Bridge**
  - Added `source:iconName` indexing to `component-indexer.ts`
  - Centralized `SEMANTIC_ONTOLOGY` and `COMMON_ICON_NAMES` in `pattern-library.ts`
  - Updated `findComponentMatches` in `kitbash-engine.ts` to check source key FIRST

- [x] **Phase 3: Kitbash Refinery (Backend)**
  - Added `KitbashRenderMode` type (`'draft'` | `'final'`)
  - `executeKitbash` now accepts `renderMode` parameter
  - Implemented `refineIcon()` in `hybrid-generator.ts`
  - Low-temperature "code refactoring" prompt strategy

- [x] **Phase 3: Refine UI** - Add "Refine" button to AIIconGeneratorModal
  - Purple accent for refined icons
  - Draft/Refined toggle to compare before/after
  - Displays list of refinement changes

- [x] **Phase 4: UI Polish** - Fix missing heart/menu indicators
  - Heart icon now visible persistently when favorited
  - Added context menu with Copy SVG, Copy Path, Download, Favorite actions
  - Toast notifications for all actions

### 🔄 Deferred
- [ ] **Phase 4: Testing** - Golden Master test suite (post-sprint)

---

## Executive Summary

This sprint eliminates "randomness" and "fragility" in the generation pipeline through two architectural pillars plus critical UI fixes.

**Core Deliverables:**
1. **Iron Dome** - Unified SVG processing pipeline with mode-aware enforcement
2. **Kitbash Refinery** - Transform assembled "sketches" into cohesive icons
3. **Semantic Bridge** - Align Indexer vocabulary with Kitbash Planner
4. **UI Polish** - Restore missing indicators (favorites, context menu)

**Deferred:** Smart Ghosting (Pillar C from original PRD) - context-aware optical density

---

## Priority 1: The Iron Dome (Backend Stability)

### Goal
A unified pipeline that sanitizes and standardizes all SVG processing with two modes:
- **Ingest Mode (Permissive):** Accept icons "as is" from external sources
- **Generate Mode (Strict):** Enforce editability for created icons

### Technical Specification

#### New File: `src/lib/svg-processor.ts`

```typescript
export interface StyleProfile {
  // Source: Derived from LibrarySchema.styleManifest via rulesFromManifest()
  renderStyle: 'stroke' | 'fill' | 'mixed';
  strokeWidth?: number;
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  viewBoxSize: number;

  // Optimization constraints (mode-dependent)
  allowPathMerging: boolean;      // false for 'generate' mode
  allowShapeToPath: boolean;      // false for 'generate' mode
  precision: number;              // decimal places (default: 2)
}

export type ProcessingMode = 'ingest' | 'generate';

export interface ProcessResult {
  svg: string;
  warnings: string[];
  metrics: {
    originalSize: number;
    processedSize: number;
    elementsPreserved: number;
  };
}

export class SVGProcessor {
  /**
   * Main entry point for all SVG processing
   */
  static process(
    rawSvg: string,
    mode: ProcessingMode,
    libraryManifest?: StyleManifest
  ): ProcessResult;

  /**
   * Pipeline stages (internal):
   * 1. sanitize() - Remove scripts, non-SVG tags, event handlers
   * 2. normalize() - Convert style="" to native attributes
   * 3. enforce() - Apply style-enforcer rules (if manifest provided)
   * 4. optimize() - SVGO with mode-aware config
   * 5. validate() - Bounds check, required attributes
   */
}
```

### Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 1.1 | `src/lib/svg-processor.ts` | Create new class, consolidate logic from `svg-optimizer.ts` and `style-enforcer.ts` |
| 1.2 | `src/lib/svg-processor.ts` | Configure SVGO plugins programmatically based on mode |
| 1.3 | `src/lib/style-enforcer.ts` | Expand `rulesFromManifest()` to return full `StyleProfile` |
| 1.4 | `src/lib/ingestion-service.ts` | Replace direct optimization with `SVGProcessor.process(svg, 'ingest')` |
| 1.5 | `src/lib/hybrid-generator.ts` | Replace `optimizeSvg` with `SVGProcessor.process(svg, 'generate', manifest)` |
| 1.6 | `src/lib/kitbash-engine.ts` | Replace optimization with `SVGProcessor.process(svg, 'generate', manifest)` |

### SVGO Configuration by Mode

```typescript
// 'ingest' mode - permissive
const ingestPlugins = [
  'removeDoctype',
  'removeComments',
  'removeMetadata',
  'cleanupIds',
  // Allow: mergePaths, convertShapeToPath (accept as-is)
];

// 'generate' mode - strict (preserve editability)
const generatePlugins = [
  'removeDoctype',
  'removeComments',
  'removeMetadata',
  'cleanupIds',
  'cleanupNumericValues',
  // DISABLED: mergePaths (keep components separate)
  // DISABLED: convertShapeToPath (preserve <circle>, <rect>)
];
```

---

## Priority 2: The Kitbash Refinery (Quality)

### Goal
Transform Kitbash "Frankenstein" assemblies into cohesive, production-ready icons.

### Approach: "Topology Repair" (not full redraw)
- Frame as **code refactoring**, not image generation
- Target: Merge overlapping paths, fix disjointed corners
- Input: SVG text (not PNG) - cheaper, more precise

### Technical Specification

#### Update: `src/lib/kitbash-engine.ts`

```typescript
export interface KitbashResult {
  svg: string;
  plan: KitbashPlan;
  renderMode: 'draft' | 'final';  // NEW
}

export async function executeKitbash(
  plan: KitbashPlan,
  layout: SkeletonLayout,
  icons: Icon[],
  config: GenerationConfig,
  renderMode: 'draft' | 'final' = 'draft'  // NEW: default to draft
): Promise<KitbashResult>;
```

#### New Function: `src/lib/hybrid-generator.ts`

```typescript
/**
 * Refine a draft Kitbash assembly into a cohesive icon
 * Uses Gemini 2.5 Flash as "code refactoring" task
 */
export async function refineIcon(
  draftSvg: string,
  concept: string,
  config: GenerationConfig
): Promise<{
  svg: string;
  refinementApplied: boolean;
  changes: string[];  // Description of what was fixed
}>;
```

#### Prompt Strategy

```
You are an SVG code refactoring expert. I have a valid SVG that was mechanically
assembled from multiple icon components. It contains visual artifacts:
- Overlapping stroke paths that should be merged
- Disjointed corners where paths should connect smoothly
- Redundant path segments

TASK: Refactor the SVG code to fix these artifacts.

RULES:
1. Preserve the exact visual geometry - do not add or remove shapes
2. Merge overlapping paths into clean single strokes where appropriate
3. Connect disjointed path endpoints that are within 1px of each other
4. Maintain all existing style attributes (stroke-width, stroke-linecap, etc.)
5. Output valid SVG only

INPUT SVG:
[draftSvg]

OUTPUT: The refactored SVG code only, no explanation.
```

### Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 2.1 | `src/lib/kitbash-engine.ts` | Add `renderMode` parameter, return raw assembly in 'draft' mode |
| 2.2 | `src/lib/hybrid-generator.ts` | Implement `refineIcon()` function with topology repair prompt |
| 2.3 | `src/lib/hybrid-generator.ts` | Add fallback handling if refinement returns invalid SVG |
| 2.4 | `src/components/dialogs/AIIconGeneratorModal.tsx` | Add "Refine" button after Kitbash completes |
| 2.5 | `src/components/dialogs/AIIconGeneratorModal.tsx` | Add Draft/Refined toggle to compare results |

### Feature Flag

```env
NEXT_PUBLIC_ENABLE_REFINERY=true
```

If disabled, Kitbash returns draft directly (current behavior) - graceful degradation.

---

## Priority 3: Semantic Bridge (Indexer ↔ Kitbash Alignment)

### Problem Statement
Two AI agents speaking different dialects:
- **Indexer (F3):** Labels shapes visually ("person-torso")
- **Kitbash Planner (F4):** Thinks in filenames ("user")

Lookup fails because vocabulary doesn't match.

### Fix 1: Source Icon Indexing

#### Update: `src/lib/component-indexer.ts`

```typescript
export async function buildComponentIndex(icons: Icon[]): Promise<ComponentIndex> {
  const index = new Map<string, IconComponent[]>();

  for (const icon of icons) {
    for (const component of icon.components || []) {
      // Existing: Index by component name
      addToIndex(index, component.name, component);

      // Existing: Index by semantic tags
      for (const tag of component.semanticTags) {
        addToIndex(index, tag, component);
      }

      // NEW: Index by source icon name
      // If icon is "user", all parts retrievable via "user"
      const sourceKey = `source:${icon.name.toLowerCase()}`;
      addToIndex(index, sourceKey, component);
    }
  }

  return index;
}
```

#### Update: `src/lib/kitbash-engine.ts`

```typescript
function findComponentMatches(partName: string, index: ComponentIndex): IconComponent[] {
  // Try exact match first
  const exact = index.get(partName.toLowerCase());
  if (exact?.length) return exact;

  // NEW: Try source icon lookup
  const sourceMatch = index.get(`source:${partName.toLowerCase()}`);
  if (sourceMatch?.length) return sourceMatch;

  // Existing: fuzzy/semantic matching...
}
```

### Fix 2: Shared Ontology

#### New/Update: `src/lib/pattern-library.ts`

```typescript
/**
 * Canonical vocabulary for icon components
 * Used by both Indexer and Kitbash Planner
 */
export const SEMANTIC_ONTOLOGY = {
  // People
  people: ['user', 'person', 'avatar', 'profile', 'account'],

  // Security
  security: ['lock', 'unlock', 'shield', 'key', 'secure'],

  // Actions
  actions: ['edit', 'delete', 'add', 'remove', 'save', 'cancel'],

  // Directions
  directions: ['arrow', 'chevron', 'caret', 'pointer'],

  // Objects
  objects: ['file', 'folder', 'document', 'mail', 'envelope'],

  // ... expand as needed
} as const;

export const COMMON_COMPONENT_NAMES = [
  // Body parts
  'head', 'body', 'torso', 'arm', 'hand', 'leg',

  // Shapes
  'circle', 'rectangle', 'triangle', 'arc', 'line',

  // Semantic parts
  'container', 'indicator', 'modifier', 'badge', 'handle',

  // ... existing COMMON_ICON_PARTS content
];
```

#### Update: `src/lib/component-indexer.ts` (Prompt Injection)

```typescript
const indexingPrompt = `
Analyze this SVG icon and identify its components.

Use standard naming conventions from this vocabulary where applicable:
${COMMON_COMPONENT_NAMES.join(', ')}

For each component, provide:
- name: Use vocabulary terms when possible
- category: body | head | modifier | container | indicator | detail | connector
- semanticTags: Related concepts (e.g., ["directional", "upward"] for an arrow)

...
`;
```

### Fix 3: Semantic Manifest (Future Enhancement)

**Scope:** Deferred to post-sprint polish

Expand `generateLibraryManifest` to include naming convention analysis:
- Does library use 'user' or 'person'?
- Does library use 'trash' or 'bin'?
- Inject into Kitbash Planner for intelligent translation

### Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 3.1 | `src/lib/component-indexer.ts` | Add source icon name indexing |
| 3.2 | `src/lib/kitbash-engine.ts` | Add source key lookup in `findComponentMatches` |
| 3.3 | `src/lib/pattern-library.ts` | Centralize `SEMANTIC_ONTOLOGY` and `COMMON_COMPONENT_NAMES` |
| 3.4 | `src/lib/component-indexer.ts` | Inject vocabulary into indexing prompt |
| 3.5 | `src/lib/kitbash-engine.ts` | Remove duplicate `COMMON_ICON_PARTS`, import from pattern-library |

---

## Priority 4: UI Polish (Paper Cuts)

### Missing Indicators

| Issue | Location | Fix |
|-------|----------|-----|
| Heart (Favorite) icon not rendering | `IconCard.tsx` | Verify SVG path, check conditional rendering |
| Context menu ("...") not rendering | `IconCard.tsx` | Verify DropdownMenu trigger visibility |
| Toast notifications inconsistent | Various | Ensure all save/copy actions fire toasts |

### Implementation Tasks

| Task | File | Description |
|------|------|-------------|
| 4.1 | `src/components/icons/IconCard.tsx` | Debug and fix favorite heart icon |
| 4.2 | `src/components/icons/IconCard.tsx` | Debug and fix context menu trigger |
| 4.3 | Various | Audit and standardize toast notifications |

---

## Testing Strategy

### Golden Master Test Suite

Create deterministic test cases:

```typescript
// scripts/test-iron-dome.ts
const GOLDEN_INPUTS = [
  { concept: 'user-shield', expectedPaths: 2 },
  { concept: 'lock-open', expectedPaths: 3 },
  { concept: 'file-text', expectedPaths: 4 },
  // ...
];

// Generate once, save as gold standard
// Re-run: Generate → Process → Compare DOM structure
// Pass criteria: Identical structure (deterministic)
```

### Regression Prevention

1. Before each Iron Dome refactor, snapshot current outputs
2. After refactor, compare new outputs
3. Any visual difference requires explicit approval

---

## Rollback Safety

### Feature Flags

```env
# Refinery toggle (Kitbash enhancement)
NEXT_PUBLIC_ENABLE_REFINERY=true

# Iron Dome strict mode (can fallback to legacy optimizer)
NEXT_PUBLIC_IRON_DOME_STRICT=true
```

### Graceful Degradation

| Flag Off | Behavior |
|----------|----------|
| `ENABLE_REFINERY=false` | Kitbash returns draft (current behavior) |
| `IRON_DOME_STRICT=false` | Use legacy `svg-optimizer.ts` directly |

---

## Implementation Order

### Phase 1: Foundation (Iron Dome)
1. Create `SVGProcessor` class
2. Implement dual-mode SVGO configuration
3. Wire up to ingestion path
4. Wire up to generation path
5. Wire up to Kitbash path

### Phase 2: Semantic Bridge
1. Add source icon indexing
2. Centralize ontology
3. Inject vocabulary into indexer prompt
4. Update Kitbash lookup logic

### Phase 3: Refinery
1. Add `renderMode` to Kitbash
2. Implement `refineIcon()`
3. Add UI controls

### Phase 4: Polish
1. Fix UI indicators
2. Standardize toasts
3. Testing and validation

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Style Regressions | 0 | Golden master tests pass |
| Kitbash Coverage | >50% for compound concepts | Before: ~0%, After: measure |
| Refinery Success Rate | >80% valid SVG output | Track invalid returns |
| UI Indicators | 100% visible | Manual verification |

---

## Files Changed (Summary)

| File | Action | Priority |
|------|--------|----------|
| `src/lib/svg-processor.ts` | CREATE | P1 |
| `src/lib/svg-optimizer.ts` | DEPRECATE/WRAP | P1 |
| `src/lib/style-enforcer.ts` | INTEGRATE | P1 |
| `src/lib/ingestion-service.ts` | UPDATE | P1 |
| `src/lib/hybrid-generator.ts` | EXPAND | P1, P3 |
| `src/lib/kitbash-engine.ts` | UPDATE | P2, P3 |
| `src/lib/component-indexer.ts` | UPDATE | P3 |
| `src/lib/pattern-library.ts` | UPDATE | P3 |
| `src/components/dialogs/AIIconGeneratorModal.tsx` | UPDATE | P2 |
| `src/components/icons/IconCard.tsx` | UPDATE | P4 |

---

*Document ready for sprint execution. Awaiting approval.*
