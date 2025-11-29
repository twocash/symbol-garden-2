# PRD: Iconify Integration & Generation Fidelity

**Version:** 1.0
**Date:** 2025-01-29
**Status:** Draft
**Author:** Claude + Jim

---

## Executive Summary

Symbol Garden's AI icon generation produces icons with style fidelity issues (wrong stroke attributes, poor spatial composition). This PRD outlines a multi-phase approach to achieve "forgery-level" icon generation through:

1. **Style Enforcement** - Fix immediate fidelity bugs
2. **Iconify Integration** - Leverage 275k+ open-source icons as a reference oracle
3. **Structural Reference** - Use cross-library consensus for spatial composition
4. **One-Click Import** - Simplify library acquisition

---

## Problem Statement

### Current Issues

1. **Wrong Stroke Attributes**: Generated icons have `stroke-linecap="butt"` when the library uses `"round"`. The LLM learns from few-shot examples (hardcoded to "round") rather than explicit instructions.

2. **Poor Spatial Composition**: Complex concepts (bike, rocket) result in correct shapes in wrong positions. A bike might have wheels, a frame, and a seat—but arranged nonsensically.

3. **Library Import Friction**: Users must manually find, download, and convert icon libraries. No discovery mechanism exists.

4. **No Gap-Filling Solution**: When a library lacks a concept, users must generate (risky) or do without.

### Root Causes

| Issue | Root Cause |
|-------|------------|
| Wrong stroke attributes | Few-shot examples hardcode attributes; LLM follows examples over instructions |
| Poor composition | Decomposition provides parts but not spatial relationships |
| Import friction | No integration with external icon sources |
| Gap filling | No way to borrow/adapt from other libraries |

---

## Solution Overview

### Architecture Vision

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

---

## Iconify API Overview

**Iconify** provides free, open-source access to 275,000+ icons across 200+ libraries.

### Key Endpoints

| Endpoint | Purpose | Example |
|----------|---------|---------|
| `/search?query={term}` | Search icons by keyword | `/search?query=bike&limit=20` |
| `/{prefix}/{name}.svg` | Get SVG for specific icon | `/lucide/bike.svg` |
| `/collections` | List all icon sets | Metadata, licenses, style info |

### Relevant Collections (Stroke-Based, 24x24)

| Collection | Icons | Style | Notes |
|------------|-------|-------|-------|
| `lucide` | 1,653 | Stroke | Feather fork, actively maintained |
| `tabler` | 5,963 | Stroke | Large, consistent set |
| `feather` | 287 | Stroke | Original, canonical |
| `phosphor` | 9,072 | Stroke | Multiple weights |
| `heroicons` | 876 | Stroke | Tailwind ecosystem |
| `humbleicons` | 278 | Stroke | Clean, minimal |

### API Characteristics

- **Free**: No API key required
- **No rate limits**: Documented, but be respectful
- **CORS-enabled**: Works from browser
- **Reliable**: Multiple backup hosts

---

## Phases

### Phase 0: Style Enforcement (P0 - Critical)

**Goal**: Fix immediate fidelity issues with stroke attributes.

**Changes**:

1. **Parameterize Few-Shot Formatters**
   - `formatIconWithContext()` accepts `StyleSpec`
   - `formatSimilarIconsForPrompt()` accepts `StyleSpec`
   - Use library's actual attributes, not hardcoded "round"

2. **Style-Aware Normalization**
   - Update `normalizeSvg()` to enforce correct stroke attributes
   - Add `enforceStyleSpec(svg, styleSpec)` function
   - Force correct `stroke-linecap`, `stroke-linejoin`, `stroke-width`

3. **Validation Enhancement**
   - Add style attribute validation to `validateSvg()`
   - Warn when generated SVG has wrong stroke attributes

**Files Modified**:
- `src/lib/similar-icon-finder.ts`
- `src/lib/svg-validator.ts`
- `src/lib/svg-prompt-builder.ts`

**Success Criteria**:
- Generated icons have correct `stroke-linecap` and `stroke-linejoin`
- Matches user's library style 100% for stroke attributes

**Effort**: ~2 hours

---

### Phase 1a: Iconify Service Layer (P1)

**Goal**: Create reusable service for all Iconify interactions.

**New File**: `src/lib/iconify-service.ts`

