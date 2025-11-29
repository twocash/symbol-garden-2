# Symbol Garden 2.0 - Architecture & Context Document

> **Last Updated:** 2025-11-29
> **Version:** 0.4.0-roadmap
> **Branch:** feature/svg-native-generation
> **PRD:** See `PRD-iconify-integration.md` for detailed implementation plan

---

## 1. High-Level Architecture

### Tech Stack
| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16 (App Router) | SSR, API routes, React 19 |
| Language | TypeScript 5.9 | Type safety |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first + Radix primitives |
| State | React Context (3-layer) | Client-side state management |
| Storage | IndexedDB (idb-keyval) | Persistent browser storage |
| AI | Gemini 2.5 + Imagen 3 | Generation, analysis, enrichment |
| Vectorization | Sharp + Potrace | PNG-to-SVG conversion |

### Design Principles
1. **Local-First:** All data persists in browser (IndexedDB), no backend database
2. **Library-as-Truth:** Generated icons must match the user's ingested library style
3. **Graceful Degradation:** Features work without all API keys configured
4. **Context-First State:** Hierarchical React Context for predictable state flow

### Core Data Flow
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYMBOL GARDEN 2.0                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   INGESTION  │     │  ENRICHMENT  │     │  GENERATION  │                │
│  │              │     │              │     │              │                │
│  │ GitHub URL   │────▶│ Gemini 2.5   │────▶│ Hybrid SVG   │                │
│  │ SVG Parsing  │     │ AiMetadata   │     │ or Imagen 3  │                │
│  │ Style DNA    │     │ Descriptions │     │ + Vectorize  │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        IndexedDB                                     │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │   │
│  │  │  Icons  │  │Projects │  │ Sources │  │Manifests│               │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     React Context Layer                              │   │
│  │  ProjectContext ──▶ SearchContext ──▶ UIContext                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         UI Layer                                     │   │
│  │  AppShell: [ Sidebar | IconGrid | RightDrawer ]                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Map

### Directory Structure
```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes
│   │   ├── generate/         # Imagen 3 generation (legacy)
│   │   ├── generate-svg/     # Native SVG generation (new)
│   │   ├── enrich/           # Semantic metadata extraction
│   │   ├── vectorize/        # PNG-to-SVG conversion
│   │   └── export-icons/     # Icon export
│   ├── actions/              # Server actions
│   └── page.tsx              # Home (IconGrid)
│
├── lib/                      # Core Services
│   ├── [AI & Generation]
│   │   ├── ai-icon-service.ts       # Imagen 3 pipeline (legacy)
│   │   ├── hybrid-generator.ts      # Native SVG generation (new) ⭐
│   │   ├── decomposition-service.ts # Icon structure breakdown ⭐
│   │   ├── similar-icon-finder.ts   # Trait-aware exemplar selection ⭐
│   │   ├── svg-prompt-builder.ts    # Prompt construction ⭐
│   │   ├── style-analysis.ts        # Geometric Autopsy / Style DNA
│   │   ├── style-jury-service.ts    # Vision-based candidate evaluation
│   │   └── svg-validator.ts         # Coordinate validation & normalization
│   │
│   ├── [State Management]
│   │   ├── project-context.tsx      # Workspaces, favorites, custom icons
│   │   ├── search-context.tsx       # Search, filtering, icon selection
│   │   ├── ui-context.tsx           # Modals, drawers, UI state
│   │   └── Providers.tsx            # Context hierarchy wrapper
│   │
│   ├── [Data & Storage]
│   │   ├── storage.ts               # IndexedDB operations
│   │   ├── ingestion-service.ts     # GitHub repo ingestion
│   │   └── github-api.ts            # GitHub API client
│   │
│   └── [Utilities]
│       ├── pattern-library.ts       # Reusable SVG patterns
│       ├── library-analyzer.ts      # Library-wide analysis
│       └── sample-selection.ts      # Smart sample selection
│
├── components/
│   ├── layout/               # Page structure
│   │   ├── AppShell.tsx      # 3-column layout
│   │   ├── Sidebar.tsx       # Left navigation
│   │   └── RightDrawer.tsx   # Context-sensitive panel
│   ├── icons/                # Icon display components
│   ├── dialogs/              # Modal dialogs
│   └── ui/                   # shadcn/ui components
│
├── types/
│   └── schema.ts             # Zod schemas (Icon, Project, AiMetadata)
│
scripts/                      # Development & testing
├── spike-*.ts                # Feature experiments
└── test-*.ts                 # Integration tests

data/
├── feather-icons.json        # Feather icon library
└── decompositions.json       # Static icon decompositions
```

### Key Files by Feature

