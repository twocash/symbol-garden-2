# Symbol Garden 2.0 - AI Agent System Memory

> **Version:** 0.7.0 (Sprint 07 - Geometric Intelligence + Iron Dome)
> **Last Updated:** 2025-12-01
> **Branch:** main
> **System Status:** ✅ STABLE - Sprint 07 Geometric Intelligence + Iron Dome 6-Stage merged

---

## EXECUTIVE SUMMARY

Symbol Garden is an **AI-powered icon library management system** that generates new icons matching an ingested library's "Style DNA". The core innovation is replacing **runtime style guessing** with **ingestion-time style definition**.

### Core Philosophy
> "The library defines the rules. The generator follows them. No guessing."

### Two Generation Pipelines
1. **Sprout Engine (Native SVG)** - LLM generates SVG code directly, guided by Style DNA and few-shot examples
2. **Kitbash Engine (Component Assembly)** - Mechanical assembly of existing library components, refined by LLM

### Key Architectural Achievement (Sprint 06)
The **Iron Dome** - a unified SVG processing gateway that ALL icons pass through. This replaced scattered ad-hoc fixes with a centralized, 6-stage pipeline that catches and repairs common issues (including LLM path syntax errors).

---

## 1. MASTER ARCHITECTURE: THE PIPELINE PATTERN

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           SYMBOL GARDEN GENERATION PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                           │
│  ┌─────────────────┐                                                                      │
│  │   INGESTION     │  GitHub / Iconify / Manual Upload                                    │
│  │   "Mouth"       │  → Raw SVG files into system                                         │
│  └────────┬────────┘                                                                      │
│           │                                                                               │
│           ▼                                                                               │
│  ┌─────────────────┐                                                                      │
│  │   AUTOPSY       │  analyzeLibrary() → styleManifest                                    │
│  │   "Brain"       │  → Extract Style DNA: stroke-width, linecap, grid, patterns          │
│  │                 │  → Store in LibrarySchema.styleManifest                              │
│  └────────┬────────┘                                                                      │
│           │                                                                               │
│           ▼                                                                               │
│  ┌─────────────────┐                                                                      │
│  │   ENRICHMENT    │  /api/enrich → AI metadata + component indexing                      │
│  │   "Memory"      │  → semanticCategory, geometricTraits, complexity                     │
│  │                 │  → IconComponent[] for Kitbash assembly                              │
│  └────────┬────────┘                                                                      │
│           │                                                                               │
│           ▼                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐     │
│  │                        GENERATION LAYER                                          │     │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐            │     │
│  │  │   SPROUT ENGINE             │    │   KITBASH ENGINE            │            │     │
│  │  │   (Native SVG Generation)   │    │   (Component Assembly)      │            │     │
│  │  │                             │    │                             │            │     │
│  │  │   1. Reference Oracle       │    │   1. Source Identification  │            │     │
│  │  │   2. Exemplar Selection     │    │   2. Component Lookup       │            │     │
│  │  │   3. Decomposition          │    │   3. Strategy Selection     │            │     │
│  │  │   4. Prompt Construction    │    │   4. Layout Generation      │            │     │
│  │  │   5. Gemini Generation      │    │   5. Execution              │            │     │
│  │  │   6. Iron Dome Processing   │    │   6. Refinery (Optional)    │            │     │
│  │  └─────────────────────────────┘    └─────────────────────────────┘            │     │
│  └─────────────────────────────────────────────────────────────────────────────────┘     │
│           │                                                                               │
│           ▼                                                                               │
│  ┌─────────────────┐                                                                      │
│  │   IRON DOME     │  SVGProcessor.process(svg, mode, profile)                            │
│  │   "Guardian"    │  → 6-Stage Pipeline (see Section 4)                                  │
│  │                 │  → Mode: 'ingest' (permissive) | 'generate' (strict)                 │
│  └────────┬────────┘                                                                      │
│           │                                                                               │
│           ▼                                                                               │
│  ┌─────────────────┐                                                                      │
│  │   STORAGE       │  extractCombinedPathData() → single path string                      │
│  │   "Vault"       │  → Icon.path = combined paths                                        │
│  │                 │  → IndexedDB persistence                                             │
│  └─────────────────┘                                                                      │
│                                                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Insight: Ingestion-Time Definition

**OLD (Runtime Guesswork):**
```
Generate → Hope it matches → Manual comparison → Retry
```

