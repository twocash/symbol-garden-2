# Sprint Plan: Hybrid SVG-Native Generation

## Overview

Implement the hybrid Few-Shot + Structural Decomposition approach for SVG icon generation, achieving ~100% first-shot success rate with ~82% cost reduction compared to the current Imagen→vectorize pipeline.

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| First-shot success rate | 40% | 90%+ |
| Average similarity to reference | 79% | 95%+ |
| Tokens per icon | ~4,180 | ~750 |
| Requires critic loop | Yes | No (optional) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Request                              │
│              "Generate a 'rocket' icon in Feather style"        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Decomposition Engine                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ Pattern Library │  │ Similar Icons   │  │ LLM Decomposer  │ │
│  │ (static rules)  │  │ (from library)  │  │ (on-demand)     │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           └────────────────────┴────────────────────┘           │
│                                │                                 │
│                    Structural Decomposition                      │
│           "COMPONENTS: body, fins, window, flame..."            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SVG Generator (Gemini)                       │
│  Input:                                                          │
│    - Pattern Library (reusable SVG idioms)                      │
│    - Few-Shot Examples (3-5 similar icons from library)         │
│    - Structural Decomposition (component breakdown)              │
│  Output:                                                         │
│    - Complete SVG code                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Optional: Critic Loop                         │
│  (Only if user enables "high-fidelity" mode)                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Output SVG                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sprint Tasks

### Phase 1: Core Infrastructure (Foundation)

#### 1.1 Pattern Library Service
**File**: `src/lib/pattern-library.ts`

Create a static pattern library with reusable SVG construction patterns:
- Arc loops (bows, decorative flourishes)
- Container with lid patterns
- Through-line patterns (ribbons, seams)
- Attached handle patterns
- Symmetric element patterns

```typescript
interface PatternLibrary {
  patterns: Pattern[];
  getPatternByType(type: PatternType): Pattern;
  formatForPrompt(): string;
}
```

#### 1.2 Decomposition Service
**File**: `src/lib/decomposition-service.ts`

Two-tier decomposition system:

**Tier 1: Static Decompositions** (cached, no LLM cost)
- Pre-computed decompositions for common icon concepts
- Stored in JSON, loaded at startup
- Covers ~50 common icon types (gift, camera, etc.)

**Tier 2: Dynamic Decomposition** (on-demand LLM call)
- For novel concepts not in static cache
- Uses Gemini Flash to generate decomposition
- Caches result for future use

```typescript
interface DecompositionService {
  getDecomposition(concept: string, library: Icon[]): Promise<Decomposition>;
  generateDecomposition(concept: string, similarIcons: Icon[]): Promise<Decomposition>;
  cacheDecomposition(concept: string, decomposition: Decomposition): void;
}

interface Decomposition {
  concept: string;
  components: Component[];
  connectionRules: string[];
  suggestedPaths?: Record<string, string>; // exact path syntax hints
}
```

#### 1.3 Similar Icon Finder
**File**: `src/lib/similar-icon-finder.ts`

Find structurally similar icons from the ingested library:
- Uses existing icon tags/categories if available
- Falls back to semantic similarity (Gemini embedding or keyword match)
- Returns 3-5 most similar icons for few-shot examples

```typescript
interface SimilarIconFinder {
  findSimilar(concept: string, library: Icon[], count?: number): Promise<Icon[]>;
}
```

---

### Phase 2: Generation Pipeline

#### 2.1 Hybrid Generator Service
**File**: `src/lib/hybrid-generator.ts`

Main generation service combining all components:

```typescript
interface HybridGeneratorOptions {
  concept: string;
  description?: string;
  library: Icon[];

  // Configurability options
  fewShotCount?: number;        // default: 4
  includePatternLibrary?: boolean; // default: true
  decompositionMode?: 'static' | 'dynamic' | 'auto'; // default: 'auto'
  enableCritic?: boolean;       // default: false
  maxAttempts?: number;         // default: 1 (no retry unless critic enabled)
  temperature?: number;         // default: 0.2
}

interface GenerationResult {
  svg: string;
  attempts: number;
  decomposition: Decomposition;
  similarIcons: string[];       // names of few-shot examples used
  tokensUsed?: number;
}

async function generateIcon(options: HybridGeneratorOptions): Promise<GenerationResult>;
```

#### 2.2 Prompt Builder
**File**: `src/lib/prompt-builder.ts`

Constructs the optimal prompt from components:

```typescript
interface PromptBuilder {
  build(options: {
    patternLibrary: string;
    fewShotExamples: Icon[];
    decomposition: Decomposition;
    concept: string;
    description?: string;
  }): string;

  estimateTokens(): number;
}
```

---

### Phase 3: API & UI Integration

#### 3.1 New API Route
**File**: `src/app/api/generate-svg/route.ts`

New endpoint for hybrid SVG generation:

```typescript
// POST /api/generate-svg
interface GenerateSvgRequest {
  concept: string;
  description?: string;
  libraryId?: string;          // which ingested library to use

  // Advanced options (optional)
  options?: {
    fewShotCount?: number;
    enableCritic?: boolean;
    decompositionMode?: 'static' | 'dynamic' | 'auto';
  };
}

interface GenerateSvgResponse {
  svg: string;
  metadata: {
    attempts: number;
    decomposition: Decomposition;
    similarIconsUsed: string[];
    tokensUsed: number;
  };
}
```