| Feature | Primary File | Supporting Files |
|---------|-------------|------------------|
| **Native SVG Gen** | `hybrid-generator.ts` | `decomposition-service.ts`, `svg-prompt-builder.ts` |
| **Trait Selection** | `similar-icon-finder.ts` | `schema.ts` (AiMetadata) |
| **Style DNA** | `style-analysis.ts` | `library-analyzer.ts` |
| **Imagen Pipeline** | `ai-icon-service.ts` | `style-jury-service.ts` |
| **Workspaces** | `project-context.tsx` | `Sidebar.tsx`, storage.ts |
| **Icon Grid** | `IconGrid.tsx` | `search-context.tsx`, `IconCard.tsx` |

---

## 3. Current State Snapshot

### System Stability: **STABLE**
- Build passes cleanly
- All core features functional
- No critical bugs in production path

### Generation Pipelines

| Pipeline | Status | Quality | Notes |
|----------|--------|---------|-------|
| **Hybrid SVG (New)** | ✅ Active | 8-9/10 | Native SVG, trait-aware, Style Jury passing |
| Imagen 3 + Vectorize | ✅ Working | 7/10 | Legacy pipeline, still available |

### Recent Improvements (This Session)
1. **Multi-path SVG Saving** - Fixed brain icon rendering as circle (combined all paths)
2. **Trait-Aware Exemplar Selection** - 2-4x improvement in trait matching
3. **Rich Context Few-Shot** - Icons now include `[category, complexity, traits]`
4. **Semantic Decomposition Hints** - Concepts get structural guidance

### Enrichment Status
- 287 Feather icons loaded
- 180 icons (62.7%) have `aiMetadata` enrichment
- Enables trait-aware generation when enriched

---

## 4. AI Pipeline Architecture

### Generation Methods Comparison

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GENERATION PIPELINES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │  HYBRID SVG GENERATOR (Native) - RECOMMENDED                │            │
│  │                                                              │            │
│  │  Concept ──▶ Trait Analysis ──▶ Exemplar Selection          │            │
│  │                   │                    │                     │            │
│  │                   ▼                    ▼                     │            │
│  │            getConceptHints()   findExemplarIconsWithTraits() │            │
│  │                   │                    │                     │            │
│  │                   ▼                    ▼                     │            │
│  │         Decomposition ◀──────── Few-Shot Context             │            │
│  │              │                                               │            │
│  │              ▼                                               │            │
│  │      Gemini 2.5-flash ──▶ SVG Output ──▶ normalizeSvg()     │            │
│  │                                                              │            │
│  │  Strengths: Fast, native SVG, no vectorization needed        │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │  IMAGEN 3 PIPELINE (Legacy)                                 │            │
│  │                                                              │            │
│  │  Prompt ──▶ Gemini Meta-Prompt ──▶ Imagen 3 (PNG)           │            │
│  │                                          │                   │            │
│  │                                          ▼                   │            │
│  │                              Style Jury (Gemini Vision)      │            │
│  │                                          │                   │            │
│  │                                          ▼                   │            │
│  │                              Vectorization (Sharp + Potrace) │            │
│  │                                          │                   │            │
│  │                                          ▼                   │            │
│  │                                    SVG Output                │            │
│  │                                                              │            │
│  │  Strengths: Better visual creativity, higher fidelity        │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trait-Aware Selection System

```typescript
// Concept → Expected Traits Mapping
CONCEPT_HINTS = {
  rocket:   { category: 'object',   traits: ['symmetry'] },
  scissors: { category: 'object',   traits: ['intersection', 'symmetry'] },
  battery:  { category: 'object',   traits: ['containment', 'symmetry'] },
  network:  { category: 'abstract', traits: ['intersection', 'compound'] },
  ...
}

// Selection scores icons by:
// 1. Matching traits (5x boost)
// 2. Complexity 2-3 (ideal teaching range)
// 3. Semantic category match
// 4. High confidence enrichment
```

---

## 5. Environment Configuration

