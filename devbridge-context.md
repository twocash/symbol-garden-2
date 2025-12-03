# Symbol Garden 2.0 - AI Agent System Memory

> **Version:** 0.11.1 (Sprint 11-B - Fast Path Style Transfer)
> **Last Updated:** 2025-12-03
> **Branch:** goofy-nobel
> **System Status:** ✅ STABLE - LLM Bypass for 24x24 Sources

---

> ⚠️ **CRITICAL: SVG HANDLING ARCHITECTURE**
>
> **Sprint 11-B introduces FAST PATH** - For 24x24 source icons, we BYPASS the LLM
> entirely and apply style via string manipulation. This prevents all LLM-related
> truncation/mutation issues that caused "catastrophic data loss" (e.g., rockets
> with fins but no fuselage).
>
> **Key insight:** LLMs are unreliable at preserving SVG paths exactly. For same-size
> sources (24x24 → 24x24), pure string transformation is faster, cheaper, and 100% reliable.
>
> Key files:
> - `src/lib/sprout-service.ts` (fast path + content validation)
> - `src/lib/svg-validator.ts` (truncation detection)

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
// FAST PATH: 24x24 sources bypass LLM entirely! (Sprint 11-B)
if (is24x24Source(sourceSvg)) {
  // 1. String-based style transfer
  let svg = fastPathStyleTransfer(sourceSvg, styleManifest);
  // - Extracts inner content from source SVG
  // - STRIPS inline stroke-width, linecap, linejoin from child elements
  // - Rebuilds SVG with target library's style on root element
  // - Inline attrs would override root; stripping enables proper CSS cascade

  // 2. Iron Dome compliance check
  svg = SVGProcessor.process(svg, 'generate', profile).svg;

  // 3. Strip any transform wrappers
  svg = stripTransformWrappers(svg);

  return { svg, success: true, finishReason: 'FAST_PATH' };
}

// LLM PATH: Non-24x24 sources need coordinate conversion
// 1. Token Optimization
const { optimized, viewBox } = optimizeSvgForLlm(sourceSvg);
// Rounds coordinates, removes metadata, strips classes

// 2. Build Prompt
const prompt = buildSproutPrompt(optimized, viewBox, styleManifest);
// Instructs LLM to scale coordinates to 24x24 grid

// 3. Gemini Call
const result = await model.generateContent({ ... });
// text-only, no vision, temperature=0.1

// 4. Extract & Validate Structure
const svg = extractSvgFromResponse(result.text());
if (!isValidSvg(svg)) throw new Error('Invalid SVG');

// 5. Content Validation - CRITICAL! (Sprint 11-B)
const contentValidation = validatePathContent(svg, { sourceSvg });
if (!contentValidation.isValid) {
  // Truncation detected - FAIL, don't return garbage
  return { svg: '', success: false, error: 'Output truncated' };
}
// Compares path command count and length between source/output
// Catches "catastrophic data loss" like missing rocket fuselage

// 6. Iron Dome Processing
const final = SVGProcessor.process(svg, 'generate', profile);
// 6 stages: sanitize, repair, normalize, enforce, optimize, validate

