# Symbol Garden 2.0

A modern, AI-enhanced icon library manager with native SVG generation, component-based assembly, and style-aware icon synthesis.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Version](https://img.shields.io/badge/version-0.4.1-green)

## Overview

Symbol Garden 2.0 is a Next.js application for managing icon libraries with AI-powered generation capabilities. Unlike generic AI art generators, Symbol Garden creates icons that **match your existing library's style** - same stroke weights, same linecaps, same visual DNA.

### Core Value Proposition

> "Generate icons that look like they belong in your design system, not generic AI art."

## Key Features

### 🌱 **Sprout Engine: Native SVG Generation**

Generate production-ready SVG icons that match your library's style:

- **Native SVG Output**: Direct SVG code generation (no PNG-to-vector conversion)
- **Style DNA Analysis**: Automatically extracts stroke-width, linecap, linejoin, viewBox from your library
- **Trait-Aware Selection**: Picks the best reference icons based on semantic similarity
- **Reference Oracle**: Queries Iconify (275k+ icons) for structural consensus
- **Style Enforcement**: Post-generation validation ensures 100% style compliance

### 🧩 **Kitbash: Component Assembly**

Assemble new icons from existing library components:

- **Semantic Component Index**: Icons are analyzed and tagged by parts (body, head, modifier, container)
- **Coverage Analysis**: Know exactly what percentage of your concept exists in the library
- **Layout Options**: Choose from multiple composition arrangements
- **Hybrid Generation**: AI fills in missing parts while preserving found components
- **Strategies**: GRAFT (100% assembly), HYBRID (partial + AI), ADAPT (modify existing)

### 🔍 **Iconify Integration**

Access 275,000+ open-source icons:

- **One-Click Import**: Import entire collections (Lucide, Tabler, Phosphor, Heroicons)
- **Borrow & Adapt**: Import individual icons and adapt to your library's style
- **Reference Oracle**: Cross-library structural consensus for better generation
- **Smart Suggestions**: Related search terms and existing library matches

### 🤖 **AI-Powered Enrichment**

Enhance your icon library with Google Gemini AI:

- **Semantic Categories**: object, action, ui, abstract
- **Geometric Traits**: symmetry, containment, intersection, compound, etc.
- **Complexity Scoring**: 1-5 scale for generation guidance
- **Component Indexing**: Automatic part identification for Kitbash

### 🏢 **Multi-Workspace Management**

Organize icons across separate workspaces:

- **Independent Favorites**: Each workspace maintains its own favorited icons
- **Brand Customization**: Set workspace-specific brand colors and export formats
- **Quick Switching**: Seamless context switching between projects

### 🎨 **Export & Customization**

Flexible export options:

- **Multiple Formats**: SVG, PNG, JSX
- **Size Control**: 16px to 1024px
- **Color Override**: Per-icon color customization
- **Clipboard Integration**: One-click copy

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16 (App Router) | SSR, API routes, React 19 |
| Language | TypeScript 5.9 | Type safety with Zod schemas |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first + Radix primitives |
| AI - Analysis | Gemini 2.5 Flash | Enrichment, decomposition, planning |
| AI - Generation | Gemini 2.5 Flash | Native SVG code generation |
| Storage | IndexedDB | Offline-first browser storage |
| Search | Fuse.js | Fuzzy client-side search |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key (required for generation features)

### Installation

```bash
# Clone the repository
git clone https://github.com/twocash/symbol-garden-2.git
cd symbol-garden-2

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Quick Start Guide

1. **Import an Icon Library**
   - Click Settings (gear icon) in the sidebar
   - Go to "Library" tab
   - Import from Iconify (recommended) or GitHub repo

2. **Enrich Your Library**
   - In Settings > System, add your Gemini API key
   - Click "Start Enrichment" to batch-process icons
   - This enables trait-aware generation and Kitbash

3. **Generate Icons**
   - Click "Sprout Custom Icon" button
   - Enter a concept (e.g., "rocket", "secure user")
   - Choose **Generate** (AI from scratch) or **Kitbash** (component assembly)
   - Save to your workspace

4. **Use Kitbash for Better Results**
   - Switch to "Kitbash" tab in the generator
   - Click "Plan Assembly" to see coverage
   - Select a layout and click "Assemble Icon"
   - Works best when library has similar concepts

## Environment Variables

| Variable | Required For | Description |
|----------|--------------|-------------|
| `GOOGLE_API_KEY` | All AI features | Gemini API key from [AI Studio](https://aistudio.google.com/apikey) |
| `GOOGLE_CLOUD_PROJECT_ID` | Style Jury, Imagen (legacy) | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local dev | Path to service account JSON |

### Minimal Setup

For basic generation, you only need:

```bash
# .env.local
GOOGLE_API_KEY=your-gemini-api-key
```

### Graceful Degradation

- No `GOOGLE_API_KEY` → Generation disabled, enrichment disabled
- No `GOOGLE_CLOUD_PROJECT_ID` → Style Jury disabled (optional feature)
- No Iconify connectivity → Reference Oracle skipped, import unavailable

## Architecture

### Sprout Engine Pipeline

```
Concept ("rocket")
       │
       ├─► Reference Oracle (Iconify) → Structural consensus
       │
       ├─► Trait-Aware Selection → Best library exemplars
       │
       ├─► Decomposition → Component breakdown
       │
       ├─► Prompt Construction → Style DNA + few-shot examples
       │
       ├─► Gemini Generation → Raw SVG
       │
       └─► Style Enforcement → Final compliant SVG
```

### Kitbash Pipeline

```
Concept ("secure user")
       │
       ├─► Source Icon Identification → ["user", "shield", "lock"]
       │
       ├─► Component Index Search → Found/Missing parts
       │
       ├─► Coverage Calculation → Strategy selection
       │   ├─ ≥90% → GRAFT (mechanical assembly)
       │   ├─ ≥50% → HYBRID (AI fills gaps)
       │   └─ <50% → GENERATE (full AI)
       │
       ├─► Layout Generation → 3 composition options
       │
       └─► Execution → Final assembled SVG
```

### Project Structure

```
src/
├── app/api/                    # API Routes
│   ├── generate-svg/           # Native SVG generation
│   ├── kitbash/                # Component assembly
│   ├── enrich/                 # AI enrichment
│   └── iconify/                # Iconify integration
├── lib/                        # Core Services
│   ├── hybrid-generator.ts     # SVG generation orchestrator
│   ├── kitbash-engine.ts       # Component assembly
│   ├── style-enforcer.ts       # Style compliance
│   └── iconify-service.ts      # Iconify API
├── components/
│   └── dialogs/
│       └── AIIconGeneratorModal.tsx  # Generation UI
└── types/
    └── schema.ts               # Zod schemas
```

## Roadmap

### ✅ Completed (v0.4.1)

- [x] Native SVG Generation (Sprout Engine)
- [x] Component-based Assembly (Kitbash)
- [x] Iconify Integration (275k+ icons)
- [x] Style DNA Analysis & Enforcement
- [x] Trait-Aware Exemplar Selection
- [x] Reference Oracle (cross-library consensus)
- [x] Ghost Preview (contextual validation)
- [x] Multi-Workspace Management
- [x] AI-Powered Enrichment

### 🎯 Next (v0.5.0)

- [ ] Collections (organize icons within workspaces)
- [ ] Persistent component index (faster Kitbash)
- [ ] Decomposition caching
- [ ] Variant diversity improvements
- [ ] Style Jury for native SVG

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- AI powered by [Google Gemini](https://ai.google.dev/)
- Icons from [Iconify](https://iconify.design/) and open-source libraries

---

**Status**: v0.4.1 Released | Sprout Engine Complete
