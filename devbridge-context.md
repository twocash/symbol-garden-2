# Symbol Garden 2.0 - AI Agent System Memory

> **Version:** 0.10.1 (Sprint 10-B Complete - Sprout Studio Shipped)
> **Last Updated:** 2025-12-01
> **Branch:** gifted-jemison (ready for merge to main)
> **System Status:** ✅ STABLE - Sprout Pivot Complete

---

> ⚠️ **WARNING FOR NEW SESSIONS**
>
> Sprint 10-B is **COMPLETE** and pushed to `gifted-jemison` branch.
> Create a PR to merge to `main` or continue from this branch.
> Key deliverable: `src/components/dialogs/SproutModal.tsx`

---

## EXECUTIVE SUMMARY

Symbol Garden is a **Semantic Icon Style Transpiler** that transforms icons from any open-source library to match your design system's visual DNA.

### Core Philosophy (Post-Sprint 10 Pivot)

> "LLMs are better at refactoring code than tracing images."

**OLD APPROACH (Failed - Sprint 09-A):**
```
Text prompt → AI generates from scratch → Inconsistent results
Image → AI traces shape → AI ignores image, hallucinates
```

**NEW APPROACH (Sprout Studio - Sprint 10):**
```
User Search (Iconify) → Adopt (Raw) OR Sprout (Refactor) → Workspace
```

The Sprout Engine treats SVG path data as "source code to be refactored". This leverages LLM strengths (code transformation) instead of fighting weaknesses (image generation).

---

## 1. SPROUT STUDIO FLOW

The primary user workflow as of Sprint 10-B:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SPROUT STUDIO (Sprint 10-B)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐                                                         │
│  │   SEARCH        │  User types "rocket"                                    │
│  │   (Left Panel)  │  → Iconify API (275K+ icons, 20 results shown)         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │   WORKBENCH     │  User clicks icon to preview                            │
│  │   (Center)      │  Large preview with source collection name              │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ├──────────────────────────┐                                       │
│           │                          │                                       │
│           ▼                          ▼                                       │
│  ┌─────────────────┐        ┌─────────────────┐                             │
│  │   ADOPT         │        │   SPROUT        │                             │
│  │   ORIGINAL      │        │   [Library]     │                             │
│  │   (Free)        │        │   VERSION (AI)  │                             │
│  │                 │        │                 │                             │
│  │   Import raw    │        │   Token Opt     │                             │
│  │   SVG as-is     │        │   → Gemini 2.5  │                             │
│  │                 │        │   → Iron Dome   │                             │
│  │                 │        │   → Strip Xform │ ← NEW: Transform stripping  │
│  └────────┬────────┘        └────────┬────────┘                             │
│           │                          │                                       │
│           └──────────────────────────┘                                       │
│                          │                                                   │
│                          ▼                                                   │
│  ┌─────────────────┐                                                         │
│  │   RESULTS       │  Preview sprouted icon (Right Panel)                    │
│  │   (Right Panel) │  Shows processing time, compliance score               │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                   │
│  ┌─────────────────┐                                                         │
│  │   WORKSPACE     │  Icon saved with library: "ai-sprout"                   │
│  │                 │  Visible in "Custom Sprouts" dropdown filter            │
│  └─────────────────┘                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. FILE MAP (Sprout-Centric)

### Primary Files (Sprint 10-A + 10-B)

| File | Purpose |
|------|---------|
| `src/components/dialogs/SproutModal.tsx` | **Sprout Studio UI** - 3-panel modal (Sprint 10-B) |
| `src/app/api/sprout/route.ts` | **Core API** - Style transfer endpoint |
| `src/lib/sprout-service.ts` | **Core Service** - Transpilation + Transform Stripping |
| `src/lib/svg-optimizer.ts` | **Token Optimizer** - Reduce SVG before LLM |
| `src/lib/svg-processor.ts` | **Iron Dome** - 6-stage SVG gateway |
| `src/lib/style-enforcer.ts` | **Style DNA** - Compliance checking |
| `src/components/icons/IconGrid.tsx` | **Icon Display** - Library labels + ai-sprout filter |