// 7. Strip Transform Wrappers (Sprint 10-B fix)
svg = stripTransformWrappers(svg);
// Iron Dome's arc bounding is imprecise; we strip <g transform="...">
```

---

## 4. SVG ERROR HANDLING & VALIDATION (Sprint 11-B)

### The Problem: LLM Output Truncation

LLMs can silently truncate or mutate SVG paths, causing "catastrophic data loss":
- Rocket with fins but no fuselage
- Icon with partial shapes
- Missing paths from multi-path SVGs

**Root cause:** LLMs don't reliably preserve SVG path data verbatim, even when
explicitly instructed to "copy exactly". They may simplify, summarize, or truncate.

### The Solution: Multi-Layer Defense

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SVG HANDLING DEFENSE LAYERS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: FAST PATH BYPASS (Sprint 11-B)                                    │
│  ├─► is24x24Source() detects same-size sources                              │
│  ├─► fastPathStyleTransfer() applies style via string manipulation          │
│  ├─► STRIPS inline stroke attrs (prevents source style override)            │
│  └─► 100% reliable, no LLM involved, ~10ms vs ~10s                         │
│                                                                              │
│  LAYER 2: CONTENT VALIDATION (Sprint 11-B)                                  │
│  ├─► validatePathContent() in svg-validator.ts                              │
│  ├─► Counts path commands (M, L, C, etc.) in source vs output              │
│  ├─► Compares path data length (chars)                                      │
│  ├─► Thresholds: 50% command ratio, 30% length ratio                       │
│  └─► Returns FAILURE if truncation detected (don't return garbage)          │
│                                                                              │
│  LAYER 3: IRON DOME (Sprint 06+)                                            │
│  ├─► 6-stage SVG processing pipeline                                        │
│  ├─► Path syntax repair (LLM formatting errors)                             │
│  ├─► Style enforcement (ensure target library compliance)                   │
│  └─► Bounds validation (24x24 viewBox)                                      │
│                                                                              │
│  LAYER 4: TRANSFORM STRIPPING (Sprint 10-B)                                 │
│  ├─► stripTransformWrappers() removes Iron Dome's <g transform="...">      │
│  └─► Iron Dome's arc bounding is imprecise; we trust LLM coordinates       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `is24x24Source()` | sprout-service.ts | Detect fast-path eligibility |
| `fastPathStyleTransfer()` | sprout-service.ts | String-based style transfer |
| `validatePathContent()` | svg-validator.ts | Detect LLM truncation |
| `countPathCommands()` | svg-validator.ts | Count M, L, C, etc. |
| `getPathDataLength()` | svg-validator.ts | Measure path data size |
| `stripTransformWrappers()` | sprout-service.ts | Remove Iron Dome transforms |

### Inline Attribute Stripping

When applying target library styles, **inline attributes on child elements override
root-level styles**. Example problem:

```xml
<!-- Source (Heroicons): stroke-width="1.5" on path -->
<svg stroke-width="2">  <!-- Target style -->
  <path stroke-width="1.5" d="..."/>  <!-- Overrides root! -->