**NEW (Ingestion-Time Definition):**
```
Ingest → Autopsy extracts DNA → DNA injected into prompts → Generation constrained by DNA
```

The `styleManifest` is the "Geometric Autopsy" - a text description of the library's:
- Stroke architecture (width, linecap, linejoin)
- Grid system (24x24, 2px edge padding)
- Corner treatment (rounded vs sharp, radius values)
- Visual patterns (how circles are used, arrow conventions)

---

## 2. FILE MAP BY CONCERN

### Generation Pipeline Files

| Stage | Primary File | Purpose |
|-------|--------------|---------|
| **Ingestion** | `ingestion-service.ts` | GitHub fetch, SVG parsing |
| **Ingestion (Iconify)** | `/api/iconify/import/route.ts` | Iconify API streaming import |
| **Autopsy** | `actions/analyze-library.ts` | Generate styleManifest via LLM |
| **Enrichment** | `/api/enrich/route.ts` | AI metadata + component indexing |
| **Sprout Core** | `hybrid-generator.ts` | Orchestrates native SVG generation |
| **Kitbash Core** | `kitbash-engine.ts` | Component assembly engine |
| **Iron Dome** | `svg-processor.ts` | Unified SVG processing gateway (6 stages) |
| **Style Enforcer** | `style-enforcer.ts` | Deterministic style compliance |
| **Path Validator** | `svg-validator.ts` | Path syntax validation + repair |
| **Path Utilities** | `svg-path-utils.ts` | Client-safe path extraction/normalization |

### Supporting Services

| Concern | File | Purpose |
|---------|------|---------|
| **Exemplar Selection** | `similar-icon-finder.ts` | Find best reference icons with traits |
| **Decomposition** | `decomposition-service.ts` | Static + dynamic concept breakdown |
| **Prompt Building** | `svg-prompt-builder.ts` | Construct few-shot LLM prompts |
| **Component Indexing** | `component-indexer.ts` | Semantic tagging of icon parts |
| **Semantic Vocabulary** | `pattern-library.ts` | Centralized names/ontology |
| **Cross-Library Reference** | `iconify-service.ts` | Reference Oracle (Iconify API) |

### State & Storage

| Layer | File | Data |
|-------|------|------|
| **Project State** | `project-context.tsx` | Projects, favorites, custom icons |
| **Search State** | `search-context.tsx` | Filters, pagination |
| **UI State** | `ui-context.tsx` | Modals, drawers |
| **Persistence** | `storage.ts` | IndexedDB operations |

### Legacy (Imagen Pipeline)

| File | Status | Notes |
|------|--------|-------|
| `ai-icon-service.ts` | Maintenance Only | V10/V11 "Ink First" prompting |
| `style-jury-service.ts` | Optional | Vision-based quality evaluation |
| `/api/generate/route.ts` | Legacy | PNG generation via Imagen 3 |
| `/api/vectorize/route.ts` | Legacy | Potrace PNG→SVG conversion |

---

## 3. CRITICAL DATA FLOWS

### 3.1 Style DNA Flow
```
Ingestion
    └─► analyzeLibrary(icons)
            └─► Gemini analyzes visual patterns
                    └─► styleManifest: string (Geometric Autopsy)
                            └─► LibrarySchema.styleManifest
                                    └─► Injected into generation prompts
```

### 3.2 Component Flow (for Kitbash)
```
Enrichment
    └─► /api/enrich
            └─► indexIconComponents(icon)
                    └─► LLM labels paths semantically
                            └─► Icon.components: IconComponent[]
                                    └─► componentSignature: "body+head+modifier"
                                            └─► Kitbash lookups via source: key
```

### 3.3 Generation Flow (Sprout)
```
AIIconGeneratorModal
    └─► /api/generate-svg
            └─► generateIcon(config)
                    ├─► getStructuralReference() [Reference Oracle]
                    ├─► findExemplarIconsWithTraits() [Smart Selection]
                    ├─► getDecomposition() [Static/Dynamic]
                    ├─► buildPrompt() [Few-shot construction]
                    ├─► Gemini 2.5 Flash → Raw SVG
                    └─► SVGProcessor.process(svg, 'generate')
                            └─► 6-Stage Pipeline → Compliant SVG
```

