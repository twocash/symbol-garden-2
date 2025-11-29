# PRD: Sprout Engine - Vector Assembly for Native-Quality Icons

**Version:** 1.0
**Date:** 2025-11-29
**Status:** Draft
**Author:** Claude + Jim

---

## Executive Summary

Symbol Garden's AI generation treats the LLM as a "sketch artist" - asking it to draw icons from scratch. This leads to inconsistent results because LLMs are fundamentally bad at precise geometry but good at concepts.

The **Sprout Engine** flips this paradigm: treat the AI as a **Vector Engineer** that assembles icons from existing library parts. A perfect sprout isn't drawn from memory; it's grown from the genetic material of the existing library.

### Core Insight

> "Why generate paths from scratch when we can assemble from proven parts?"

The goal is **indistinguishable native quality** - generated icons that are mathematically identical in style because they're literally built from the library's DNA.

---

## Problem Statement

### Current Limitations

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Inconsistent stroke weights | LLM draws from description, not measurement | Icons look "off" next to library icons |
| Wrong corner radii | No geometric awareness in generation | Subtle but noticeable style drift |
| Poor spatial composition | LLM guesses layout vs. learning from examples | Elements in wrong positions |
| Wasted API calls | Generate → Reject → Regenerate cycle | Slow, expensive, frustrating |
| No quality guarantee | Probabilistic output, hope for the best | Production unusable results |

### The Native Standard

An icon passes the "native test" if a designer cannot distinguish it from native library icons when shown in context. This requires:

1. **Identical stroke attributes** - Not "similar", mathematically same
2. **Consistent corner treatment** - Same radius curves
3. **Matching optical weight** - Similar path density/complexity
4. **Proper spatial composition** - Elements positioned like library conventions

---

## Solution: The Sprout Engine

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SPROUT ENGINE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  INPUT: "secure user"                                                    │
│         │                                                                │
│         ▼                                                                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   SEMANTIC   │     │   KITBASH    │     │   SKELETON   │            │
│  │   INDEXER    │────▶│   MATCHER    │────▶│   COMPOSER   │            │
│  │              │     │              │     │              │            │
│  │ "What parts  │     │ "Do we have  │     │ "How should  │            │
│  │  exist?"     │     │  these?"     │     │  they fit?"  │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────┐           │
│  │                    DECISION GATE                         │           │
│  │                                                          │           │
│  │  Parts Found: user (100%), shield (85%)                 │           │
│  │  ───────────────────────────────────────                │           │
│  │  Coverage > 70%? → GRAFT (mechanical assembly)          │           │
│  │  Coverage < 70%? → GENERATE (AI fills gaps)             │           │
│  └─────────────────────────────────────────────────────────┘           │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │   STYLE      │     │   GHOST      │     │   COMPLIANCE │            │
│  │   ENFORCER   │────▶│   PREVIEW    │────▶│   VALIDATOR  │            │
│  │              │     │              │     │              │            │
│  │ Deterministic│     │ Context View │     │ Pass/Fail    │            │
│  │ SVG mutation │     │ w/ neighbors │     │ + Auto-fix   │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Semantic Indexer (Foundation)

### Goal
Know **what** is in the library, not just **how** it's styled. Currently we extract Style DNA (geometry). Now we extract **Component DNA** (semantics).

### New Types

```typescript
// src/lib/component-indexer.ts

/**
 * A discrete visual component within an icon
 */
interface IconComponent {
  name: string;           // "arrow-head", "circle-body", "shield-outline"
  category: ComponentCategory;
  pathData: string;       // The actual 'd' attribute for this component
  boundingBox: BoundingBox;
  semanticTags: string[]; // ["directional", "upward", "action"]
  sourceIcon: string;     // Which icon this came from
}

type ComponentCategory =
  | 'body'        // Main shape (user torso, document rectangle)
  | 'head'        // Top element (user head, arrow point)
  | 'modifier'    // Badge, indicator, status symbol
  | 'container'   // Enclosing shape (circle, shield, square)
  | 'indicator'   // Check, x, plus, minus, arrow
  | 'detail'      // Internal lines, decorative elements
  | 'connector';  // Lines joining other elements

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Extended icon with component information
 */
interface IndexedIcon extends Icon {
  components: IconComponent[];
  componentSignature: string;  // "user-body+user-head" for quick matching
  complexity: 'simple' | 'moderate' | 'complex';
}
```