```typescript
// Core types
interface IconifyIcon {
  prefix: string;      // e.g., "lucide"
  name: string;        // e.g., "bike"
  svg: string;         // Full SVG markup
  path?: string;       // Extracted path data
}

interface IconifyCollection {
  prefix: string;
  name: string;
  total: number;
  license: { title: string; spdx: string };
  palette: boolean;    // true = colored, false = monochrome
  height: number;
  tags?: string[];     // e.g., ["Uses Stroke", "Has Padding"]
}

interface SearchResult {
  icons: string[];     // e.g., ["lucide:bike", "tabler:bike"]
  total: number;
  collections: Record<string, IconifyCollection>;
}

// Core functions
async function searchIcons(query: string, options?: SearchOptions): Promise<SearchResult>;
async function getIconSvg(prefix: string, name: string): Promise<string>;
async function getCollection(prefix: string): Promise<IconifyCollection>;
async function getCollectionIcons(prefix: string): Promise<IconifyIcon[]>;
async function getStrokeBasedCollections(): Promise<IconifyCollection[]>;
```

**Features**:
- In-memory cache with TTL
- Automatic retry with backup hosts
- Filter by stroke-based collections
- Extract path data from SVG

**Effort**: ~3 hours

---

### Phase 1b: One-Click Library Import (P1)

**Goal**: Import any Iconify collection with one click.

**UI Changes** (`SettingsModal.tsx`):

```
Libraries Tab
├── Your Libraries
│   └── [existing library list]
└── Add Library
    ├── [Search box: "Search Iconify collections..."]
    ├── [Results grid with collection cards]
    │   ├── Lucide (1,653 icons) [Import]
    │   ├── Tabler (5,963 icons) [Import]
    │   └── ...
    └── [Filter: Stroke-based only | All]
```

**Import Flow**:

1. User searches/browses collections
2. Clicks "Import" on a collection
3. Progress modal shows:
   - "Fetching icons... (0/1653)"
   - "Converting to Symbol Garden format..."
   - "Running enrichment pipeline..."
4. Library appears in sidebar

**Backend** (`/api/import-library`):

```typescript
POST /api/import-library
{
  "prefix": "lucide",
  "runEnrichment": true  // optional, default true
}

Response (streaming):
{ "status": "fetching", "progress": 0, "total": 1653 }
{ "status": "fetching", "progress": 500, "total": 1653 }
{ "status": "converting", "progress": 1000 }
{ "status": "enriching", "progress": 0, "total": 1653 }
{ "status": "complete", "libraryId": "lucide", "iconCount": 1653 }
```

**Data Storage**:
- Save to `data/{prefix}-icons.json`
- Same format as existing `feather-icons.json`

**Effort**: ~6 hours

---

### Phase 1c: Reference Oracle for Generation (P1)

**Goal**: Use cross-library icon consensus to guide spatial composition.

**Concept**: When generating "bike", search Iconify for bike icons across multiple stroke-based libraries. Extract structural patterns that appear consistently.

**Integration Point**: `hybrid-generator.ts`

```typescript
// Before generation, get structural reference
const structuralRef = await getStructuralReference(concept, {
  collections: ['lucide', 'tabler', 'feather', 'phosphor'],
  maxIcons: 6,
});

// Include in prompt
const prompt = buildSvgPrompt({
  // ... existing options
  structuralReference: structuralRef,
});
```

**Structural Reference Format**:

```typescript
interface StructuralReference {
  concept: string;
  iconCount: number;        // How many icons we found
  consensus: {
    elements: string[];     // ["two circles at bottom", "triangle frame", "small circle for head"]
    spatialPattern: string; // "wheels horizontally aligned at y~18, frame rises to y~6"
    commonTraits: string[]; // ["symmetry", "compound"]
  };
  exampleSvgs: string[];    // 2-3 actual SVGs for visual reference
}
```

**Generation**: Use LLM to analyze 4-6 cross-library icons and extract consensus before generating.

**Effort**: ~4 hours

---

### Phase 2: Borrow & Adapt (P2)

**Goal**: Import individual icons from Iconify and adapt to user's library style.

**UI**: In AI Icon Generator modal, before generating:

```
┌─────────────────────────────────────────────────────┐
│ Generate: "rocket"                                  │
├─────────────────────────────────────────────────────┤
│ Found "rocket" in other libraries:                  │
│                                                     │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ 🚀  │ │ 🚀  │ │ 🚀  │ │ 🚀  │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘                    │
│ Lucide   Tabler  Phosphor Heroicons                │
│                                                     │
│ [Import & Adapt]  or  [Generate New]               │
└─────────────────────────────────────────────────────┘
```

**Adaptation Pipeline**:

1. Fetch icon SVG from Iconify
2. Parse and extract path data
3. Apply style adaptation:
   - Adjust `stroke-width` to match library
   - Set correct `stroke-linecap` and `stroke-linejoin`
   - Scale/translate if viewBox differs
4. Save to user's custom icons

**Effort**: ~4 hours

---

### Phase 3: Discovery Features (P3)

**Goal**: Help users discover libraries and find related icons.

**3a: Find Similar Libraries**