### 3.4 Assembly Flow (Kitbash)
```
AIIconGeneratorModal
    └─► /api/kitbash (mode: 'plan')
            └─► identifySourceIcons() → ["user", "shield"]
            └─► findComponentMatches() → foundParts[], missingParts[]
            └─► calculateCoverage() → strategy: graft|hybrid|adapt|generate
            └─► generateLayouts() → 3 layout options
    └─► /api/kitbash (mode: 'execute')
            └─► executeKitbash() → Assemble SVG
    └─► /api/kitbash (mode: 'refine') [Optional]
            └─► refineIcon() → LLM "code refactoring"
```

### 3.5 Iconify Import Flow (NEW)
```
SettingsModal
    └─► /api/iconify/import (POST)
            └─► Stream icons in batches of 20
                    └─► extractPathFromSvg() converts all elements to path
                    └─► Client accumulates via "icons" events
                            └─► Final "complete" event with metadata only
```

---

## 4. THE IRON DOME: UNIFIED SVG PROCESSING (6 STAGES)

### Philosophy
> All SVGs entering or exiting the system pass through ONE gateway.

### Two Modes

| Mode | When Used | Behavior |
|------|-----------|----------|
| `'ingest'` | GitHub import, Iconify, uploads | Permissive: allow path merging, shape→path conversion |
| `'generate'` | Sprout, Kitbash output | Strict: preserve separate paths, keep primitives editable, repair malformed paths |

### 6-Stage Processing Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    IRON DOME 6-STAGE PIPELINE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  STAGE 1: SANITIZE                                               │
│  └─► Remove scripts, event handlers, malicious content           │
│                                                                   │
│  STAGE 2: PATH SYNTAX REPAIR (generate mode only)                │
│  └─► Fix LLM path errors: "M6 6 12 12" → "M6 6 L12 12"          │
│  └─► Convert implicit lineto to explicit commands                │
│                                                                   │
│  STAGE 3: NORMALIZE                                              │
│  └─► Convert style="" attributes to native SVG attributes        │
│                                                                   │
│  STAGE 4: STYLE ENFORCEMENT (generate mode only)                 │
│  └─► Apply Style DNA rules (stroke-width, linecap, linejoin)    │
│  └─► Auto-fix non-compliant attributes                          │
│                                                                   │
│  STAGE 5: OPTIMIZATION                                           │
│  └─► SVGO with mode-aware configuration                          │
│  └─► Preserve path separation in generate mode                   │
│                                                                   │
│  STAGE 6: VALIDATION                                             │
│  └─► Bounds check (coordinates within viewBox)                   │
│  └─► Auto-fix out-of-bounds via transform                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Configuration

```typescript
// 'generate' mode: CRITICAL for Kitbash
allowPathMerging: false,    // Keep components separate!
allowShapeToPath: false,    // Keep <circle>, <rect> editable!

// 'ingest' mode: Standard optimization
allowPathMerging: true,
allowShapeToPath: true,
```

### Path Syntax Repair (Stage 2)

LLMs frequently generate malformed path data like `M6 6 12 12` (missing `L` command). The Iron Dome now automatically repairs these:

```
Input:  M6 6 12 12m0-12L6 18
Output: M6 6 L12 12 m0-12 L6 18
```

This is handled by `validateAndRepairPaths()` in `svg-validator.ts`.

---

## 5. CURRENT STATE SNAPSHOT

### System Health: STABLE

| Area | Status | Notes |
|------|--------|-------|
| Build | Clean | No TypeScript errors (1 pre-existing test issue) |
| Sprout Generation | Working | Style DNA injection + path repair operational |
| Kitbash Assembly | Working | Source icon identification improved |
| Kitbash Refinery | Working | LLM-based "code refactoring" |
| Iconify Import | Working | Streaming with incremental icon delivery |
| Enrichment | Working | Component indexing integrated |
| UI | Stable | Save flows verified |

### Feature Matrix

| Feature | Status | Sprint |
|---------|--------|--------|
| F1: Style Enforcer | Complete | Sprint 05 |
| F2: Ghost Preview | Complete | Sprint 05 |
| F3: Component Indexer | Complete | Sprint 05 |
| F4: Kitbash Engine | Complete | Sprint 05 |
| F5: Skeleton-First UI | Complete | Sprint 05 |
| Iron Dome | Complete | Sprint 06 |
| Semantic Bridge | Complete | Sprint 06 |
| Kitbash Refinery | Complete | Sprint 06 |
| Path Syntax Repair | Complete | Sprint 06+ |
| Iconify Streaming Import | Complete | Sprint 06+ |