#### 3.2 Settings UI Integration
**File**: `src/components/layout/SettingsModal.tsx`

Add generation settings:
- Toggle: "Use SVG-Native Generation" (vs Imagen pipeline)
- Slider: Few-shot example count (1-8)
- Toggle: "Enable critic loop for higher fidelity"
- Dropdown: Decomposition mode (Auto / Static only / Always dynamic)

#### 3.3 Generation UI
**File**: `src/components/icons/GeneratePanel.tsx` (or similar)

Update generation UI to:
- Show decomposition preview before generation
- Display similar icons being used as reference
- Show token cost estimate
- Option to regenerate with different similar icons

---

### Phase 4: Static Decomposition Library

#### 4.1 Common Icon Decompositions
**File**: `data/decompositions.json`

Pre-compute decompositions for ~50 common icon concepts:

```json
{
  "gift": {
    "components": [
      { "name": "box_body", "type": "u-shape", "path": "M20 12v10H4V12" },
      { "name": "lid", "type": "rect", "path": "M2 7h20v5H2z" },
      { "name": "ribbon_vertical", "type": "line", "pierces": true },
      { "name": "bow_left", "type": "arc-loop", "path": "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" },
      { "name": "bow_right", "type": "arc-loop", "path": "M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" }
    ],
    "connectionRules": ["ribbon pierces through lid/body - intentional"],
    "patternRefs": ["arc-loop", "container-with-lid", "through-line"]
  },
  "camera": { ... },
  "headphones": { ... },
  ...
}
```

Categories to cover:
- Technology (camera, phone, laptop, monitor, speaker, headphones)
- Objects (gift, package, shopping-cart, briefcase, umbrella)
- Nature (sun, moon, cloud, tree, flower, leaf)
- Actions (play, pause, stop, forward, rewind)
- UI (menu, settings, search, home, user, bell)
- Arrows & navigation
- Social & communication

---

### Phase 5: Testing & Validation

#### 5.1 Golden Reference Test Suite
**File**: `scripts/test-hybrid-golden.ts`

Automated test against known Feather icons:
- Run 20+ icons through hybrid generator
- Compare to originals
- Track first-shot success rate
- Track similarity scores

#### 5.2 Novel Concept Test
**File**: `scripts/test-hybrid-novel.ts`

Test with concepts NOT in Feather:
- "AI brain with circuits"
- "Electric car charging"
- "Video conference"

Validates dynamic decomposition works.

#### 5.3 Cost Tracking
Add telemetry for:
- Tokens used per generation
- Decomposition cache hit rate
- Average attempts per icon

---

## Task Breakdown (Ordered)

| # | Task | Est. Effort | Dependencies |
|---|------|-------------|--------------|
| 1 | Create `pattern-library.ts` with static patterns | S | - |
| 2 | Create `decompositions.json` with 10 common icons | M | - |
| 3 | Create `decomposition-service.ts` (static tier only) | S | #2 |
| 4 | Create `similar-icon-finder.ts` | M | - |
| 5 | Create `prompt-builder.ts` | S | #1, #3 |
| 6 | Create `hybrid-generator.ts` (core logic) | M | #3, #4, #5 |
| 7 | Create `/api/generate-svg` route | S | #6 |
| 8 | Add dynamic decomposition to service | M | #3 |
| 9 | Expand `decompositions.json` to 50 icons | L | #2 |
| 10 | Add Settings UI for generation options | M | #7 |
| 11 | Golden Reference test suite | M | #6 |
| 12 | Novel concept test suite | S | #8 |
| 13 | Cost tracking & telemetry | S | #6 |

**Effort Key**: S = Small (< 2 hrs), M = Medium (2-4 hrs), L = Large (4+ hrs)

---

## Configuration Options Summary

Users can tune these parameters:

| Option | Default | Range | Effect |
|--------|---------|-------|--------|
| `fewShotCount` | 4 | 1-8 | More = better style match, higher cost |
| `decompositionMode` | auto | static/dynamic/auto | Static = faster, Dynamic = novel concepts |
| `enableCritic` | false | bool | Higher fidelity, ~2x cost |
| `temperature` | 0.2 | 0-1 | Lower = more deterministic |
| `includePatternLibrary` | true | bool | Disable for minimal prompts |

---

## Migration Path

1. **Phase 1**: Hybrid generator available as opt-in via Settings
2. **Phase 2**: A/B test hybrid vs Imagen pipeline
3. **Phase 3**: If metrics confirm improvement, make hybrid default
4. **Phase 4**: Deprecate Imagen pipeline (keep as fallback)

---

## Open Questions

1. **Caching strategy**: How long to cache dynamic decompositions?
2. **Library-specific patterns**: Should pattern library be per-ingested-library?
3. **Fallback behavior**: If hybrid fails, auto-fallback to Imagen?
4. **User feedback loop**: Let users rate generations to improve decompositions?

---

## Files to Create/Modify

### New Files
- `src/lib/pattern-library.ts`
- `src/lib/decomposition-service.ts`
- `src/lib/similar-icon-finder.ts`
- `src/lib/hybrid-generator.ts`
- `src/lib/prompt-builder.ts`
- `src/app/api/generate-svg/route.ts`
- `data/decompositions.json`
- `scripts/test-hybrid-golden.ts`
- `scripts/test-hybrid-novel.ts`

### Modified Files
- `src/components/layout/SettingsModal.tsx` (add generation settings)
- `src/types/schema.ts` (add Decomposition types)
