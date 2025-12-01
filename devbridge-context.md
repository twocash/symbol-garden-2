# Symbol Garden 2.0 - AI Agent Context Document

> **Last Updated:** 2025-12-01
> **Version:** 0.5.0 (Geometric Intelligence)
> **Branch:** main (merged from goofy-aryabhata)
> **System Status:** ✅ STABLE - Sprint 07 Geometric Intelligence complete & merged

---

## QUICK REFERENCE (For AI Agents)

### What Is This Project?
Symbol Garden is an **AI-enhanced icon library management system** that:
1. Ingests icon libraries from GitHub repos (Feather, Lucide, etc.)
2. Enriches icons with semantic metadata via Gemini AI
3. Generates new icons that **match the ingested library's style**
4. Assembles icons from existing library components (Kitbash)

### Core Value Proposition
> "Generate icons that look like they belong in your design system, not generic AI art."

### Current Capabilities
- **Ingest**: Import from GitHub repos or Iconify (275k+ icons)
- **Enrich**: AI adds semantic categories, geometric traits, descriptions
- **Generate**: Native SVG generation matching library style (Sprout Engine)
- **Kitbash**: Assemble new icons from existing library components
- **Export**: Multiple formats with workspace branding

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16.0.3 (App Router) | SSR, API routes, React 19 |
| Language | TypeScript 5.9.3 | Type safety with Zod schemas |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first + Radix primitives |
| State | React Context (3-layer) | Client-side state hierarchy |
| Storage | IndexedDB (idb-keyval) | Offline-first browser storage |
| AI - Analysis | Gemini 2.5 Flash | Enrichment, decomposition, planning |
| AI - Generation | Gemini 2.5 Flash | Native SVG code generation |
| AI - Images | Vertex AI Imagen 3 | PNG generation (legacy path) |
| Vectorization | Sharp + Potrace | PNG-to-SVG conversion |

### Design Principles
1. **Local-First**: All data in browser (IndexedDB), no backend database
2. **Library-as-Truth**: Generated icons must match user's ingested library style
3. **Graceful Degradation**: Works without all API keys configured
4. **Context-First State**: Hierarchical React Context for predictable flow

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SYMBOL GARDEN 2.0                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   INGESTION LAYER                                                                │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                      │
│   │   GitHub     │    │   Iconify    │    │   Manual     │                      │
│   │   Repos      │    │   API        │    │   Upload     │                      │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                      │
│          └───────────────────┼───────────────────┘                              │
│                              ▼                                                   │
│   ENRICHMENT LAYER     ┌─────────────┐                                          │
│                        │  Gemini AI  │                                          │
│                        │ • Semantic  │                                          │
│                        │ • Traits    │                                          │
│                        │ • Component │                                          │
│                        │   Indexing  │                                          │
│                        └──────┬──────┘                                          │
│                               ▼                                                  │
│   STORAGE LAYER        ┌─────────────────────────────────────────────────────┐  │
│                        │                  IndexedDB                          │  │
│                        │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │  │
│                        │  │ Icons  │ │Projects│ │Sources │ │Style DNA   │   │  │
│                        │  │        │ │        │ │        │ │(Manifests) │   │  │
│                        │  └────────┘ └────────┘ └────────┘ └────────────┘   │  │
│                        └─────────────────────────────────────────────────────┘  │
│                               │                                                  │
│   CONTEXT LAYER              ▼                                                  │
│                        ┌─────────────────────────────────────────────────────┐  │
│                        │            React Context Hierarchy                   │  │
│                        │  ProjectContext → SearchContext → UIContext         │  │
│                        └─────────────────────────────────────────────────────┘  │
│                               │                                                  │
│   GENERATION LAYER           ▼                                                  │
│   ┌────────────────────────────────────────────────────────────────────────┐   │
│   │                      SPROUT ENGINE                                      │   │
│   │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐            │   │
│   │  │  Style   │   │Component │   │ Kitbash  │   │  Hybrid  │            │   │
│   │  │ Enforcer │   │ Indexer  │   │  Engine  │   │Generator │            │   │
│   │  │   (F1)   │   │   (F3)   │   │   (F4)   │   │          │            │   │
│   │  └──────────┘   └──────────┘   └──────────┘   └──────────┘            │   │
│   └────────────────────────────────────────────────────────────────────────┘   │
│                               │                                                  │
│   UI LAYER                   ▼                                                  │
│                        ┌─────────────────────────────────────────────────────┐  │
│                        │   AppShell: [ Sidebar | IconGrid | RightDrawer ]    │  │
│                        └─────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PROJECT MAP

