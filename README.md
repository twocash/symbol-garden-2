# Symbol Garden 2.0

A modern, AI-enhanced icon library manager with workspace organization, intelligent search, and context-first design.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Version](https://img.shields.io/badge/version-0.3.1-green)

## Overview

Symbol Garden 2.0 is a Next.js application for managing and exploring icon libraries across multiple workspaces. Built with a context-first architecture, it features AI-powered semantic search, GitHub repository ingestion, and workspace-specific branding and export settings.

## Key Features

### 🤖 **AI-Powered Enrichment**
Enhance your icon library with Google Gemini AI:
- **Semantic Descriptions**: Auto-generate business-context descriptions for icons
- **Smart Tagging**: Automatically add relevant tags and keywords
- **Batch Processing**: Enrich entire libraries or individual icons on-demand
- **Persistent Storage**: AI-generated metadata saved locally for instant search

### 🏢 **Multi-Workspace Management**
Organize icons across separate workspaces:
- **Independent Favorites**: Each workspace maintains its own favorited icons
- **Brand Customization**: Set workspace-specific brand colors and export formats
- **Quick Switching**: Seamless context switching between projects
- **Workspace Actions**: Rename, duplicate, and soft-delete workspaces

### 🔍 **Advanced Fuzzy Search**
Fast client-side search powered by Fuse.js:
- Search across icon names, tags, AI descriptions, and categories
- Filter by library or workspace
- Toggle between "All Icons" and "Favorites" views
- Real-time results as you type

### 📦 **GitHub Ingestion**
Import icon libraries directly from GitHub repositories:
- **Auto-Detection**: Smart SVG parsing with fill vs stroke detection
- **Popular Libraries**: Bootstrap Icons, Lucide, Phosphor, Heroicons, and more
- **Custom Repos**: Support for any SVG-based icon library on GitHub
- **Conflict Handling**: Full path IDs prevent duplicates

### 🎨 **Workspace Branding**
Context-aware customization per workspace:
- **Primary Brand Color**: Visual color picker with hex input
- **Secondary Color Palette**: Save up to 8 brand colors for quick access
- **Quick-Select Swatches**: One-click color application in Icon Details
- **Export Formats**: Default to SVG, PNG, or JSX per workspace
- **Repository Links**: Connect workspaces to source repos
- **Live Preview**: Icons render with workspace brand colors

### 🎛️ **Powerful Export Tools**
Flexible export options with instant preview:
- **Size Control**: 16px to 1024px with smooth slider
- **Color Override**: Per-icon color customization
- **Multiple Formats**: Copy/Download as SVG or PNG
- **Clipboard Integration**: One-click copy to clipboard

### 🖥️ **Modern UI/UX**
Clean, polished interface with:
- **Unified Right Drawer**: Context-sensitive panel for icon details or workspace settings
- **3-Column Layout**: Sidebar | Main Content | Drawer
- **Keyboard Shortcuts**: `Esc` to close drawer
- **Dark Mode**: Premium Graphite/Neon Sprout color scheme

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **AI**: Google Gemini API (gemini-2.5-flash)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Search**: Fuse.js for fuzzy matching
- **State**: React Context API (UIContext, ProjectContext, SearchContext)
- **Storage**: Browser localStorage (local-first, no backend)
- **Icons**: Lucide React (UI components)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key (optional, for AI enrichment)

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

1. **Import Icons**
   - Navigate to the left sidebar
   - Click the `+` button next to "Workspaces" to create a workspace
   - Add a GitHub repository (e.g., `https://github.com/twbs/icons`)
   - Icons will auto-ingest and appear in the grid

2. **Enable AI Enrichment** (Optional)
   - Open the workspace settings (kebab menu → "Workspace settings...")
   - Scroll to "AI Enrichment" section
   - Add your Gemini API key
   - Click "Start Enrichment" to batch-process icons

3. **Customize Your Workspace**
   - Set brand color for icon previews
   - Choose default export format (SVG/PNG/JSX)
   - Add repository link for reference

4. **Export Icons**
   - Click any icon to open details
   - Adjust size and color as needed
   - Copy or download in your preferred format

## Architecture

### Context-First Design

Symbol Garden uses a **context-driven architecture** where the active workspace determines the entire UI state:

- **UIContext**: Manages drawer state (Icon Details vs Workspace Settings)
- **ProjectContext**: Handles workspace CRUD, favorites, and brand settings
- **SearchContext**: Powers search, filtering, and icon selection

### Component Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Main grid view
│   └── api/
│       └── enrich/              # AI enrichment endpoint
├── components/
│   ├── icons/
│   │   ├── IconDetailsPanel.tsx # Right drawer: Icon details
│   │   ├── IconGrid.tsx         # Main icon grid
│   │   └── LibraryHeader.tsx    # Search + filters
│   ├── layout/
│   │   ├── AppShell.tsx         # 3-column layout
│   │   ├── Sidebar.tsx          # Workspace switcher
│   │   ├── RightDrawer.tsx      # Unified right panel
│   │   └── RightSidebarWorkspace.tsx # Workspace settings cards
│   └── dialogs/                 # Modals for workspace actions
├── lib/
│   ├── ui-context.tsx           # Drawer + modal state
│   ├── project-context.tsx      # Workspace management
│   ├── search-context.tsx       # Search + filtering
│   └── ingestion-service.ts     # GitHub SVG parsing
└── types/
    └── schema.ts                # TypeScript schemas
```

## Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run type-check  # if configured
```

## Roadmap

- [x] Core UI Components & Search
- [x] GitHub Ingestion Pipeline
- [x] Multi-Workspace Management
- [x] AI-Powered Enrichment (Gemini)
- [x] Context-First Architecture
- [x] Unified Right Drawer
- [x] **Secondary Color Palettes**
- [ ] **Collections** (organize icons within workspaces)
- [ ] Advanced filtering (by style, category, tags)
- [ ] Export presets and templates
- [ ] Keyboard navigation and shortcuts
- [ ] Icon comparison tool enhancements

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Search powered by [Fuse.js](https://fusejs.io/)
- AI enrichment via [Google Gemini API](https://ai.google.dev/)
- Icons from various open-source libraries

---

**Status**: 🚀 v0.3.1 Released | ✨ Active Development