### Implementation

**File:** `src/lib/component-indexer.ts`

```typescript
/**
 * Index an icon's semantic components using LLM analysis
 */
export async function indexIconComponents(
  icon: Icon,
  apiKey: string
): Promise<IconComponent[]> {
  // 1. Parse the SVG to get path data
  const paths = extractPaths(icon.path);

  // 2. Ask LLM to identify what each path represents
  const prompt = `
    Analyze this icon "${icon.name}" with ${paths.length} path(s).

    For each path, identify:
    1. What visual element it represents (e.g., "user head", "arrow shaft")
    2. Its category: body, head, modifier, container, indicator, detail, connector
    3. Semantic tags describing its function

    Return JSON array matching path order.
  `;

  // 3. Map LLM response to IconComponent objects
  // 4. Calculate bounding boxes for each component

  return components;
}

/**
 * Build a searchable index of all components in a library
 */
export async function buildComponentIndex(
  icons: Icon[],
  apiKey: string
): Promise<Map<string, IconComponent[]>> {
  const index = new Map<string, IconComponent[]>();

  for (const icon of icons) {
    const components = await indexIconComponents(icon, apiKey);

    // Index by component name for fast lookup
    for (const component of components) {
      const existing = index.get(component.name) || [];
      existing.push(component);
      index.set(component.name, existing);
    }
  }

  return index;
}
```

### Integration Points

1. **Enrichment Pipeline:** Run component indexing during library import
2. **Storage:** Add `components` field to Icon schema in IndexedDB
3. **Search:** Enable component-based icon search

### Success Criteria

- [ ] Icons have `components` array after enrichment
- [ ] Can search library by component name (e.g., "find icons with arrow-head")
- [ ] Component bounding boxes are accurate within 2px

---

## Phase 2: Kitbash Engine (Assembly)

### Goal
Given a concept like "secure user", find existing components and mechanically assemble them instead of generating from scratch.

### New Types

```typescript
// src/lib/kitbash-engine.ts

/**
 * A plan for assembling an icon from existing parts
 */
interface KitbashPlan {
  concept: string;
  requiredParts: string[];        // ["user", "shield"]
  foundParts: KitbashMatch[];     // Actual matches from library
  missingParts: string[];         // What AI must generate
  coverage: number;               // 0-1, how much we can kitbash
  strategy: AssemblyStrategy;
  suggestedLayouts: SkeletonLayout[];
}

type AssemblyStrategy =
  | 'graft'    // 100% parts found, pure assembly
  | 'hybrid'   // Some parts found, AI fills gaps
  | 'generate' // No parts found, full AI generation
  | 'adapt';   // Single part found, modify existing

interface KitbashMatch {
  partName: string;               // "user"
  sourceIcon: string;             // "user.svg"
  component: IconComponent;
  confidence: number;             // 0-1
  transformRequired: Transform;   // Scale/translate needed
}

interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
  rotate?: number;
}

/**
 * Skeleton layout options for composing parts
 */
interface SkeletonLayout {
  name: string;           // "shield-behind", "badge-corner", "overlay"
  description: string;
  positions: Map<string, Position>;  // Where each part goes
  preview?: string;       // Simple wireframe SVG
}

interface Position {
  x: number;
  y: number;
  scale: number;
  zIndex: number;
}
```

### Core Functions

