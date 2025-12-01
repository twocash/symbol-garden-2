# Symbol Garden 2.0

**A Semantic Icon Style Transpiler** - Transform icons from any open-source library to match your design system's visual DNA.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Version](https://img.shields.io/badge/version-0.9.0-green)

## Overview

Symbol Garden 2.0 is a Next.js application that **transpiles icons between design systems**. Instead of generating icons from scratch (expensive and inconsistent), it takes existing icons from 275,000+ open-source libraries and refactors them to match your target style.

### Core Value Proposition

> "Search → Select → Sprout. Get perfect icons in your library's style without AI hallucinations."

### The Sprout Engine (v0.9.0)

The breakthrough: **LLMs are better at refactoring code than tracing images**.

We treat SVG path data as "source code" and the LLM performs a "style transfer refactoring":

```
Material Design "user" icon (filled, 24px)
        ↓
   Sprout Engine (Code Transpilation)
        ↓
Feather-style "user" icon (2px stroke, rounded caps)
```

**Same geometry. Different style. Zero hallucination.**

## Key Features

### 🌱 **Sprout Engine: SVG Code Transpilation**

The core innovation - style transfer via code refactoring:

- **Token Optimizer**: Reduces SVG size 8-17% before LLM processing
- **Style Manifest Parsing**: LLM reads your library's rules and applies them
- **Multi-Path Preservation**: Semantic structures kept intact (pause = 2 bars)
- **Iron Dome Processing**: 6-stage SVG validation ensures compliance
- **No Vision Required**: Pure text-to-text transformation (faster, cheaper)

### 🔍 **Iconify Integration (275K+ Icons)**

Search across the entire open-source icon ecosystem:

- **Universal Search**: Query Material Design, Tabler, Lucide, FontAwesome, etc.
- **One-Click Adopt**: Import raw icons instantly (no AI cost)
- **One-Click Sprout**: Transform to your library's style
- **Streaming Import**: Batch-import entire collections

### 🛡️ **Iron Dome: SVG Quality Gateway**

All icons pass through a 6-stage processing pipeline:

1. **SANITIZE** - Remove scripts, malicious content
2. **PATH SYNTAX REPAIR** - Fix LLM path errors (`M6 6 12 12` → `M6 6 L12 12`)
3. **NORMALIZE** - Convert style="" to native attributes
4. **STYLE ENFORCEMENT** - Apply Style DNA rules
5. **OPTIMIZATION** - SVGO with mode-aware config
6. **VALIDATION** - Bounds check, auto-fix out-of-bounds

### 🧬 **Style DNA Analysis**

Automatically extract your library's visual rules:

- Stroke width, linecap, linejoin
- Grid system and padding conventions
- Corner treatment (rounded vs sharp)
- Fill policy (stroke-only vs filled)

### 🏢 **Multi-Workspace Management**

- Independent favorites per workspace
- Brand color customization
- Flexible export formats (SVG, PNG, JSX)

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16 (App Router) | SSR, API routes, React 19 |
| Language | TypeScript 5.9 | Type safety with Zod schemas |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first + Radix primitives |
| AI | Gemini 2.5 Flash | Code transpilation (text-only) |
| Storage | IndexedDB | Offline-first browser storage |
| Search | Fuse.js | Fuzzy client-side search |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key (for Sprout features)

### Installation

```bash
git clone https://github.com/twocash/symbol-garden-2.git
cd symbol-garden-2
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Quick Start

1. **Import a Base Library** (Settings → Library → Import from Iconify)
2. **Search for an Icon** (e.g., "rocket", "user")
3. **Select a Reference** from Iconify search results
4. **Click "Sprout"** to transpile to your library's style
5. **Save** to your workspace

### Environment Variables

```bash
# .env.local (required)
GOOGLE_API_KEY=your-gemini-api-key
```

## Architecture

### Sprout Pipeline (v0.9.0)

```
User Search ("rocket")
       │
       ├─► Iconify API → Search results from 200+ libraries
       │
       ├─► User Selection → Pick reference icon
       │
       ├─► Token Optimizer → Reduce SVG size (8-17%)
       │
       ├─► /api/sprout → Gemini 2.5 Flash (code refactoring)
       │   ├─► Read Style Manifest (target rules)
       │   ├─► Analyze Source SVG (geometry)
       │   └─► Refactor coordinates to target grid
       │
       └─► Iron Dome → 6-stage validation → Final SVG
```

### Project Structure

```
src/
├── app/api/
│   ├── sprout/           # Core transpilation endpoint
│   ├── generate-tracer/  # Legacy tracer (09-A spike)
│   ├── iconify/          # Search and import
│   └── enrich/           # AI enrichment
├── lib/
│   ├── sprout-service.ts    # Sprout core logic
│   ├── svg-optimizer.ts     # Token optimizer
│   ├── svg-processor.ts     # Iron Dome
│   └── style-enforcer.ts    # Style compliance
└── components/
    └── dialogs/
        └── AIIconGeneratorModal.tsx
```

## API Reference

### POST /api/sprout

Transform an icon from one style to another.

**Request:**
```json
{
  "sourceSvg": "<svg>...</svg>",
  "styleManifest": "# Style DNA...",
  "concept": "rocket",
  "apiKey": "optional-override"
}
```

**Response:**
```json
{
  "svg": "<svg>...</svg>",
  "success": true,
  "metadata": {
    "tokensSaved": 94,
    "processingTimeMs": 2340,
    "complianceScore": 95
  }
}
```

## Roadmap

### ✅ Completed

- [x] Sprint 09-A: Code Transpilation validation (Vision failed, Code works)
- [x] Sprint 10-A: Sprout Engine backend (Token Optimizer, Service, API)
- [x] Iron Dome 6-stage processing
- [x] Iconify integration (275K+ icons)
- [x] Style DNA analysis
- [x] Multi-workspace management

### 🎯 Next (Sprint 10-B)

- [ ] **Sprout Modal UI**: Search → Select → Sprout workflow
- [ ] **Adopt vs Sprout**: Direct import (free) vs transpile (AI)
- [ ] **Batch Sprout**: Select multiple icons, transform all
- [ ] Deprecate legacy generation flows

### 🔮 Future

- [ ] Semantic expansion ("rocket" → "missile, shuttle, spacecraft")
- [ ] Component library view (parts available for Kitbash)
- [ ] Style preview before Sprout
- [ ] Export to design system tokens

## Contributing

Contributions welcome! Please submit a Pull Request.

## License

MIT License - see LICENSE file.

## Acknowledgments

- [Next.js](https://nextjs.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Google Gemini](https://ai.google.dev/)
- [Iconify](https://iconify.design/)

---

**Status**: v0.9.0 | Sprint 10-A Complete | Sprout Backend Ready