### Storage Constraint

**Known Limitation:** Icons stored as single `path` string.
```typescript
Icon.path: string  // Combined paths joined with space
```

**Implication:** Multi-element SVGs (circle + path + line) must be converted to path data during save. This is handled by `extractCombinedPathData()` in `svg-path-utils.ts`.

**Path Normalization:** When combining paths, all must start with absolute `M` command. Lowercase `m` is converted to `M` to prevent geometry corruption.

---

## 6. RECENT CHANGES LOG

### Sprint 07 (2025-12-01) - Geometric Intelligence

#### Blueprint Protocol for Kitbash
- **Files:** `decomposition-service.ts`, `kitbash-engine.ts`
- **What:** Kitbash now decomposes concepts into geometric primitives (capsule, triangle, circle, rect)
- **Why:** Semantic decomposition ("fuselage", "nose-cone") rarely matched library parts
- **Result:** "rocket" → [capsule body + triangle nose + triangle fins] → Finds battery body, play icon

#### Geometric Component Index
- **Files:** `component-indexer.ts`, `schema.ts`
- **What:** Components now indexed by geometric type (`geometric:capsule`, `geometric:triangle`)
- **Why:** Enables shape-based queries instead of semantic name matching
- **Result:** Coverage improved from ~0% to 50%+ for compound concepts

#### Deterministic Layouts
- **Files:** `kitbash-engine.ts`
- **What:** Hardcoded layouts for known structures (rocket, tower, device)
- **Why:** LLM-generated layouts were unreliable (inverted scale hierarchy)
- **Result:** Proper positioning: body→center, nose→top, fins→bottom with correct scales

#### Transform Preservation (svgContent)
- **Files:** `schema.ts`, `AIIconGeneratorModal.tsx`, `export-utils.ts`, `IconCard.tsx`, `IconDetailsPanel.tsx`
- **What:** New `svgContent` field stores full SVG inner content with `<g transform>` groups
- **Why:** Kitbashed icons lost transforms when saved (extracted only path d attributes)
- **Result:** Assembled icons preserve exact positioning through save/export

### Session: 2025-11-30 (Iron Dome)

#### Iron Dome Path Syntax Repair
- **Created:** `validatePathSyntax()`, `validateAndRepairPaths()` in `svg-validator.ts`
- **Modified:** `svg-processor.ts` - Added Stage 2: PATH SYNTAX REPAIR
- **Why:** LLMs generate malformed paths like `M6 6 12 12` (missing L command)
- **Impact:** Automatic repair of implicit lineto commands in generated SVGs

#### LLM Prompt Improvement
- **Modified:** `svg-prompt-builder.ts` - Added explicit path syntax guidance
- **Why:** Prevention is better than repair; teach LLM correct syntax
- **Content:** WRONG/CORRECT examples for path commands

#### Iconify Import Streaming
- **Modified:** `/api/iconify/import/route.ts` - Incremental icon streaming
- **Why:** Vercel response size limits truncated large payloads
- **Impact:** Icons streamed in batches of 20 with "icons" events

#### Iconify Element-to-Path Conversion
- **Modified:** `/api/iconify/import/route.ts` - Full element conversion
- **Why:** Only `<path>` elements were extracted; `<rect>`, `<circle>` lost
- **Impact:** All SVG primitives now converted to path data

### Sprint 06 (2025-11-30) - Stability & Polish

#### Iron Dome Implementation
- **Created:** `svg-processor.ts` - Unified SVG processing gateway
- **Modified:** `hybrid-generator.ts`, `kitbash-engine.ts` - Route through Iron Dome
- **Why:** Ad-hoc SVG fixes in multiple locations caused cascading bugs

#### Semantic Bridge
- **Modified:** `component-indexer.ts` - Added `source:iconName` indexing
- **Modified:** `pattern-library.ts` - Centralized `SEMANTIC_ONTOLOGY`
- **Modified:** `kitbash-engine.ts` - Check source key FIRST in lookups
- **Why:** Vocabulary mismatch: Indexer tagged "person-torso", Kitbash asked for "user"
- **Impact:** Kitbash coverage improved from ~0% to 50%+ for compound concepts