### Directory Structure

```
src/
├── app/                           # Next.js App Router
│   ├── api/                       # API Routes (13 endpoints)
│   │   ├── enrich/                # POST: AI metadata enrichment + component indexing
│   │   ├── generate-svg/          # POST: Native SVG generation (Sprout Engine)
│   │   ├── generate/              # POST: Imagen 3 PNG generation (legacy)
│   │   ├── kitbash/               # POST: Component assembly (plan/execute)
│   │   ├── index-components/      # POST: Semantic component tagging
│   │   ├── vectorize/             # POST: PNG-to-SVG conversion
│   │   ├── export-icons/          # POST: Icon export
│   │   ├── iconify/               # Iconify integration
│   │   │   ├── search/            # GET: Search Iconify API
│   │   │   ├── collections/       # GET: List collections
│   │   │   ├── import/            # POST: Stream import collection
│   │   │   └── adapt/             # POST: Style adaptation
│   │   └── list-models/           # GET: Available AI models
│   ├── actions/                   # Server actions
│   │   └── analyze-library.ts     # Library analysis orchestration
│   ├── layout.tsx                 # Root layout with Providers
│   └── page.tsx                   # Home page (IconGrid)
│
├── lib/                           # Core Services (~9000 LOC, 27 files)
│   │
│   ├── [SPROUT ENGINE - Generation Pipeline]
│   │   ├── hybrid-generator.ts          # ⭐ Main SVG generation orchestrator
│   │   ├── svg-prompt-builder.ts        # Prompt construction with few-shot
│   │   ├── decomposition-service.ts     # Static/dynamic icon decomposition
│   │   ├── similar-icon-finder.ts       # Trait-aware exemplar selection
│   │   ├── kitbash-engine.ts            # ⭐ Component assembly engine
│   │   ├── component-indexer.ts         # Semantic part tagging (F3)
│   │   ├── style-enforcer.ts            # Deterministic style compliance (F1)
│   │   └── svg-validator.ts             # SVG bounds/attribute validation
│   │
│   ├── [LIBRARY ANALYSIS]
│   │   ├── style-analysis.ts            # Style DNA extraction
│   │   ├── library-analyzer.ts          # Pattern extraction from library
│   │   ├── pattern-library.ts           # Reusable SVG patterns/idioms
│   │   └── sample-selection.ts          # Smart sample selection
│   │
│   ├── [EXTERNAL INTEGRATIONS]
│   │   ├── iconify-service.ts           # Iconify API (search, import, adapt)
│   │   ├── ai-icon-service.ts           # Imagen 3 pipeline (legacy)
│   │   ├── style-jury-service.ts        # Vision-based quality evaluation
│   │   └── github-api.ts                # GitHub repo API
│   │
│   ├── [DATA & STATE]
│   │   ├── project-context.tsx          # Workspace/project state
│   │   ├── search-context.tsx           # Search/filter state
│   │   ├── ui-context.tsx               # Modal/drawer UI state
│   │   ├── storage.ts                   # IndexedDB operations
│   │   └── ingestion-service.ts         # GitHub ingestion
│   │
│   └── [UTILITIES]
│       ├── svg-optimizer.ts             # SVGO wrapper
│       ├── image-converter.ts           # Sharp/potrace bridge
│       ├── export-utils.ts              # Export helpers
│       └── utils.ts                     # General utilities
│
├── components/
│   ├── layout/                    # Page structure
│   │   ├── AppShell.tsx           # 3-column layout orchestrator
│   │   ├── Sidebar.tsx            # Left: workspace list, search
│   │   ├── RightDrawer.tsx        # Right: context-sensitive panel
│   │   ├── Header.tsx             # Top navigation
│   │   └── SettingsModal.tsx      # System settings + enrichment
│   │
│   ├── icons/                     # Icon display components
│   │   ├── IconGrid.tsx           # Main grid with pagination
│   │   ├── IconCard.tsx           # Individual icon card
│   │   ├── IconDetail.tsx         # Icon detail view
│   │   ├── IconDetailsPanel.tsx   # Right panel details
│   │   └── CompareModal.tsx       # Side-by-side comparison
│   │
│   ├── dialogs/                   # Modal dialogs
│   │   └── AIIconGeneratorModal.tsx  # ⭐ Sprout/Kitbash UI (main generation interface)
│   │
│   └── ui/                        # shadcn/ui components (18 files)
│
├── types/
│   └── schema.ts                  # Zod schemas (Icon, Component, AiMetadata)
│
scripts/                           # Development & testing
├── spike-*.ts                     # Feature experiments
└── test-*.ts                      # Integration tests

data/
├── feather-icons.json             # Pre-loaded Feather library
└── decompositions.json            # Static decomposition templates (74)
```