</svg>
```

**Solution:** `fastPathStyleTransfer()` strips these attributes:
- `stroke-width`
- `stroke-linecap`
- `stroke-linejoin`
- `stroke="currentColor"` (redundant)
- `fill="none"` (redundant)

This allows the root-level target library styles to cascade properly.

---

## 5. IRON DOME PIPELINE

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

## 6. SPRINT 12 ROADMAP (Candidates)

| Priority | Feature | Description |
|----------|---------|-------------|
| P1 | **Error Handling & Retry Logic** | Graceful API failure recovery, user-friendly error messages |
| P2 | **Batch Sprout Operations** | Sprout multiple icons at once (sproutBatch already exists) |
| P3 | **Style DNA Persistence** | Store library manifests in user preferences |
| P4 | **Sprout History** | Track recently sprouted icons for quick re-use |
| P5 | **Collection Favorites** | Save preferred Iconify collections |

---

## 8. SPRINT HISTORY

### Sprint 11-B (2025-12-03) - Fast Path Style Transfer ✅ COMPLETE

**Root Cause:** LLMs were silently truncating/mutating SVG paths even when instructed
to "copy exactly". This caused "catastrophic data loss" - e.g., rockets rendering
with fins but no fuselage.

**The Problem:**
- LLM returns `d="M15.6 14.4"` (22 chars) instead of full path (~400 chars)
- Content validation showed 19/19 commands (100%) because SOURCE was already truncated
- Actually, source was fine - LLM was generating garbage

**The Solution: Multi-Layer Defense**

1. **FAST PATH** - For 24x24 sources, bypass LLM entirely:
   - `is24x24Source()` detects same-size sources
   - `fastPathStyleTransfer()` applies style via string manipulation
   - Strips inline stroke attrs so target library styles cascade properly
   - ~10ms vs ~10s, 100% reliable, zero API cost

2. **CONTENT VALIDATION** - For LLM path, detect truncation:
   - `validatePathContent()` compares source vs output
   - Counts path commands (M, L, C, etc.) and path data length
   - Returns FAILURE if ratio < 50% commands or < 30% length
   - Prevents returning garbage to user

**Key Files:**
- `src/lib/sprout-service.ts` (fast path, inline attr stripping)
- `src/lib/svg-validator.ts` (content validation, truncation detection)

**Key Insight:** LLMs are unreliable at preserving SVG paths. For 24x24 → 24x24
style transfer, pure string manipulation is faster, cheaper, and 100% reliable.

### Sprint 11-A (2025-12-03) - Arc Fidelity Fix ✅ COMPLETE

**Root Cause:** The Sprout fidelity bug (flame shapes under rocket fins rendering
incorrectly) was caused by `svg-optimizer.ts` corrupting SVG arc flags during
token optimization.

**The Problem:**
- Arc commands have format: `A rx ry rotation large-arc-flag sweep-flag x y`
- Flags are always 0 or 1, but compact notation allows them to run together
- Example: `a22 22 0 012-3.9` means rotation=0, large-arc=0, sweep=1, x=2, y=-3.9
- The naive regex `/-?\d+\.?\d*/g` parsed `012` as the number 12, destroying flags

**The Fix:**
- `roundPathCoordinates()` - Now parses SVG path commands individually
- `roundArcArguments()` - Preserves arc flags at positions 3 and 4
- `tokenizeArcArgs()` - Handles compact notation where flags run together

**Key Files:**
- `src/lib/svg-optimizer.ts` (arc-aware rounding, lines 93-246)
- `scripts/test-arc-fidelity.ts` (test suite - all 11 arcs preserved)

**Test Results:**
```
Heroicons rocket-launch: 11 arcs → 11 arcs preserved ✅
Compact notation (0 01): flags preserved correctly ✅
Circle arcs (1 1 flags): preserved correctly ✅
```

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

When starting a new context window for **Sprint 12+**:

```
I'm continuing work on Symbol Garden 2.0, a TypeScript/Next.js application.
Read devbridge-context.md for full architecture details.

Current state:
- Sprint 10-A COMPLETE: Sprout Engine backend
- Sprint 10-B COMPLETE: Sprout Studio UI (SproutModal.tsx)
- Sprint 11-A COMPLETE: Arc Fidelity Fix (svg-optimizer.ts)
- Sprint 11-B COMPLETE: Fast Path Style Transfer (LLM bypass for 24x24)

The Sprout workflow is fully functional with multi-layer SVG validation:
1. User opens Sprout modal (via "Sprout Custom Icon" button)
2. Searches Iconify for reference icons (20 results displayed)
3. Selects an icon to preview in Workbench panel
4. Either:
   - "Adopt Original" → Import raw SVG (free, no AI)
   - "Sprout [Library] Version" → POST /api/sprout (AI transpilation)
5. Preview result in Results panel and save to workspace

CRITICAL SVG HANDLING (Sprint 11-B):
- 24x24 sources use FAST PATH (no LLM) - string-based style transfer
- Strips inline stroke attrs so target library styles cascade properly
- Content validation detects LLM truncation (command count, path length)
- Returns FAILURE if truncation detected (don't return garbage)

Key files:
- src/lib/sprout-service.ts (FAST PATH, content validation, transform stripping)
- src/lib/svg-validator.ts (validatePathContent, countPathCommands)
- src/lib/svg-optimizer.ts (arc-aware rounding)
- src/components/dialogs/SproutModal.tsx (UI)
- src/app/api/sprout/route.ts (API endpoint)

Sprint 12 priorities:
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