```typescript
/**
 * Plan how to assemble an icon from concept
 */
export async function planKitbash(
  concept: string,
  library: IndexedIcon[],
  componentIndex: Map<string, IconComponent[]>
): Promise<KitbashPlan> {
  // 1. Decompose concept into required parts
  const decomposition = await getDecomposition(concept);
  const requiredParts = decomposition.parts.map(p => p.name);

  // 2. Search library for each part
  const foundParts: KitbashMatch[] = [];
  const missingParts: string[] = [];

  for (const partName of requiredParts) {
    const matches = findComponentMatches(partName, componentIndex);
    if (matches.length > 0) {
      foundParts.push(selectBestMatch(matches, library));
    } else {
      missingParts.push(partName);
    }
  }

  // 3. Calculate coverage
  const coverage = foundParts.length / requiredParts.length;

  // 4. Determine strategy
  const strategy =
    coverage >= 0.9 ? 'graft' :
    coverage >= 0.5 ? 'hybrid' :
    foundParts.length === 1 ? 'adapt' : 'generate';

  // 5. Generate layout suggestions
  const suggestedLayouts = await generateLayouts(concept, foundParts);

  return {
    concept,
    requiredParts,
    foundParts,
    missingParts,
    coverage,
    strategy,
    suggestedLayouts,
  };
}

/**
 * Execute a kitbash plan to produce an SVG
 */
export async function executeKitbash(
  plan: KitbashPlan,
  selectedLayout: SkeletonLayout,
  styleSpec: StyleSpec
): Promise<string> {
  // 1. Start with empty 24x24 canvas
  let svg = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">';

  // 2. For each found part, transform and add
  for (const match of plan.foundParts) {
    const position = selectedLayout.positions.get(match.partName);
    if (!position) continue;

    const transformedPath = transformPath(
      match.component.pathData,
      match.transformRequired,
      position
    );

    svg += `<path d="${transformedPath}" />`;
  }

  // 3. If hybrid, generate missing parts
  if (plan.strategy === 'hybrid' && plan.missingParts.length > 0) {
    const generated = await generateMissingParts(plan, selectedLayout);
    svg += generated;
  }

  // 4. Apply style enforcement
  svg += '</svg>';
  svg = enforceStyle(svg, styleSpec);

  return svg;
}
```

### Layout Generation

The AI suggests how parts should combine:

```typescript
async function generateLayouts(
  concept: string,
  parts: KitbashMatch[]
): Promise<SkeletonLayout[]> {
  const prompt = `
    Given these icon components: ${parts.map(p => p.partName).join(', ')}
    For the concept: "${concept}"

    Suggest 3 different spatial arrangements:
    1. A conservative, common layout
    2. A compact, badge-style layout
    3. A creative, distinctive layout

    For each, specify x,y positions (0-24 grid) and scale (0-1) for each part.
  `;

  // Parse LLM response into SkeletonLayout objects
}
```

### Success Criteria

- [ ] Can decompose "secure user" into ["user", "shield"]
- [ ] Finds existing components with >80% accuracy
- [ ] Coverage calculation matches manual assessment
- [ ] Layout suggestions are spatially sensible

---

## Phase 3: Style Enforcer (Deterministic Quality)

### Goal
Turn passive style analysis into **active style enforcement**. Don't hope the generated SVG matches - force it to match.

### New Types

```typescript
// src/lib/style-enforcer.ts

/**
 * Result of style compliance check
 */
interface ComplianceResult {
  passed: boolean;
  score: number;              // 0-100
  violations: StyleViolation[];
  autoFixed: string;          // The corrected SVG
  changes: StyleChange[];     // What was modified
}

interface StyleViolation {
  rule: string;               // "stroke-width"
  expected: string;           // "2"
  actual: string;             // "1.5"
  severity: 'error' | 'warning';
  autoFixable: boolean;
  location?: string;          // Which element/path
}

interface StyleChange {
  attribute: string;
  before: string;
  after: string;
  reason: string;
}

/**
 * Rules that can be enforced
 */
interface EnforcementRules {
  strokeWidth: number | null;
  strokeLinecap: 'butt' | 'round' | 'square' | null;
  strokeLinejoin: 'miter' | 'round' | 'bevel' | null;
  cornerRadius: number | null;         // For rect elements
  minStrokeGap: number | null;         // Minimum space between strokes
  maxPathComplexity: number | null;    // Max commands per path
  viewBox: string | null;
  fillRule: 'none' | 'evenodd' | 'nonzero' | null;
}
```

### Implementation