#### Kitbash Refinery
- **Created:** `refineIcon()` in `hybrid-generator.ts`
- **Modified:** `/api/kitbash/route.ts` - Added `mode: 'refine'`
- **Why:** Assembled icons had overlapping paths, disjointed corners
- **Strategy:** Frame as "SVG code refactoring" with low temperature (0.1)

#### Path Handling Fix
- **Created:** `svg-path-utils.ts` - Client-safe path extraction
- **Added:** `normalizePathStart()` - Convert `m` → `M` for path concatenation
- **Why:** Relative `m` commands broke geometry when paths combined

### Prior Key Changes

| Change | Reason | Impact |
|--------|--------|--------|
| Multi-path SVG saving | Complex icons lost content | All paths now extracted |
| Trait-aware exemplar selection | Generic examples produced generic output | 2-4x trait matching improvement |
| Style enforcement (F1) | Wrong stroke-linecap/linejoin | Deterministic compliance |
| Component indexing in enrichment | Kitbash had 0% coverage | Assembly now functional |
| Reference Oracle caching | 3x duplicate API calls per variant | Single call, cached |

---

## 7. TECHNICAL DEBT

### Resolved (Sprint 06+)

| Issue | Resolution |
|-------|------------|
| Fragile SVG rendering | Iron Dome centralized processing |
| Component vocabulary mismatch | Semantic Bridge with source indexing |
| Kitbash output quality | Refinery with LLM topology repair |
| Path combination bugs | `normalizePathStart()` in svg-path-utils |
| LLM malformed paths | Stage 2 PATH SYNTAX REPAIR |
| Iconify import truncation | Streaming with incremental delivery |
| Iconify element loss | Full element-to-path conversion |

### Remaining

| Issue | Location | Priority | Notes |
|-------|----------|----------|-------|
| Single-path storage model | `schema.ts` | Medium | Blocks proper compound SVG support |
| Component indexing not persisted | Enrichment | Medium | Re-indexes on every enrichment |
| Decomposition cache ephemeral | `decomposition-service.ts` | Low | Lost on server restart |
| Legacy Imagen pipeline | `ai-icon-service.ts` | Low | Maintenance burden |
| Kitbash planning slow | `kitbash-engine.ts` | Medium | 30-40s latency |
| Pre-existing test failure | `vectorize/route.test.ts` | Low | `Map.append` doesn't exist |

---

## 8. FUTURE ROADMAP

### Immediate Leverage Points

#### 1. Compound SVG Support
**Current:** `Icon.path: string` (single combined path)
**Target:** `Icon.svg: string` (full SVG) or `Icon.elements: SVGElement[]`
**Benefit:** Preserve original structure, enable round-tripping, better Kitbash source material
**Complexity:** Medium - requires storage migration, rendering updates

#### 2. Persistent Component Index
**Current:** Components re-indexed during every enrichment
**Target:** Store `Icon.components` in IndexedDB with icon data
**Benefit:** Instant Kitbash planning, no re-enrichment
**Complexity:** Low - just persist the enrichment result

#### 3. Vectorization Constants to Project Schema
**Current:** Hardcoded in `ai-icon-service.ts` (V10 physics)
**Target:** `Project.vectorizationProfile` or `Library.vectorizationProfile`
**Benefit:** Per-library optimization tuning
**Complexity:** Low - schema change + UI for editing

### Medium-Term

#### 4. Style Jury for Native SVG
**Current:** Only works with Imagen (raster) pipeline
**Target:** Vision-based scoring of native SVG output
**Benefit:** Quality gate for all generation methods
**Complexity:** Medium - need to render SVG to image for vision API

#### 5. Kitbash Performance
**Current:** 30-40s planning time
**Target:** Sub-10s via caching and parallelization
**Approach:** Cache LLM responses, parallelize source identification
**Complexity:** Medium - requires careful caching strategy

#### 6. Complete Enrichment Coverage
**Current:** ~62% of icons enriched
**Target:** 100%
**Benefit:** Trait-aware selection works best with full enrichment
**Complexity:** Low - just run enrichment on remaining icons

---

## 9. ENVIRONMENT CONFIGURATION

### Required
```env
GOOGLE_API_KEY=        # Gemini API (enrichment, generation)
```

### Optional
```env
GOOGLE_CLOUD_PROJECT_ID=           # Vertex AI (Imagen, Style Jury)
GOOGLE_APPLICATION_CREDENTIALS=    # GCP Auth (local dev)
```