### Key Files by Concern

| Concern | Primary File | Purpose |
|---------|--------------|---------|
| **Generation UI** | `AIIconGeneratorModal.tsx` | User-facing generation interface |
| **SVG Generation** | `hybrid-generator.ts` | Orchestrates prompt → SVG pipeline |
| **Component Assembly** | `kitbash-engine.ts` | Plan and execute component assembly |
| **Exemplar Selection** | `similar-icon-finder.ts` | Find best reference icons |
| **Style Compliance** | `style-enforcer.ts` | Enforce stroke-width, linecap, etc. |
| **Enrichment** | `/api/enrich/route.ts` | AI metadata + component indexing |
| **Iconify** | `iconify-service.ts` | 275k+ icon search and import |
| **Workspace State** | `project-context.tsx` | Favorites, custom icons, projects |

---

## 3. CURRENT STATE SNAPSHOT

### System Stability: ✅ STABLE

| Area | Status | Notes |
|------|--------|-------|
| Build | ✅ Clean | No TypeScript errors |
| Generation | ✅ Working | Both Generate and Kitbash modes functional |
| Enrichment | ✅ Working | Component indexing integrated |
| Iconify | ✅ Working | Search, import, adapt all functional |
| UI | ✅ Stable | Modal enlarged, save button prominent |

### Feature Completion (Sprout Engine)

| Feature | Status | Description |
|---------|--------|-------------|
| F1: Style Enforcer | ✅ Complete | Deterministic SVG mutation for compliance |
| F2: Ghost Preview | ✅ Complete | Show candidate between library icons |
| F3: Component Indexer | ✅ Complete | Semantic tagging of icon parts |
| F4: Kitbash Engine | ✅ Complete | Assembly from existing components |
| F5: Skeleton-First UI | ✅ Complete | Plan → Layout → Execute workflow |

### Generation Pipelines

| Pipeline | Status | Quality | When to Use |
|----------|--------|---------|-------------|
| **Hybrid SVG** | ✅ Primary | 8-9/10 | Default for new icons |
| **Kitbash** | ✅ Working | 7-8/10 | When components exist (>50% coverage) |
| **Imagen 3** | ✅ Legacy | 7/10 | When visual creativity > precision |

---

## 4. GENERATION PIPELINE DEEP DIVE

### Hybrid SVG Generator (Primary Path)

```
Input: "rocket" concept
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. REFERENCE ORACLE (Optional - Iconify)                        │
│     Search Iconify → Get cross-library structural consensus      │
│     Output: "rockets have pointed body, fins at base, flame"     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. TRAIT-AWARE EXEMPLAR SELECTION                               │
│     getConceptHints("rocket") → { traits: ['symmetry'] }         │
│     findExemplarIconsWithTraits() → best matching library icons  │
│     Output: [plane, arrow-up, triangle] with trait scores        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. DECOMPOSITION                                                │
│     Static: Check decompositions.json (74 concepts)              │
│     Dynamic: LLM generates component breakdown                   │
│     Output: components[], connectionRules[], patterns[]          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. PROMPT CONSTRUCTION (svg-prompt-builder.ts)                  │
│     • Style DNA (stroke-width, linecap, etc.)                   │
│     • Few-shot examples with [category, complexity, traits]      │
│     • Decomposition structure                                    │
│     • Reference oracle consensus                                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. GEMINI GENERATION                                            │
│     Gemini 2.5 Flash → Raw SVG code output                       │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. POST-PROCESSING                                              │
│     • normalizeSvg() - bounds check, attribute normalization     │
│     • enforceStyle() - deterministic style compliance (F1)       │
│     Output: Final SVG matching library style                     │
└─────────────────────────────────────────────────────────────────┘
```