Given user's current library, find similar collections:
- Same viewBox size
- Same stroke style (stroke vs fill)
- Similar icon count/complexity

**3b: "Icon Exists" Pre-Check**

Before generating, check:
1. Does icon exist in user's library? → Use it
2. Does icon exist in Iconify (stroke-based)? → Offer import
3. Neither? → Generate

**3c: Related Icons Suggestions**

When user searches "bike", show:
- Exact matches in their library
- Related concepts: "bicycle", "cycling", "motorcycle"
- Icons from Iconify that might work

**Effort**: ~6 hours total

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Stroke attribute accuracy | ~50% | 100% | Manual audit of 20 generations |
| Spatial composition quality | ~60% | 85% | User rating 1-5, target avg 4+ |
| Library import time | N/A | <30s | Time from click to usable |
| Icons available | ~300 | 275k+ | Via Iconify integration |

---

## Technical Considerations

### Caching Strategy

```typescript
// Three-tier cache
const cache = {
  // Tier 1: In-memory (hot)
  memory: new Map<string, { data: any; expires: number }>(),

  // Tier 2: localStorage (warm, browser only)
  localStorage: typeof window !== 'undefined' ? window.localStorage : null,

  // Tier 3: File system (cold, server only)
  fileSystem: process.env.NODE_ENV === 'production' ? null : fs,
};

// TTLs
const TTL = {
  searchResults: 5 * 60 * 1000,      // 5 minutes
  iconSvg: 24 * 60 * 60 * 1000,      // 24 hours
  collectionMetadata: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

### Error Handling

```typescript
// Iconify has backup hosts
const ICONIFY_HOSTS = [
  'https://api.iconify.design',
  'https://api.simplesvg.com',
  'https://api.unisvg.com',
];

async function fetchWithFallback(path: string): Promise<Response> {
  for (const host of ICONIFY_HOSTS) {
    try {
      const response = await fetch(`${host}${path}`);
      if (response.ok) return response;
    } catch (e) {
      continue;
    }
  }
  throw new Error('All Iconify hosts failed');
}
```

### Bundle Size Considerations

- Iconify service is server-side only for imports
- Client-side only does search queries (small payloads)
- No need to bundle icon data - fetched on demand

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Iconify API becomes unavailable | High | Low | Cache aggressively, backup hosts |
| Iconify adds rate limits | Medium | Low | Implement request queuing |
| License compliance issues | Medium | Low | Display license info, filter by permissive licenses |
| Large library import crashes browser | Medium | Medium | Stream imports, chunked processing |

---

## Timeline

| Phase | Effort | Dependencies | Priority |
|-------|--------|--------------|----------|
| Phase 0: Style Enforcement | 2h | None | P0 - Do Now |
| Phase 1a: Iconify Service | 3h | None | P1 |
| Phase 1b: One-Click Import | 6h | 1a | P1 |
| Phase 1c: Reference Oracle | 4h | 1a | P1 |
| Phase 2: Borrow & Adapt | 4h | 1a, 0 | P2 |
| Phase 3: Discovery | 6h | 1a, 1b | P3 |

**Total Effort**: ~25 hours across all phases

---

## Open Questions

1. **Enrichment on import**: Should we auto-enrich imported libraries? (Expensive but valuable)
2. **Storage location**: File system vs database for imported libraries?
3. **Offline support**: Cache recently-used Iconify icons for offline generation?
4. **Style adaptation accuracy**: How well can we adapt icons between different stroke widths?

---

## Appendix: Iconify API Reference

### Search

```
GET https://api.iconify.design/search?query=bike&limit=20

Response:
{
  "icons": ["lucide:bike", "tabler:bike", ...],
  "total": 32,
  "collections": {
    "lucide": { "name": "Lucide", "total": 1653, ... }
  }
}
```

### Get SVG

```
GET https://api.iconify.design/lucide/bike.svg

Response: (SVG markup)
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
    <circle cx="18.5" cy="17.5" r="3.5"/>
    <circle cx="5.5" cy="17.5" r="3.5"/>
    <circle cx="15" cy="5" r="1"/>
    <path d="M12 17.5V14l-3-3l4-3l2 3h2"/>
  </g>
</svg>
```

### Collection Info

```
GET https://api.iconify.design/collection?prefix=lucide

Response:
{
  "prefix": "lucide",
  "total": 1653,
  "name": "Lucide",
  "author": { "name": "Lucide Contributors", ... },
  "license": { "title": "ISC", "spdx": "ISC", ... },
  "height": 24,
  "samples": ["circle-check", "award", "house", ...],
  "category": "UI 24px",
  "tags": ["Precise Shapes", "Has Padding", "Uses Stroke"]
}
```