### Supporting Files

| File | Purpose |
|------|---------|
| `src/lib/iconify-service.ts` | Iconify API integration |
| `src/app/api/iconify/search/route.ts` | Icon search endpoint |
| `src/app/api/iconify/import/route.ts` | Batch import endpoint |
| `src/lib/ui-context.tsx` | UI state provider (opens SproutModal) |

### Legacy Files (Deprecated but Present)

| File | Status | Notes |
|------|--------|-------|
| `src/components/dialogs/AIIconGeneratorModal.tsx` | Legacy | Old complex UI (replaced by SproutModal) |
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

// 2. Build Prompt (24x24 detection!)
const prompt = buildSproutPrompt(optimized, viewBox, styleManifest);
// NEW: If source is 24x24, prompt tells LLM to preserve paths EXACTLY
// Only style attributes change, no coordinate math

// 3. Gemini Call
const result = await model.generateContent({ ... });
// text-only, no vision, temperature=0.1

// 4. Extract & Validate
const svg = extractSvgFromResponse(result.text());
if (!isValidSvg(svg)) throw new Error('Invalid SVG');

// 5. Iron Dome Processing
const final = SVGProcessor.process(svg, 'generate', profile);
// 6 stages: sanitize, repair, normalize, enforce, optimize, validate

// 6. Strip Transform Wrappers (Sprint 10-B fix)
svg = stripTransformWrappers(svg);
// Iron Dome's arc bounding is imprecise; we strip <g transform="...">
// and trust the LLM's coordinates for true 24x24 fidelity
```

---

## 4. IRON DOME + TRANSFORM STRIPPING

All SVGs pass through the 6-stage pipeline, then get post-processed:

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
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              POST-PROCESS: STRIP TRANSFORM WRAPPERS          │
├─────────────────────────────────────────────────────────────┤
│  Iron Dome's getSvgBoundingBox() doesn't properly handle     │
│  arc commands (A/a), which extend beyond their endpoints.    │
│                                                              │
│  This causes false "out of bounds" detection and Iron Dome   │
│  wraps paths in <g transform="translate(...) scale(...)">    │
│                                                              │
│  The fix: stripTransformWrappers() in sprout-service.ts      │
│  removes these wrappers, trusting the LLM's coordinates.     │
│                                                              │
│  Result: True 24x24 fidelity with path d="" values baked in. │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. CURRENT STATE

### Sprint 10-B Delivered Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| 3-Panel Sprout Modal | ✅ Complete | Search \| Workbench \| Results |
| Iconify Search Integration | ✅ Complete | 20 results, 4-column grid |
| Adopt vs. Sprout Workflow | ✅ Complete | Free import OR AI transpile |
| 24x24 Path Fidelity | ✅ Complete | Transform stripping fix |
| Collection Display Names | ✅ Complete | Fe → Feather mapping |
| ai-sprout Library Slug | ✅ Complete | Custom Sprouts filter |

### Feature Matrix

| Feature | Status | Sprint |
|---------|--------|--------|
| Sprout Modal UI | ✅ **Complete** | **10-B** |
| Transform Stripping Fix | ✅ **Complete** | **10-B** |
| Sprout API (`/api/sprout`) | ✅ Complete | 10-A |
| Sprout Service | ✅ Complete | 10-A |
| Token Optimizer | ✅ Complete | 10-A |
| Iron Dome 6-Stage | ✅ Complete | 06 |
| Iconify Integration | ✅ Complete | 06+ |
| Style DNA Analysis | ✅ Complete | 05 |
| Tracer Spike | ✅ Complete (superseded) | 09-A |
| Kitbash Engine | ✅ Complete (legacy) | 05 |

---

## 6. SPRINT 11 ROADMAP (Candidates)

| Priority | Feature | Description |
|----------|---------|-------------|
| P1 | **Error Handling & Retry Logic** | Graceful API failure recovery, user-friendly error messages |
| P2 | **Batch Sprout Operations** | Sprout multiple icons at once (sproutBatch already exists) |
| P3 | **Style DNA Persistence** | Store library manifests in user preferences |
| P4 | **Sprout History** | Track recently sprouted icons for quick re-use |
| P5 | **Collection Favorites** | Save preferred Iconify collections |

---

## 7. SPRINT HISTORY

### Sprint 10-B (2025-12-01) - Sprout Studio UI ✅ COMPLETE

**Delivered:**
- `SproutModal.tsx` - 3-panel layout (Search | Workbench | Results)
- Left panel: Iconify search with 20 results, 4-column grid
- Center panel: Large icon preview, Adopt Original + Sprout buttons
- Right panel: Sprouted result preview with metadata
- Updated `ui-context.tsx` to use SproutModal instead of AIIconGeneratorModal
- Updated `IconGrid.tsx` with library labels and ai-sprout filter

**Bug Fixes:**
- Collection display names (Fe → Feather mapping)
- SVG Transform Wrapper Bug (Iron Dome arc bounding issue)
- 24x24 path preservation (special prompt for same-size sources)

**Key Files:**
- `src/components/dialogs/SproutModal.tsx` (NEW)
- `src/lib/sprout-service.ts` (stripTransformWrappers)
- `src/components/icons/IconGrid.tsx` (LIBRARY_LABELS)

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

## 8. ENVIRONMENT

```bash
# Required
GOOGLE_API_KEY=your-gemini-api-key

