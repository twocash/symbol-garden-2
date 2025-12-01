# Symbol Garden 2.0 - AI Agent System Memory

> **Version:** 0.9.0 (Sprint 10-A - Sprout Engine Complete)
> **Last Updated:** 2025-12-01
> **Branch:** main (merged from unruffled-banzai)
> **System Status:** ✅ STABLE - Sprout Backend Complete, Ready for UI (Sprint 10-B)

---

> ⚠️ **WARNING FOR NEW SESSIONS**
>
> Sprint 10-A work was done in worktree `unruffled-banzai` and merged to `main`.
> If you don't see `src/app/api/sprout/`, pull from main:
> ```bash
> git pull origin main
> ```

---

## EXECUTIVE SUMMARY

Symbol Garden is a **Semantic Icon Style Transpiler** that transforms icons from any open-source library to match your design system's visual DNA.

### Core Philosophy (Post-Sprint 10-A Pivot)

> "LLMs are better at refactoring code than tracing images."

**OLD APPROACH (Failed):**
```
Text prompt → AI generates from scratch → Inconsistent results
Image → AI traces shape → AI ignores image, hallucinates
```

**NEW APPROACH (Sprout Engine):**
```
Iconify search → User selects icon → Sprout API refactors SVG code → Perfect match
```

The Sprout Engine treats SVG path data as "source code to be refactored". This leverages LLM strengths (code transformation) instead of fighting weaknesses (image generation).

---

## 1. THE SPROUT CORE LOOP

This is the primary user flow as of Sprint 10-A:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPROUT PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                                                         │
│  │   USER SEARCH   │  "rocket"                                               │
│  │                 │  → Iconify API (275K+ icons)                           │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │   SELECTION     │  User picks reference icon                              │
│  │                 │  (Material, Tabler, Lucide, FontAwesome, etc.)         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ├──────────────────────────┐                                       │
│           │                          │                                       │
│           ▼                          ▼                                       │
│  ┌─────────────────┐        ┌─────────────────┐                             │
│  │   ADOPT         │        │   SPROUT        │                             │
│  │   (Free)        │        │   (AI)          │                             │
│  │                 │        │                 │                             │
│  │   Import raw    │        │   Token Opt     │                             │
│  │   SVG as-is     │        │   → Gemini 2.5  │                             │
│  │                 │        │   → Iron Dome   │                             │
│  └────────┬────────┘        └────────┬────────┘                             │
│           │                          │                                       │
│           └──────────────────────────┘                                       │
│                          │                                                   │
│                          ▼                                                   │
│  ┌─────────────────┐                                                         │
│  │   WORKSPACE     │  Icon saved to user's project                          │
│  │                 │  In library's style                                     │
│  └─────────────────┘                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. FILE MAP (Sprout-Centric)

### Primary Files (Sprint 10-A)

| File | Purpose |
|------|---------|
| `src/app/api/sprout/route.ts` | **Core API** - Style transfer endpoint |
| `src/lib/sprout-service.ts` | **Core Service** - Transpilation logic |
| `src/lib/svg-optimizer.ts` | **Token Optimizer** - Reduce SVG before LLM |
| `src/lib/svg-processor.ts` | **Iron Dome** - 6-stage SVG gateway |
| `src/lib/style-enforcer.ts` | **Style DNA** - Compliance checking |

### Supporting Files

| File | Purpose |
|------|---------|
| `src/lib/iconify-service.ts` | Iconify API integration |
| `src/app/api/iconify/search/route.ts` | Icon search endpoint |
| `src/app/api/iconify/import/route.ts` | Batch import endpoint |
| `src/components/dialogs/AIIconGeneratorModal.tsx` | Current UI (to be replaced in 10-B) |

### Legacy Files (Deprecated but Present)

| File | Status | Notes |
|------|--------|-------|
| `src/lib/hybrid-generator.ts` | Legacy | Old "generate from scratch" flow |
| `src/lib/kitbash-engine.ts` | Legacy | Component assembly (keep for "Compose" mode) |
| `src/app/api/generate-svg/route.ts` | Legacy | Text-to-SVG generation |
| `src/app/api/generate-tracer/route.ts` | Spike | 09-A tracer (superseded by /api/sprout) |

---

## 3. THE SPROUT API

### POST /api/sprout

**Request:**
```typescript
{
  sourceSvg: string;        // Complete SVG from Iconify
  styleManifest?: string;   // Target library's Style DNA
  concept?: string;         // What the icon represents (for logging)
  libraryId?: string;       // Lookup manifest from storage
  apiKey?: string;          // Optional user API key
}
```

**Response:**
```typescript
{
  svg: string;              // Transpiled SVG
  success: boolean;
  metadata: {
    tokensSaved: number;    // Optimizer savings
    processingTimeMs: number;
    ironDomeModified: boolean;
    complianceScore: number | null;
  };
  error?: string;           // If success=false
}
```

### Sprout Service Internal Flow

```typescript
// 1. Token Optimization
const { optimized, viewBox } = optimizeSvgForLlm(sourceSvg);
// Rounds coordinates, removes metadata, strips classes

// 2. Build Prompt
const prompt = buildSproutPrompt(optimized, viewBox, styleManifest);
// LLM reads manifest, extracts rules, refactors geometry

// 3. Gemini Call
const result = await model.generateContent({ ... });
// text-only, no vision, temperature=0.1

// 4. Extract & Validate
const svg = extractSvgFromResponse(result.text());
if (!isValidSvg(svg)) throw new Error('Invalid SVG');

// 5. Iron Dome Processing
const final = SVGProcessor.process(svg, 'generate', profile);
// 6 stages: sanitize, repair, normalize, enforce, optimize, validate
```