### Kitbash Engine (Component Assembly)

```
Input: "secure user" concept
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. SOURCE ICON IDENTIFICATION                                   │
│     identifySourceIcons("secure user") via LLM                   │
│     Output: ["user", "shield", "lock"] - library icon names      │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. COMPONENT INDEX SEARCH                                       │
│     Search pre-indexed components by name and semantic tags      │
│     Output: foundParts[], missingParts[]                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. COVERAGE CALCULATION & STRATEGY                              │
│     coverage = foundParts.length / totalParts.length             │
│     ≥90% → GRAFT (mechanical assembly)                          │
│     ≥50% → HYBRID (AI fills gaps)                               │
│     >0%  → ADAPT (modify single part)                           │
│     0%   → GENERATE (full AI generation)                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. LAYOUT GENERATION                                            │
│     LLM suggests 3 layout options with positions for ALL parts   │
│     User selects preferred layout                                │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. EXECUTION                                                    │
│     GRAFT: Pure SVG path combination                            │
│     HYBRID: Combine found parts + generate missing via LLM       │
│     ADAPT: Modify single source icon                            │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. STYLE ENFORCEMENT                                            │
│     Apply style-enforcer.ts rules                               │
│     Output: Final assembled SVG                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. RECENT CHANGES & RATIONALE

### Session Changes (2025-12-01) - Sprint 07 Completion

#### Transform Preservation for Kitbashed Icons
**Files:** `AIIconGeneratorModal.tsx`, `export-utils.ts`, `IconCard.tsx`, `IconDetailsPanel.tsx`, `schema.ts`
**What:** Added `svgContent` field to Icon schema for storing full SVG inner content with `<g transform>` groups.
**Why:** Kitbash was generating correct SVG with transforms on the server, but the save handler was extracting only path `d` attributes, losing all positioning. Now:
- `handleSaveKitbash` detects `<g transform>` and stores `svgContent`
- `createSvgString()` in export-utils uses `svgContent` when present
- Rendering components use `dangerouslySetInnerHTML` with `svgContent`
**Before:** Kitbashed icons exported as overlapping paths without positioning
**After:** Kitbashed icons preserve exact transform positions through save/export

#### Deterministic Layouts for Known Structures
**Files:** `kitbash-engine.ts`
**What:** Updated `getDefaultLayouts()` to detect rocket-like vertical structures and apply hardcoded positions instead of LLM-generated layouts.
**Why:** LLM was generating incorrect positions (e.g., nose scale=1.0, body scale=0.35 - inverted hierarchy). Now:
- Body/case/screen → center at y=13, scale 0.45
- Nose/terminal/top → top at y=5, scale 0.35
- Fins/base/stand → bottom at y=20, scale 0.30
**Before:** Components overlapping or inverted size hierarchy
**After:** Proper vertical stacking with correct scale ratios

#### Blueprint Protocol Deterministic Path
**Files:** `kitbash-engine.ts`
**What:** Updated `generateLayoutsFromBlueprint()` to use deterministic layouts for known structure types instead of calling LLM.
**Why:** LLM layout generation was unreliable and slow (30-40s). Deterministic layouts are instant and correct.
**Result:** Rocket-like structures now position correctly without LLM call

### Session Changes (2025-11-29)

#### Kitbash Source Icon Identification
**Files:** `kitbash-engine.ts`
**What:** Added `identifySourceIcons()` function that asks LLM for library icon names instead of literal component names.
**Why:** Previous decomposition was too literal ("case_body", "keyhole_circle") which never matched indexed components. Now it identifies actual library icons ("briefcase", "lock") that exist and can be searched.
**Before:** 0% matches for compound concepts
**After:** 50%+ matches for concepts with related library icons

#### Layout Generation for All Parts
**Files:** `kitbash-engine.ts`
**What:** Modified `generateLayouts()` and `getDefaultLayouts()` to include positions for BOTH found AND missing parts.
**Why:** Previously layouts only positioned found parts, causing incomplete icons when missing parts were AI-generated but had no placement instructions.

#### Reference Oracle Caching
**Files:** `hybrid-generator.ts`
**What:** Added caching for Reference Oracle results in `generateIconVariants()`.
**Why:** When generating 3 variants, the Reference Oracle was called 3 times with identical results. Now pre-fetches once and reuses.

#### Prominent Kitbash Save Button
**Files:** `AIIconGeneratorModal.tsx`
**What:** Added green success card with prominent "Save to Workspace" button directly in the Kitbash result preview.
**Why:** User couldn't find save functionality - button was hidden in modal footer. Now it's immediately visible after assembly.

### Prior Session Changes

| Change | Rationale |
|--------|-----------|
| **Multi-path SVG saving** | Complex icons (brain) rendered as circles because only first path was extracted |
| **Trait-aware exemplar selection** | Previous selection ignored aiMetadata; 2-4x improvement in trait matching |
| **Style enforcement (F1)** | Generated SVGs had wrong stroke-linecap/linejoin regardless of library style |
| **Component indexing during enrichment** | Components needed for Kitbash must be indexed; added to enrichment pipeline |

---

## 6. TECHNICAL DEBT & KNOWN ISSUES

### Critical Bugs (v0.4.1)

| Bug | Location | Impact | Status |
|-----|----------|--------|--------|
| **Kitbash needs Jury refinement** | `kitbash-engine.ts` | Assembled icons are one-shots without quality gate | 🔴 Open |
| **UI indicators missing** | Icon tiles, workspace header | Heart (favorites) and "..." menu icons not rendering | 🔴 Open |
| **Fragile SVG rendering** | Multiple locations | Ad-hoc "normalization" fixes break styling | 🔴 Open |
| **Component mismatch** | Ingestion vs Kitbash | ~~Assembly tagging doesn't match extraction~~ | ✅ Fixed Sprint 07 |

### High Priority

| Issue | Location | Impact | Effort |
|-------|----------|--------|--------|
| **Kitbash→Jury integration** | `kitbash-engine.ts`, `style-jury-service.ts` | Assembled icons should go through refinement pool | High |
| **System-wide SVG handler** | Needs new service | Prevent piecemeal SVG fixes breaking other flows | High |
| ~~**Component semantic alignment**~~ | ~~`component-indexer.ts`~~ | ~~Parts don't map to assembly~~ | ✅ Fixed Sprint 07 |
| **Kitbash planning slow** | `kitbash-engine.ts` | 30-40s for planning step | Medium |
| **Component indexing not persisted** | Enrichment happens each time | Re-indexes on every enrichment | Low |
| **Decomposition cache not persisted** | `decomposition-service.ts` | Dynamic decompositions lost on restart | Low |

### Medium Priority

| Issue | Location | Impact | Effort |
|-------|----------|--------|--------|
| Legacy Imagen pipeline | `ai-icon-service.ts` | Maintenance burden, rarely used | Medium |
| Duplicate hint mappings | `similar-icon-finder.ts`, `decomposition-service.ts` | Inconsistency risk | Low |
| Spike scripts in repo | `scripts/` | Clutter, not production code | Low |
| Multiple background dev servers | Process management | Port conflicts | Trivial |

### Known Limitations

1. **Single-path storage (simple icons)**: Simple icons stored as single `path` string; compound SVGs combined with space separator
2. **No undo**: Generated icons save directly; no preview-before-save for Generate mode
3. **Enrichment required for Kitbash**: Components only indexed after enrichment is run
4. ~~**No transforms support**~~: ✅ **FIXED in v0.5.0** - SVG `<g transform>` groups now preserved via `svgContent` field

### Architecture Debt: SVG Handling

**Problem:** SVG rendering is handled inconsistently across the app:
- `renderSvgPreview()` in AIIconGeneratorModal
- `dangerouslySetInnerHTML` with inline transforms
- Path extraction/reconstruction in various places
- Each "quick fix" risks breaking other flows

**Impact:** Recent example - "normalize to stroke" fix broke filled SVGs (rocket only showed nose cone)

**Solution Needed:** Create `SvgRenderer` service with:
- Single source of truth for SVG→display
- Render style detection (stroke vs fill vs mixed)
- Theme-aware color handling
- Used by ALL components that display SVGs

### Architecture Debt: Component Semantic Model - ✅ RESOLVED (Sprint 07)

**Problem (RESOLVED):** Kitbash assembly was using a different component model than ingestion:
- **Ingestion** extracts: shapes, positions, basic geometry
- **Kitbash** expected: semantic parts ("wing", "body", "tail")
- **Mismatch:** No mapping between extracted shapes and semantic concepts

**Solution (Sprint 07 - Geometric Intelligence):**
1. Added `GeometricType` enum: circle, square, rect, capsule, triangle, line, curve, L-shape, U-shape, cross, complex
2. Component indexer now extracts geometric type alongside semantic tags
3. New `geometric:${type}` index keys enable shape-based queries
4. Blueprint Protocol: Kitbash now decomposes concepts into geometric primitives
5. Example: "rocket" → [body:capsule, nose:triangle, fins:triangle] → finds battery body, play icon, etc.

**Current Quality:** 6/10 - Significant improvement for structural assembly

### Sprint 07: Geometric Intelligence (New)

**Goal:** Transition Kitbash from "Semantic Collage" to "Geometric Assembly"

**Key Changes:**
1. **Schema** (`src/types/schema.ts`):
   - Added `GeometricTypeSchema` enum (11 shape types)
   - Added `geometricType` field to `IconComponentSchema`
   - Added `IconComponentIndex` interface

2. **Component Indexer** (`src/lib/component-indexer.ts`):
   - Updated LLM prompt to extract geometric type
   - Added `geometric:${type}` index keys
   - Added `findByGeometry()` helper function
   - Added `inferGeometricTypeFromElement()` fallback

3. **Decomposition Service** (`src/lib/decomposition-service.ts`):
   - Added `GeometricPrimitive` and `Blueprint` interfaces
   - Added `getGeometricDecomposition()` function
   - Static blueprints for common concepts (rocket, tv, battery, etc.)

4. **Kitbash Engine** (`src/lib/kitbash-engine.ts`):
   - Added `planKitbashGeometric()` using Blueprint Protocol
   - Added `findGeometricMatches()` for shape-based search
   - Added `generateLayoutsFromBlueprint()` with assembly constraints
   - Updated `planKitbash()` to use geometric mode by default

5. **UI** (`src/components/dialogs/AIIconGeneratorModal.tsx`):
   - Updated found parts display to show source icon name

6. **Scripts** (`scripts/re-enrich-geometric.ts`):
   - Re-enrichment script to populate geometric types for existing icons

**How It Works:**
```
Before (Semantic):
  "rocket" → ["fuselage", "nose-cone", "fins"] → No matches in library → Fail