```typescript
/**
 * Enforce style rules on an SVG, returning corrected version
 */
export function enforceStyle(
  svg: string,
  rules: EnforcementRules
): ComplianceResult {
  const violations: StyleViolation[] = [];
  const changes: StyleChange[] = [];
  let fixedSvg = svg;

  // 1. Stroke Width Enforcement
  if (rules.strokeWidth !== null) {
    const actualWidth = extractStrokeWidth(svg);
    if (actualWidth !== rules.strokeWidth) {
      violations.push({
        rule: 'stroke-width',
        expected: String(rules.strokeWidth),
        actual: String(actualWidth),
        severity: 'error',
        autoFixable: true,
      });

      fixedSvg = fixedSvg.replace(
        /stroke-width="[^"]*"/g,
        `stroke-width="${rules.strokeWidth}"`
      );

      changes.push({
        attribute: 'stroke-width',
        before: String(actualWidth),
        after: String(rules.strokeWidth),
        reason: 'Library standard enforcement',
      });
    }
  }

  // 2. Linecap Enforcement
  if (rules.strokeLinecap !== null) {
    const actualCap = extractLinecap(svg);
    if (actualCap !== rules.strokeLinecap) {
      violations.push({
        rule: 'stroke-linecap',
        expected: rules.strokeLinecap,
        actual: actualCap || 'not set',
        severity: 'error',
        autoFixable: true,
      });

      // Add or replace linecap
      if (svg.includes('stroke-linecap=')) {
        fixedSvg = fixedSvg.replace(
          /stroke-linecap="[^"]*"/g,
          `stroke-linecap="${rules.strokeLinecap}"`
        );
      } else {
        fixedSvg = fixedSvg.replace(
          /<svg/,
          `<svg stroke-linecap="${rules.strokeLinecap}"`
        );
      }

      changes.push({
        attribute: 'stroke-linecap',
        before: actualCap || 'none',
        after: rules.strokeLinecap,
        reason: 'Library standard enforcement',
      });
    }
  }

  // 3. Linejoin Enforcement
  if (rules.strokeLinejoin !== null) {
    // Similar to linecap
  }

  // 4. Optical Weight Check (warning only)
  const pathDensity = calculatePathDensity(svg);
  if (pathDensity > 0.4) {  // Too dense
    violations.push({
      rule: 'optical-weight',
      expected: '<0.4',
      actual: String(pathDensity.toFixed(2)),
      severity: 'warning',
      autoFixable: false,  // Requires path simplification
    });
  }

  // 5. ViewBox Enforcement
  if (rules.viewBox !== null) {
    // Ensure viewBox matches
  }

  // Calculate score
  const errorCount = violations.filter(v => v.severity === 'error').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;
  const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));

  return {
    passed: errorCount === 0,
    score,
    violations,
    autoFixed: fixedSvg,
    changes,
  };
}

/**
 * Extract enforcement rules from Style DNA
 */
export function rulesFromStyleDNA(styleSpec: StyleSpec): EnforcementRules {
  return {
    strokeWidth: styleSpec.strokeWidth || null,
    strokeLinecap: styleSpec.strokeLinecap || null,
    strokeLinejoin: styleSpec.strokeLinejoin || null,
    cornerRadius: styleSpec.cornerRadius || null,
    minStrokeGap: null,  // TODO: extract from library analysis
    maxPathComplexity: null,
    viewBox: styleSpec.viewBoxSize ? `0 0 ${styleSpec.viewBoxSize} ${styleSpec.viewBoxSize}` : null,
    fillRule: 'none',  // Stroke-based icons
  };
}
```

### Integration

In `hybrid-generator.ts`, after generation:

```typescript
// After generating SVG
const result = await generateWithLLM(prompt);

// Enforce style compliance
const rules = rulesFromStyleDNA(styleSpec);
const compliance = enforceStyle(result.svg, rules);

console.log(`[Enforcer] Score: ${compliance.score}/100`);
if (compliance.changes.length > 0) {
  console.log(`[Enforcer] Auto-fixed: ${compliance.changes.map(c => c.attribute).join(', ')}`);
}

return {
  ...result,
  svg: compliance.autoFixed,  // Always return the fixed version
  compliance,
};
```

### Success Criteria

- [ ] 100% of generated icons have correct stroke-width after enforcement
- [ ] 100% of generated icons have correct linecap/linejoin after enforcement
- [ ] Compliance score reflects actual visual quality
- [ ] Changes are logged for debugging

---

## Phase 4: Ghost Preview (Contextual Validation)

### Goal
Show the generated icon in context - between actual library icons - so users can instantly see if it matches.

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Does this match your library?                                          │
│                                                                         │
│     Existing         CANDIDATE         Existing                         │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐                       │
│    │         │      │         │      │         │                       │
│    │   🏠    │      │   🛡️👤  │      │   ⚙️    │                       │
│    │         │      │         │      │         │                       │
│    └─────────┘      └─────────┘      └─────────┘                       │
│      Home            Secure User       Settings                         │
│                                                                         │
│  ──────────────────────────────────────────────────────────────────    │
│                                                                         │
│  Compliance: 94/100                                                     │
│  ✅ Stroke Width (2px)                                                  │
│  ✅ Line Cap (round)                                                    │
│  ✅ Line Join (round)                                                   │
│  ⚠️ Optical Weight (slightly dense - 0.38)                             │
│                                                                         │
│  [Auto-Fix Issues]  [Accept As-Is]  [Regenerate]  [Try Different Layout]│
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// In AIIconGeneratorModal.tsx