---

## 4. IRON DOME (Unchanged)

All SVGs pass through the 6-stage pipeline:

```
┌─────────────────────────────────────────────────────────────┐
│                 IRON DOME 6-STAGE PIPELINE                   │
├─────────────────────────────────────────────────────────────┤
│  STAGE 1: SANITIZE                                           │
│  └─► Remove scripts, event handlers, malicious content       │
│                                                              │
│  STAGE 2: PATH SYNTAX REPAIR (generate mode)                 │
│  └─► Fix LLM errors: "M6 6 12 12" → "M6 6 L12 12"           │
│                                                              │
│  STAGE 3: NORMALIZE                                          │
│  └─► style="" attributes → native SVG attributes             │
│                                                              │
│  STAGE 4: STYLE ENFORCEMENT (generate mode)                  │
│  └─► Apply Style DNA rules                                   │
│                                                              │
│  STAGE 5: OPTIMIZATION                                       │
│  └─► SVGO with mode-aware config                             │
│                                                              │
│  STAGE 6: VALIDATION                                         │
│  └─► Bounds check, auto-fix out-of-bounds                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CURRENT STATE

### Feature Matrix

| Feature | Status | Sprint |
|---------|--------|--------|
| Sprout API (`/api/sprout`) | **Complete** | **10-A** |
| Sprout Service | **Complete** | **10-A** |
| Token Optimizer | **Complete** | **10-A** |
| Iron Dome 6-Stage | Complete | 06 |
| Iconify Integration | Complete | 06+ |
| Style DNA Analysis | Complete | 05 |
| Tracer Spike | Complete (superseded) | 09-A |
| Kitbash Engine | Complete (legacy) | 05 |

### What's Missing (Sprint 10-B)

- [ ] **Sprout Modal UI** - Replace current AIIconGeneratorModal
- [ ] **Adopt Button** - Import raw icon (free, no AI)
- [ ] **Sprout Button** - Transpile to library style (AI)
- [ ] **Search → Select → Action** workflow
- [ ] Deprecate old Generate/Kitbash tabs

---

## 6. SPRINT HISTORY

### Sprint 10-A (2025-12-01) - Sprout Engine Backend

**Completed:**
- Token Optimizer (`optimizeSvgForLlm`) - 8-17% size reduction
- Sprout Service (`sproutIcon`) - Core transpilation
- Sprout API (`/api/sprout`) - REST endpoint
- Test script (`scripts/test-sprout-10a.ts`)

**Key Insight:** Send full SVG content (not just paths) to preserve multi-path semantics.

### Sprint 09-A (2025-12-01) - Tracer Spike

**Validated:** Code Transpilation works where Vision tracing fails.

**Failed Approach:** PNG image → Gemini Vision → AI ignores image

**Successful Approach:** SVG path data → Gemini text → AI refactors coordinates

---

## 7. ENVIRONMENT

```bash
# Required
GOOGLE_API_KEY=your-gemini-api-key

# Optional (legacy features)
GOOGLE_CLOUD_PROJECT_ID=   # Style Jury, Imagen
```

---

## 8. CONTINUATION PROMPT

When starting a new context window for **Sprint 10-B**:

```
I'm continuing work on Symbol Garden 2.0, a TypeScript/Next.js application.
Read devbridge-context.md for full architecture details.

Current state:
- Sprint 10-A COMPLETE: Sprout Engine backend is ready
- API endpoint: POST /api/sprout (style transfer via code transpilation)
- Token Optimizer: Reduces SVG 8-17% before LLM
- Iron Dome: 6-stage SVG processing

CRITICAL: Pull from main to get Sprint 10-A files:
  git pull origin main

Next step: Sprint 10-B - Build the Sprout Modal UI

The UI should implement:
1. Search bar → Query Iconify API
2. Results grid → Show icons from external libraries
3. Selection → Click to select reference
4. Two actions:
   - "Adopt" → Import raw SVG (free, no AI)
   - "Sprout" → Call /api/sprout to transpile (AI)
5. Preview → Show result before saving
6. Save → Add to workspace

Key files to read:
- src/lib/sprout-service.ts (core logic)
- src/app/api/sprout/route.ts (API endpoint)
- src/components/dialogs/AIIconGeneratorModal.tsx (current UI to replace)

What would you like me to work on?
```

---

## 9. KEY PATTERNS

### Token Optimization Before LLM

```typescript
import { optimizeSvgForLlm } from '@/lib/svg-optimizer';

const { optimized, viewBox, tokensSaved } = optimizeSvgForLlm(sourceSvg);
// optimized: cleaned SVG string
// viewBox: extracted for coordinate math
// tokensSaved: bytes saved
```

### Calling Sprout API

```typescript
const response = await fetch('/api/sprout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sourceSvg: selectedIcon.svg,
    styleManifest: currentLibrary.styleManifest,
    concept: searchQuery,
  }),
});

const { svg, success, metadata } = await response.json();
```

---

*This document is the canonical System Memory. Update after significant architectural changes.*
