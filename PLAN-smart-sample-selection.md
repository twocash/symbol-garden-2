# Plan: Smart Sample Selection via Enhanced Icon Metadata

## Goal
Enhance the AI Enrichment feature to capture semantic and geometric metadata per icon, enabling intelligent sample selection for:
1. **Generator** - sees stylistically representative samples
2. **Critic** - sees "edge case" samples (complex intersections, containment, etc.)

## Current State

### Existing AI Enhance (`/api/enrich`)
Currently extracts per icon:
- `tags[]` - 3-5 synonyms/keywords
- `aiDescription` - 1 sentence business context

### Current Icon Schema
```typescript
{
  id, name, library, style, renderStyle, fillRule, clipRule,
  path, viewBox, tags[], categories[], synonyms[], aiDescription
}
```

### Current Sample Selection
- `generateLibraryManifest()` uses evenly-spaced sampling (every nth icon)
- Spike test uses hardcoded Feather samples
- No awareness of semantic category or geometric complexity

---

## Proposed Schema Extension

Add new optional fields to `Icon`:

```typescript
// New metadata fields for smart sample selection
aiMetadata?: {
  // Semantic Category (mutually exclusive)
  semanticCategory: 'object' | 'action' | 'ui' | 'abstract';

  // Geometric Complexity (1-5 scale)
  complexity: 1 | 2 | 3 | 4 | 5;

  // Geometric Characteristics (can have multiple)
  geometricTraits: Array<
    | 'containment'      // elements inside other elements (battery, folder)
    | 'intersection'     // crossing/overlapping strokes (scissors, link)
    | 'nested'           // recursive structure (folder in folder)
    | 'fine-detail'      // small precise elements (eye pupil, checkbox)
    | 'symmetry'         // bilateral or radial symmetry
    | 'open-path'        // unclosed strokes (check, arrow)
    | 'compound'         // multiple disconnected shapes
  >;

  // Confidence that this classification is correct (0-1)
  confidence: number;
}
```

---

## Implementation Plan

### Phase 1: Extend AI Enhance API

**File: `src/app/api/enrich/route.ts`**

Update the prompt to extract additional metadata:

```typescript
const prompt = `
You are an icon metadata expert analyzing SVG icons for a design system.

For each icon, analyze:

1. SEMANTIC CATEGORY (choose ONE):
   - "object": Real-world things (cup, headphones, rocket, umbrella)
   - "action": Verbs/operations (download, upload, refresh, play)
   - "ui": Navigation/interface elements (arrow, chevron, menu, grid)
   - "abstract": Symbols/concepts (warning, info, heart, star)

2. GEOMETRIC COMPLEXITY (1-5):
   - 1: Single primitive (circle, square, line)
   - 2: Simple composition (house, file, envelope)
   - 3: Medium complexity (camera, shopping-cart)
   - 4: Complex with details (printer, microphone)
   - 5: Intricate/many elements (map, dashboard)

3. GEOMETRIC TRAITS (list ALL that apply):
   - "containment": Elements inside other elements (battery bars, folder contents)
   - "intersection": Crossing/overlapping strokes (scissors, chain-link)
   - "nested": Recursive structure (layers, stacked items)
   - "fine-detail": Small precise elements (eye with pupil, toggle dot)
   - "symmetry": Clear bilateral or radial symmetry
   - "open-path": Unclosed strokes (checkmark, curved arrow)
   - "compound": Multiple disconnected shapes (ellipsis, signal bars)

4. TAGS: 3-5 relevant synonyms (as before)
5. DESCRIPTION: Brief business-context sentence (as before)

Return JSON array:
[{
  "id": "...",
  "tags": ["..."],
  "description": "...",
  "semanticCategory": "object|action|ui|abstract",
  "complexity": 1-5,
  "geometricTraits": ["containment", "intersection", ...]
}]

Input Icons:
${JSON.stringify(icons.map(i => ({
  id: i.id,
  name: i.name,
  tags: i.tags,
  svg: buildFullSvg(i)  // Include SVG for geometric analysis
})))}
`;
```

**Key Change**: Include the full SVG in the prompt so Gemini can analyze the actual geometry, not just the name.

---

### Phase 2: Update Icon Schema

**File: `src/types/schema.ts`**

```typescript
export const AiMetadataSchema = z.object({
  semanticCategory: z.enum(['object', 'action', 'ui', 'abstract']),
  complexity: z.number().min(1).max(5),
  geometricTraits: z.array(z.enum([
    'containment', 'intersection', 'nested', 'fine-detail',
    'symmetry', 'open-path', 'compound'
  ])),
  confidence: z.number().min(0).max(1).default(0.8),
});

export const IconSchema = z.object({
  // ... existing fields ...
  aiMetadata: AiMetadataSchema.optional(),
});
```

---

### Phase 3: Smart Sample Selection Service

**New File: `src/lib/sample-selection.ts`**