After (Geometric):
  "rocket" → [capsule, triangle, triangle] → Finds battery body, play icon → Success
```

---

## 7. FUTURE EXPLORATION & OPTIMIZATION

### Immediate Opportunities (Next Sprint)

#### 1. Persist Component Index
**Current:** Components re-indexed during every enrichment
**Solution:** Store component data in IndexedDB alongside icon data
**Benefit:** Faster Kitbash planning, no re-enrichment needed

#### 2. Batch Decomposition Caching
**Current:** Dynamic decompositions lost on server restart
**Solution:** Persist successful decompositions to `decompositions.json`
**Benefit:** Build up static decomposition library over time

#### 3. Kitbash Performance
**Current:** 30-40s planning time
**Solution:**
- Cache LLM responses for common concepts
- Parallelize source icon identification and layout generation
**Benefit:** Sub-10s planning time

### Medium-Term Improvements

#### 4. Variant Diversity
**Issue:** Generated variants often too similar
**Ideas:**
- Use different decomposition interpretations per variant
- Inject explicit structural variation hints
- Rotate semantic emphasis (geometric vs organic)

#### 5. Complete Enrichment Coverage
**Current:** ~62% of icons enriched
**Target:** 100%
**Benefit:** Trait-aware selection works best with full enrichment

#### 6. Collections Feature
**Purpose:** Organize icons within workspaces
**Features:** Create/name collections, drag-and-drop, collection-specific export

### Architectural Improvements

#### 7. Compound SVG Support
**Current:** Single path string storage
**Future:** `elements: SVGElement[]` for proper compound icon support
**Benefit:** Better round-tripping, preserve original structure

#### 8. Style Jury for Native SVG
**Current:** Style Jury only works with Imagen pipeline
**Opportunity:** Apply vision-based scoring to native SVG output
**Benefit:** Quality gate for all generation methods

---

## 8. ENVIRONMENT & CONFIGURATION

### Required Environment Variables

| Variable | Service | When Needed |
|----------|---------|-------------|
| `GOOGLE_API_KEY` | Gemini API | Enrichment, SVG generation, decomposition |

### Optional Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `GOOGLE_CLOUD_PROJECT_ID` | Vertex AI | Imagen 3, Style Jury |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP Auth | Local development |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | GCP Auth | Vercel deployment |

### Graceful Degradation

- No `GOOGLE_API_KEY` → Enrichment disabled, generation fails gracefully
- No `GOOGLE_CLOUD_PROJECT_ID` → Style Jury disabled (pass-through), Imagen unavailable
- No Iconify connectivity → Reference Oracle skipped, import unavailable

---

## 9. TYPE REFERENCE (Key Types)

```typescript
// Core Icon Type
interface Icon {
  id: string;
  name: string;
  library: string;
  path: string;                    // SVG path d attribute(s) - for simple icons
  svgContent?: string;             // ✨ v0.5.0: Full SVG inner content with <g transform> groups
  viewBox: string;                 // Default "0 0 24 24"
  renderStyle: "stroke" | "fill";
  tags: string[];
  aiDescription?: string;
  aiMetadata?: AiMetadata;
  components?: IconComponent[];    // F3: Indexed components
  componentSignature?: string;     // Sorted component names joined
}