### Required Variables
| Variable | Service | When Needed |
|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT_ID` | Vertex AI | Imagen 3, Style Jury |
| `GOOGLE_API_KEY` | Gemini API | Enrichment, Native SVG Gen |

### Optional Variables
| Variable | Service | Purpose |
|----------|---------|---------|
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP Auth | Local development |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | GCP Auth | Vercel deployment |

### Graceful Degradation
- No `GOOGLE_CLOUD_PROJECT_ID` → Style Jury disabled (pass-through mode)
- No `GOOGLE_API_KEY` → Enrichment disabled, generation fallbacks

---

## 6. Changelog & Rationale

### Recent Architectural Changes

#### 2025-11-29: Trait-Aware Exemplar Selection
**What Changed:**
- Added `findExemplarIconsWithTraits()` to `similar-icon-finder.ts`
- Integrated with `hybrid-generator.ts` (auto-detects enrichment)
- Added `formatSimilarIconsWithContext()` for rich few-shot prompts
- Added semantic hints to `decomposition-service.ts`

**Why:**
- Previous selection used hardcoded name lists + path length heuristics
- Ignored rich `aiMetadata` (semanticCategory, geometricTraits, complexity)
- For "network" concept, old method: 4 trait matches → new method: 8 trait matches
- Results in structurally more appropriate few-shot examples

#### 2025-11-29: Multi-Path SVG Saving Fix
**What Changed:**
- `AIIconGeneratorModal.tsx` now extracts ALL `<path>` elements
- Combined into single path string with `pathMatches.map().join(' ')`

**Why:**
- Complex icons like "brain" have multiple `<path>` elements
- Previous regex only captured first path → rendered as circle
- Now preserves full icon structure

#### 2025-11-28: SVG Normalization (Stroke-Only)
**What Changed:**
- Added `ensureStrokeOnly()` and `normalizeSvg()` to `svg-validator.ts`
- All generated SVGs now have explicit `fill="none"` on every element

**Why:**
- SVG `fill` attribute doesn't inherit from parent `<svg>` element
- Child elements like `<circle>` defaulted to filled (black)
- Style Jury was failing icons with "VIOLATION: Filled shapes"

#### Earlier: Native SVG Generation (Hybrid Generator)
**What Changed:**
- New generation path bypassing Imagen 3 entirely
- Uses Gemini to directly output SVG code
- Decomposition service provides structural guidance

**Why:**
- Imagen 3 + vectorization introduced artifacts
- Native SVG generation is faster (no image pipeline)
- Better control over stroke/fill properties
- Decomposition ensures correct structure

---

## 7. Future Exploration & Optimization

### High Priority (Next Sprint)

#### 1. Complete Enrichment Coverage
**Current:** 62.7% of icons enriched
**Target:** 100%
**Impact:** Trait-aware selection works best with full enrichment
**Effort:** Low (run enrichment on remaining icons)

#### 2. Expand CONCEPT_HINTS Coverage
**Current:** ~20 concepts mapped
**Need:** More concepts for better trait prediction
**Approach:** Analyze decompositions.json patterns, add common icon concepts

#### 3. Collections Feature (v0.4.0)
**Purpose:** Organize icons within workspaces
**Features:**
- Create/name collections
- Drag-and-drop assignment
- Collection-specific export settings

### Medium Priority

#### 4. Hybrid Generator Variant Diversity
**Issue:** Variants can be too similar despite different temperatures
**Ideas:**
- Use different decomposition interpretations per variant
- Inject explicit structural variation hints
- Rotate semantic emphasis (geometric vs organic)

#### 5. Style Jury Integration with Native SVG
**Current:** Style Jury only works with Imagen pipeline
**Opportunity:** Apply vision-based scoring to native SVG output
**Benefit:** Quality gate for all generation methods

#### 6. Decomposition Quality Improvement
**Current:** Dynamic decomposition sometimes produces weak structures
**Ideas:**
- Cache successful decompositions
- Use exemplar icons' actual paths as reference
- Add decomposition validation step

### Technical Debt

| Item | Location | Impact | Effort |
|------|----------|--------|--------|
| Legacy Imagen pipeline code | `ai-icon-service.ts` | Maintenance burden | Medium |
| Duplicate hint mappings | `similar-icon-finder.ts`, `decomposition-service.ts` | Consistency | Low |
| LocalStorage fallback | `storage.ts` | Migration debt | Low |
| Spike scripts cleanup | `scripts/` | Repo cleanliness | Low |

### Optimization Opportunities

1. **Batch Enrichment:** Enrich icons during ingestion (not on-demand)
2. **Decomposition Caching:** Persist dynamic decompositions to JSON
3. **Library Analysis Caching:** Store analysis in IndexedDB
4. **Prompt Token Optimization:** Reduce few-shot example verbosity

---

## 8. Roadmap: Iconify Integration & Fidelity

### Executive Summary

Symbol Garden's next major evolution integrates **Iconify** (275k+ open-source icons) as a reference oracle and import source, plus fixes generation fidelity issues.

### Architecture Evolution

```
┌─────────────────────────────────────────────────────────┐
│                    SYMBOL GARDEN                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   USER'S    │    │  ICONIFY    │    │    LLM      │ │
│  │  LIBRARIES  │    │   ORACLE    │    │  GENERATOR  │ │
│  │             │    │             │    │             │ │
│  │ • Feather   │    │ • Search    │    │ • Novel     │ │
│  │ • Custom    │    │ • Import    │    │   concepts  │ │
│  │             │    │ • Reference │    │ • Style     │ │
│  │             │    │ • Adapt     │    │   transfer  │ │
│  └─────────────┘    └─────────────┘    └─────────────┘ │
│         │                  │                  │        │
│         └──────────────────┴──────────────────┘        │
│                           │                            │
│                    ┌──────┴──────┐                     │
│                    │  ICON NEED  │                     │
│                    └─────────────┘                     │
│                           │                            │
│              ┌────────────┼────────────┐               │
│              ▼            ▼            ▼               │
│         [In Library]  [In Iconify]  [Generate]         │
│            Use it    Import/Adapt   Create new         │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