interface GhostPreviewState {
  leftNeighbor: Icon | null;
  rightNeighbor: Icon | null;
  candidate: string;
  compliance: ComplianceResult | null;
}

// Select neighbors from favorites for context
const selectNeighbors = useCallback(() => {
  if (favorites.length < 2) return { left: null, right: null };

  // Pick random but visually distinct neighbors
  const shuffled = [...favorites].sort(() => Math.random() - 0.5);
  return {
    left: shuffled[0],
    right: shuffled[1],
  };
}, [favorites]);
```

### Success Criteria

- [ ] Generated icon displayed between 2 library icons
- [ ] Compliance score visible with breakdown
- [ ] One-click auto-fix for fixable issues
- [ ] Visual comparison helps users spot mismatches

---

## Phase 5: Skeleton-First Workflow (Composition Control)

### Goal
Let users approve the **structure** before committing to **style**. Separates semantic (what) from syntactic (how) decisions.

### Workflow

1. **User enters concept:** "secure user"
2. **System proposes 3 skeletons:** Simple wireframe layouts
3. **User selects preferred layout**
4. **System applies library style to chosen skeleton**
5. **User reviews final result with Ghost Preview**

### UI Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│  How should "secure user" look?                                         │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │   Shield    │  │   Badge     │  │   Overlay   │                     │
│  │   Behind    │  │   Corner    │  │   Center    │                     │
│  │             │  │             │  │             │                     │
│  │  [   🛡️   ] │  │  [👤]  ✓   │  │  [ 🛡️👤 ]  │                     │
│  │  [ 👤  ]   │  │             │  │             │                     │
│  │             │  │             │  │             │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
│       ○                ○                 ●                              │
│                                                                         │
│  ℹ️ These are structural options. Style will match your Feather library │
│                                                                         │
│  [Generate with Selected Layout]                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
interface SkeletonOption {
  id: string;
  name: string;
  description: string;
  wireframeSvg: string;    // Simple line drawing
  layout: SkeletonLayout;
}

async function generateSkeletonOptions(
  concept: string,
  parts: string[]
): Promise<SkeletonOption[]> {
  const prompt = `
    For the icon concept "${concept}" with parts [${parts.join(', ')}],
    propose 3 different spatial arrangements.

    For each, provide:
    1. A simple wireframe SVG (just lines/circles, no style)
    2. The x,y,scale for each part on 24x24 grid
    3. A descriptive name
  `;

  // Parse response into SkeletonOption array
}
```

### Success Criteria

- [ ] 3 skeleton options presented for compound concepts
- [ ] Wireframes are clear and distinguishable
- [ ] Selected skeleton influences final output
- [ ] Reduces "wrong composition" regeneration cycles

---

## Implementation Phases

### Phase 1: Style Enforcer (Quick Win)
**Effort:** 3-4 hours
**Files:** `src/lib/style-enforcer.ts`, `hybrid-generator.ts`
**Impact:** Immediate quality improvement on all generations

### Phase 2: Ghost Preview UI
**Effort:** 2-3 hours
**Files:** `AIIconGeneratorModal.tsx`
**Impact:** Visual feedback, better user confidence

### Phase 3: Component Tagging (Foundation)
**Effort:** 4-5 hours
**Files:** `src/lib/component-indexer.ts`, enrichment API
**Impact:** Enables kitbashing, improves search

### Phase 4: Kitbash Engine
**Effort:** 6-8 hours
**Files:** `src/lib/kitbash-engine.ts`, new API routes
**Impact:** Paradigm shift - assembly vs generation
**Depends on:** Phase 3