### Graceful Degradation
- No API key → Enrichment disabled, generation fails gracefully
- No Project ID → Style Jury skipped, Imagen unavailable
- No network → Reference Oracle skipped, import unavailable

---

## 10. KEY TYPES REFERENCE

```typescript
// Core Icon Type
interface Icon {
  id: string;
  name: string;
  library: string;
  path: string;                    // Combined path data
  viewBox: string;                 // Default "0 0 24 24"
  renderStyle: "stroke" | "fill";
  tags: string[];
  aiMetadata?: AiMetadata;         // Enriched metadata
  components?: IconComponent[];    // Indexed parts for Kitbash
}

// Enrichment Metadata
interface AiMetadata {
  semanticCategory: 'object' | 'action' | 'ui' | 'abstract';
  complexity: 1-5;
  geometricTraits: GeometricTrait[];
  confidence: number;
}

// Kitbash Component
interface IconComponent {
  name: string;                    // "arrow-head", "user-body"
  category: ComponentCategory;
  pathData: string;
  semanticTags: string[];
  sourceIcon: string;              // Icon this came from
}

// Library with Style DNA
interface Library {
  id: string;
  name: string;
  styleManifest?: string;          // The "Geometric Autopsy"
}

// Iron Dome Processing
interface ProcessResult {
  svg: string;
  modified: boolean;
  compliance: ComplianceResult | null;
  warnings: string[];
  metrics: { originalSize, processedSize, processingTimeMs };
}
```

---

## 11. COMMANDS QUICK REFERENCE

```bash
# Development
npm run dev                    # http://localhost:3000
npm run build                  # Production build

# Testing
npx tsx scripts/spike-*.ts    # Feature experiments

# Debugging
# Server logs tagged: [API], [Kitbash], [IronDome], [HybridGenerator]
# Path repair logs: [path-repair]
```

---

## 12. CONTINUATION PROMPT

When starting a new context window, use this prompt:

```
I'm continuing work on Symbol Garden 2.0, a TypeScript/Next.js application.
Read devbridge-context.md for full architecture details.

Current state:
- Sprint 06 complete + additional fixes: Iron Dome now has 6 stages including PATH SYNTAX REPAIR
- Generation pipelines (Sprout + Kitbash) both functional
- Iconify import working with streaming delivery
- Key constraint: Icons stored as single path string (Icon.path)

The codebase follows a Pipeline Pattern:
  Ingestion → Autopsy (Style DNA) → Enrichment → Generation → Iron Dome (6 stages) → Storage

Key files:
- hybrid-generator.ts: Sprout SVG generation
- kitbash-engine.ts: Component assembly
- svg-processor.ts: Iron Dome (6-stage SVG gateway)
- svg-validator.ts: Path syntax validation + repair
- svg-path-utils.ts: Path extraction/normalization

Iron Dome 6 Stages:
1. SANITIZE - Remove malicious content
2. PATH SYNTAX REPAIR - Fix LLM path errors (generate mode)
3. NORMALIZE - style="" to native attributes
4. STYLE ENFORCEMENT - Apply Style DNA (generate mode)
5. OPTIMIZATION - SVGO
6. VALIDATION - Bounds check

What would you like me to work on?
```

---

## 13. KNOWN CRITICAL PATTERNS

### Defense in Depth for SVG Quality

```
LLM Output → Path Syntax Repair → Style Enforcement → SVGO → Validation → Storage
   ↓              ↓                    ↓               ↓         ↓
 May be        Fixes M6 6 12 12    Fixes stroke-   Optimizes  Fixes OOB
 malformed     → M6 6 L12 12       linecap/join    paths      coords
```

### Single Path Storage Workaround

When saving icons with multiple elements:
```typescript
// Client code (AIIconGeneratorModal)
const { pathData, viewBox, fillRule } = extractCombinedPathData(svg);
// pathData = "M... M... M..." (all paths joined with space)

// Rendering (IconCard)
<path d={icon.path} /> // Renders all sub-paths
```

### Semantic Bridge for Kitbash

When looking up components:
```typescript
// 1. FIRST check source:iconName (exact match)
componentIndex.get(`source:${iconName}`)

// 2. THEN fall back to semantic tags
componentIndex.get(semanticTag)
```

---

*This document is the canonical System Memory for AI development sessions. Update after significant architectural changes.*