```typescript
export interface SampleSelectionConfig {
  // Total samples to select
  count: number;

  // Semantic category weights (should sum to 1.0)
  categoryWeights: {
    object: number;    // default 0.50
    action: number;    // default 0.20
    ui: number;        // default 0.15
    abstract: number;  // default 0.15
  };

  // Complexity distribution (should sum to 1.0)
  complexityWeights: {
    simple: number;    // complexity 1-2, default 0.30
    medium: number;    // complexity 3, default 0.40
    complex: number;   // complexity 4-5, default 0.30
  };

  // Prioritize icons with these traits
  prioritizeTraits?: string[];
}

export const GENERATOR_CONFIG: SampleSelectionConfig = {
  count: 10,
  categoryWeights: { object: 0.50, action: 0.20, ui: 0.15, abstract: 0.15 },
  complexityWeights: { simple: 0.30, medium: 0.50, complex: 0.20 },
  // Generator sees "normal" icons, not edge cases
  prioritizeTraits: ['symmetry'],
};

export const CRITIC_CONFIG: SampleSelectionConfig = {
  count: 8,
  categoryWeights: { object: 0.40, action: 0.20, ui: 0.20, abstract: 0.20 },
  complexityWeights: { simple: 0.20, medium: 0.30, complex: 0.50 },
  // Critic sees problematic geometry
  prioritizeTraits: ['containment', 'intersection', 'nested', 'fine-detail'],
};

export function selectSamples(
  icons: Icon[],
  config: SampleSelectionConfig
): Icon[] {
  // 1. Filter to icons with aiMetadata
  const enriched = icons.filter(i => i.aiMetadata);

  // 2. Group by semantic category
  const byCategory = groupBy(enriched, i => i.aiMetadata!.semanticCategory);

  // 3. Calculate target counts per category
  const targets = {
    object: Math.round(config.count * config.categoryWeights.object),
    action: Math.round(config.count * config.categoryWeights.action),
    ui: Math.round(config.count * config.categoryWeights.ui),
    abstract: Math.round(config.count * config.categoryWeights.abstract),
  };

  // 4. Within each category, prioritize by:
  //    a. Presence of prioritized traits
  //    b. Complexity matching target distribution
  const selected: Icon[] = [];

  for (const [category, target] of Object.entries(targets)) {
    const candidates = byCategory[category] || [];
    const scored = candidates.map(icon => ({
      icon,
      score: scoreIcon(icon, config),
    }));
    scored.sort((a, b) => b.score - a.score);
    selected.push(...scored.slice(0, target).map(s => s.icon));
  }

  return selected;
}

function scoreIcon(icon: Icon, config: SampleSelectionConfig): number {
  const meta = icon.aiMetadata!;
  let score = 0;

  // Boost for prioritized traits
  const prioritized = config.prioritizeTraits || [];
  for (const trait of meta.geometricTraits) {
    if (prioritized.includes(trait)) {
      score += 10;
    }
  }

  // Boost for matching complexity distribution
  // (implementation depends on how we want to balance)

  return score;
}
```

---

### Phase 4: Integrate into SVG-Native Pipeline

**File: `scripts/spike-svg-native.ts`** (then productionize to `src/lib/`)

```typescript
// Replace hardcoded FEATHER_SAMPLES with:
const generatorSamples = selectSamples(libraryIcons, GENERATOR_CONFIG);
const criticSamples = selectSamples(libraryIcons, CRITIC_CONFIG);

// In generateSvgIcon():
const prompt = `
${styleDna}

Here are ${generatorSamples.length} representative examples from this library:
${generatorSamples.map(i => `<example name="${i.name}">${buildSvg(i)}</example>`).join('\n')}
...
`;

// In critiqueSvg():
const prompt = `
Here are examples showing proper geometric handling in this style:
${criticSamples.map(i => `<example name="${i.name}" traits="${i.aiMetadata?.geometricTraits.join(',')}">${buildSvg(i)}</example>`).join('\n')}
...
`;
```

---

## Backlog Items

1. **Large Library Support**: Currently limited to first 1000 icons during ingestion. Need to handle pagination or streaming for larger libraries.

2. **Mix Panel UI**: Future settings panel to let users adjust:
   - Category weights
   - Complexity distribution
   - Trait priorities

3. **Per-Concept Sample Selection**: Dynamically select samples based on the concept being generated (e.g., for "pizza slice", prioritize triangular shapes and circular details).

4. **Batch Enhancement Progress**: Show which icons have `aiMetadata` vs just `aiDescription`.

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/types/schema.ts` | Add `AiMetadataSchema` and `aiMetadata` field |
| `src/app/api/enrich/route.ts` | Extend prompt to extract semantic/geometric metadata |
| `src/lib/sample-selection.ts` | NEW - Smart sample selection logic |
| `src/lib/style-analysis.ts` | Update `generateLibraryManifest` to use smart selection |
| `scripts/spike-svg-native.ts` | Use smart selection for generator/critic samples |
| `src/components/layout/SettingsModal.tsx` | Update to persist new metadata fields |

---

## Testing Strategy

1. Run AI Enhance on a small batch (10 icons) to verify new metadata extraction
2. Verify metadata persists to IndexedDB
3. Run spike test with dynamically selected samples
4. Compare generation quality between:
   - Random/evenly-spaced samples (current)
   - Smart-selected samples (new)

---

## Next Steps

1. [ ] Extend schema with `aiMetadata`
2. [ ] Update `/api/enrich` prompt
3. [ ] Create `sample-selection.ts` service
4. [ ] Update spike to use smart selection
5. [ ] Test with real library