### Phase 5: Skeleton-First UI
**Effort:** 4-5 hours
**Files:** `AIIconGeneratorModal.tsx`, new components
**Impact:** User control over composition
**Depends on:** Phases 3, 4

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Style compliance rate | ~70% | 100% | Enforcer auto-fixes |
| First-attempt acceptance | ~40% | 80% | User accepts without regenerate |
| Composition accuracy | ~60% | 90% | Correct element placement |
| Generation time (kitbash) | N/A | <2s | Assembly vs LLM call |
| User confidence | Medium | High | Ghost preview feedback |

---

## Technical Considerations

### Path Manipulation
SVG path transformation requires:
- Bounding box calculation from path commands
- Scale/translate transformation of coordinates
- Proper handling of relative vs absolute commands

Consider using existing libraries:
- `svg-path-parser` - Parse d attribute
- `svg-path-transformer` - Transform coordinates

### Caching Strategy
Component index should be cached:
- In-memory during session
- Persisted in IndexedDB with icons
- Invalidated on library changes

### Backward Compatibility
- Component indexing is additive (existing icons work)
- Enforcer runs post-generation (doesn't break existing flow)
- Ghost preview is optional UI enhancement

---

## Future Enhancement: Reference-Guided Generation

### Concept

When a user searches Iconify and finds an icon they like (e.g., a Lucide rocket), they could select it as a **structural reference** rather than importing it directly. The system would then generate a new icon with:

- **Structure/Composition** from the selected Iconify icon
- **Style** (stroke-width, linecap, corners) from the user's target library

### UI Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Found in other libraries:                                               │
│                                                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │  🚀     │  │  🚀     │  │  🚀     │  │  🚀     │                    │
│  │ Lucide  │  │ Tabler  │  │ Phosphor│  │ Hero    │                    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                    │
│       ●                                                                  │
│                                                                          │
│  [Import & Adapt]  [Use as Reference →]                                 │
│                                                                          │
│  ℹ️ "Use as Reference" generates a new icon inspired by this             │
│     composition, styled to match your FontAwesome library                │
└─────────────────────────────────────────────────────────────────────────┘
```

### Implementation

1. Pass selected Iconify SVG as `structuralReference` to generation prompt
2. Prompt instructs LLM: "Create an icon with similar spatial arrangement to this reference, but using ONLY the style attributes from the target library"
3. Style Enforcer guarantees compliance post-generation

### Value

- **Better composition** - User can pick proven layouts from 275k+ icons
- **Guaranteed style** - Output matches target library exactly
- **Best of both worlds** - Iconify's variety + local library's consistency

---

## Open Questions

1. **Component naming conventions:** How to ensure consistent naming across LLM calls?
2. **Complex icons:** How to handle icons with 10+ paths?
3. **Hybrid generation:** What's the best prompt for "fill in the gaps"?
4. **Path simplification:** When optical weight is too high, how to simplify?
5. **Reference-guided prompting:** What's the optimal way to describe a reference icon's composition to the LLM without it copying style?

---

## Appendix: Example Kitbash Flow

**Input:** "user with shield check"

**Decomposition:**
- user (body)
- shield (container)
- check (indicator/modifier)

**Library Search:**
- `user.svg` → `user-body` component found (confidence: 95%)
- `shield.svg` → `shield-outline` component found (confidence: 90%)
- `check.svg` → `check-mark` component found (confidence: 100%)

**Coverage:** 100% - Strategy: GRAFT

**Layout Options:**
1. Shield behind user, check as badge (bottom-right)
2. User inside shield outline, check overlay
3. Shield badge on user shoulder, check inside

**Selected:** Option 1

**Assembly:**
```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <!-- shield-outline from shield.svg, scaled 0.9, positioned center -->
  <path d="M12 2L3 5v6c0 5.5 3.8 10 9 11 5.2-1 9-5.5 9-11V5l-9-3z"/>

  <!-- user-body from user.svg, scaled 0.6, positioned center-top -->
  <path d="M12 6a2 2 0 100 4 2 2 0 000-4z"/>
  <path d="M12 12c-2.2 0-4 1.8-4 4v1h8v-1c0-2.2-1.8-4-4-4z"/>

  <!-- check-mark from check.svg, scaled 0.3, positioned bottom-right -->
  <path d="M17 15l2 2 4-4" transform="translate(2,2) scale(0.3)"/>
</svg>
```

**Enforcer Result:** Score 100/100 - No changes needed (parts came from library)

---

*This document defines the roadmap for transforming Symbol Garden from "AI sketch artist" to "Vector Sprout Engine".*