// AI Enrichment Metadata
interface AiMetadata {
  semanticCategory: 'object' | 'action' | 'ui' | 'abstract';
  complexity: 1 | 2 | 3 | 4 | 5;
  geometricTraits: GeometricTrait[];
  confidence: number;              // 0-1
}

type GeometricTrait =
  | 'containment'   // Elements inside others
  | 'intersection'  // Crossing strokes
  | 'nested'        // Recursive structure
  | 'fine-detail'   // Small precise elements
  | 'symmetry'      // Bilateral/radial
  | 'open-path'     // Unclosed strokes
  | 'compound';     // Multiple disconnected shapes

// F3: Component for Kitbash
interface IconComponent {
  name: string;             // "arrow-head", "user-body"
  category: ComponentCategory;
  pathData: string;
  elementType: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'ellipse';
  boundingBox: BoundingBox;
  semanticTags: string[];   // ["directional", "upward"]
  sourceIcon: string;       // Icon ID this came from
  weight: number;           // Visual weight 0-1
}

type ComponentCategory =
  | 'body'        // Main shape
  | 'head'        // Top element
  | 'modifier'    // Badge, status
  | 'container'   // Enclosing shape
  | 'indicator'   // Check, arrow
  | 'detail'      // Internal lines
  | 'connector';  // Joining lines