# Optional (legacy features)
GOOGLE_CLOUD_PROJECT_ID=   # Style Jury, Imagen
```

---

## 9. CONTINUATION PROMPT

When starting a new context window for **Sprint 11+**:

```
I'm continuing work on Symbol Garden 2.0, a TypeScript/Next.js application.
Read devbridge-context.md for full architecture details.

Current state:
- Sprint 10-A COMPLETE: Sprout Engine backend
- Sprint 10-B COMPLETE: Sprout Studio UI (SproutModal.tsx)

The Sprout workflow is fully functional:
1. User opens Sprout modal (via "Sprout Custom Icon" button)
2. Searches Iconify for reference icons (20 results displayed)
3. Selects an icon to preview in Workbench panel
4. Either:
   - "Adopt Original" → Import raw SVG (free, no AI)
   - "Sprout [Library] Version" → POST /api/sprout (AI transpilation)
5. Preview result in Results panel and save to workspace

Key bug fixes in Sprint 10-B:
- Transform stripping in sprout-service.ts (Iron Dome arc bounding issue)
- Collection display names (Fe → Feather mapping)
- 24x24 path preservation (no coordinate modification for same-size sources)

Key files:
- src/components/dialogs/SproutModal.tsx (UI)
- src/lib/sprout-service.ts (core logic + stripTransformWrappers)
- src/app/api/sprout/route.ts (API endpoint)
- src/components/icons/IconGrid.tsx (library labels)

Sprint 11 priorities:
1. Error Handling & Retry Logic
2. Batch Sprout Operations
3. Style DNA Persistence

What would you like me to work on?
```

---

## 10. KEY PATTERNS

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

### Collection Display Names (Sprint 10-B)

```typescript
const COLLECTION_DISPLAY_NAMES: Record<string, string> = {
  lucide: "Lucide",
  tabler: "Tabler",
  feather: "Feather",
  fe: "Feather",  // Some APIs return "fe" for Feather
  phosphor: "Phosphor",
  // ... more mappings
};

function getCollectionDisplayName(prefix: string): string {
  return COLLECTION_DISPLAY_NAMES[prefix] ||
    prefix.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
```

---

*This document is the canonical System Memory. Update after significant architectural changes.*