### Phase Overview

| Phase | Name | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| **P0** | Style Enforcement | Critical | 2h | 🔴 Not Started |
| **P1a** | Iconify Service Layer | High | 3h | 🔴 Not Started |
| **P1b** | One-Click Library Import | High | 6h | 🔴 Not Started |
| **P1c** | Reference Oracle for Generation | High | 4h | 🔴 Not Started |
| **P2** | Borrow & Adapt | Medium | 4h | 🔴 Not Started |
| **P3** | Discovery Features | Low | 6h | 🔴 Not Started |

### P0: Style Enforcement (Critical)

**Problem:** Generated icons have wrong `stroke-linecap`/`stroke-linejoin` because few-shot examples are hardcoded to "round" regardless of library style.

**Solution:**
1. Parameterize `formatIconWithContext()` to accept `StyleSpec`
2. Update `normalizeSvg()` to enforce correct stroke attributes
3. Add style validation to `validateSvg()`

**Files:** `similar-icon-finder.ts`, `svg-validator.ts`, `svg-prompt-builder.ts`

### P1a: Iconify Service Layer

**New File:** `src/lib/iconify-service.ts`

```typescript
// Core functions
async function searchIcons(query: string): Promise<SearchResult>;
async function getIconSvg(prefix: string, name: string): Promise<string>;
async function getCollectionIcons(prefix: string): Promise<IconifyIcon[]>;
async function getStrokeBasedCollections(): Promise<IconifyCollection[]>;
```

**Features:**
- In-memory cache with TTL
- Fallback hosts (api.iconify.design, api.simplesvg.com, api.unisvg.com)
- Path extraction from SVG

### P1b: One-Click Library Import

**UI:** Settings → Libraries → "Add from Iconify" → search/browse → click to import

**Flow:**
1. User browses Iconify collections
2. Clicks "Import"
3. Stream progress: fetch → convert → enrich
4. Library appears in sidebar

### P1c: Reference Oracle for Generation

**Concept:** When generating "bike", search Iconify across multiple libraries to establish structural consensus (where wheels go, frame shape, etc.), then generate in user's library style.

### Key Iconify Collections (Stroke-Based)

| Collection | Icons | Notes |
|------------|-------|-------|
| `lucide` | 1,653 | Feather fork, actively maintained |
| `tabler` | 5,963 | Large, consistent set |
| `phosphor` | 9,072 | Multiple weights |
| `heroicons` | 876 | Tailwind ecosystem |

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Stroke attribute accuracy | ~50% | 100% |
| Spatial composition quality | ~60% | 85% |
| Libraries available | ~1 | 200+ |

**Full details:** See `PRD-iconify-integration.md`

---

## 9. Quick Reference

### Hot Files (Most Modified)
```
src/lib/hybrid-generator.ts      # Native SVG generation
src/lib/similar-icon-finder.ts   # Trait-aware selection
src/lib/decomposition-service.ts # Icon structure
src/lib/svg-prompt-builder.ts    # Prompt construction
src/lib/iconify-service.ts       # Iconify API integration (NEW)
src/components/dialogs/AIIconGeneratorModal.tsx
```

### Common Commands
```bash
npm run dev          # Development server
npm run build        # Production build
npx tsx scripts/spike-smart-selection.ts  # Test trait selection
```

### Blockers & Solutions
| Issue | Solution | File |
|-------|----------|------|
| "Circle only" rendering | Extract ALL paths with `matchAll()` | AIIconGeneratorModal.tsx |
| Filled shape violations | `normalizeSvg()` adds `fill="none"` | svg-validator.ts |
| Poor exemplar selection | Use `findExemplarIconsWithTraits()` | similar-icon-finder.ts |
| Style Jury disabled | Set `GOOGLE_CLOUD_PROJECT_ID` | .env.local |
| Wrong stroke-linecap | P0: Parameterize formatters | similar-icon-finder.ts |

---

## 10. Type Reference

### Core Types (from schema.ts)
```typescript
interface Icon {
  id: string;
  name: string;
  library: string;
  path: string;                    // SVG path d attribute
  viewBox: string;                 // Default "0 0 24 24"
  renderStyle: "stroke" | "fill";
  tags: string[];
  aiDescription?: string;
  aiMetadata?: AiMetadata;
}

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
```

---

*This document is the single source of truth for AI development sessions. Update after significant architectural changes.*