// Kitbash Plan
interface KitbashPlan {
  concept: string;
  requiredParts: string[];
  foundParts: KitbashMatch[];
  missingParts: string[];
  coverage: number;          // 0-1
  strategy: 'graft' | 'hybrid' | 'adapt' | 'generate';
  suggestedLayouts: SkeletonLayout[];
}
```

---

## 10. COMMON COMMANDS

```bash
# Development
npm run dev                    # Start dev server (http://localhost:3000)
npm run build                  # Production build

# Testing
npx tsx scripts/spike-*.ts    # Run spike experiments
npx vitest                     # Run tests

# Debugging
# Check server logs in terminal for [API], [Kitbash], [Decomposition] tags
```

---

## 11. TROUBLESHOOTING

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Circle only" rendering | Multi-path SVG only saved first path | Fixed: extract ALL paths with `matchAll()` |
| 0% Kitbash coverage | Icons not enriched with components | Run enrichment in Settings |
| Kitbash stuck planning | LLM layout generation timing out | Check API key, may need retry |
| Wrong stroke-linecap | Style DNA not passed to generator | Ensure library has styleManifest |
| Style Jury disabled | Missing `GOOGLE_CLOUD_PROJECT_ID` | Set env var or ignore (optional) |
| Port 3000 in use | Multiple dev servers | Kill orphan processes |
| Kitbash icons overlapping | Transforms lost on save | Fixed v0.5.0: `svgContent` field preserves `<g transform>` |
| LLM layouts incorrect | Nose bigger than body, etc. | Fixed v0.5.0: Deterministic layouts for known structures |

---

*This document is the single source of truth for AI development sessions. Update after significant architectural changes.*
