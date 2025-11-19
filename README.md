# Symbol Garden 2.0

A modern icon library manager with GitHub ingestion, intelligent SVG parsing, and customizable exports.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## Overview

Symbol Garden 2.0 is a Next.js application for managing and exploring icon libraries across projects. It features a dark-mode-first UI with powerful search, GitHub repository ingestion, and flexible export options.

## Features

### 🔍 **Fuzzy Search**
Fast client-side search across icon names, tags, categories, and synonyms using Fuse.js.

### 📦 **GitHub Ingestion**
Import icon libraries directly from GitHub repositories. Supports popular libraries like:
- Bootstrap Icons (twbs/icons)
- Lucide Icons
- Phosphor Icons
- Heroicons
- And any other SVG-based icon library on GitHub

### 🎨 **Smart SVG Parsing**
Automatically detects fill vs stroke rendering styles for accurate display across different icon libraries.

### 🎛️ **Customizable Exports**
- **Size Control**: Adjust from 16px to 1024px with a slider
- **Color Picker**: Choose any color for your icons
- **Multiple Formats**: Export as PNG or SVG
- **Copy to Clipboard**: One-click copy as SVG code or PNG image

### 🏷️ **Library Filtering**
Filter and browse icons by specific libraries for easy QA and focused exploration.

### 💾 **Local-First**
All data stored in browser localStorage - no backend required, fully Vercel-compatible.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **Search**: Fuse.js for fuzzy matching
- **State Management**: React Context API
- **Storage**: Browser localStorage
- **Icons**: Lucide React (UI icons)

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/symbol-garden-2.git
cd symbol-garden-2

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### First Steps

1. Navigate to **Settings** (bottom-left sidebar)
2. Add a GitHub repository URL (e.g., `https://github.com/twbs/icons`)
3. Specify the path to icons within the repo (e.g., `icons`)
4. Click **Add Source** to ingest the library
5. Browse and search your imported icons!

## Usage

### Importing Icons

1. Go to **Settings** page
2. Enter a GitHub repository URL
3. Specify the path to the SVG files (optional)
4. Click **Add Source**

The app will fetch all SVG files and parse them automatically.

### Searching Icons

Use the search bar in the header to search across:
- Icon names
- Tags
- Categories
- Synonyms

### Exporting Icons

1. Click any icon to open the detail panel
2. Adjust size with the slider (16-1024px)
3. Choose a color with the color picker
4. Export options:
   - **Copy SVG**: Copies SVG code to clipboard
   - **Copy PNG**: Copies PNG image to clipboard
   - **Download SVG**: Downloads SVG file
   - **Download PNG**: Downloads PNG file

### Filtering by Library

Use the dropdown in the top-right to filter icons by library. This is useful for:
- Validating imported libraries
- Browsing a specific icon set
- QA testing

## Project Structure

```
symbol-garden-2/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page with icon grid
│   │   └── settings/          # Settings page
│   ├── components/
│   │   ├── icons/             # Icon-related components
│   │   │   ├── IconCard.tsx   # Grid item
│   │   │   ├── IconGrid.tsx   # Main grid view
│   │   │   └── IconDetail.tsx # Detail panel with exports
│   │   ├── layout/            # Layout components
│   │   │   ├── AppShell.tsx   # Main layout wrapper
│   │   │   ├── Header.tsx     # Search header
│   │   │   └── Sidebar.tsx    # Navigation sidebar
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── search-context.tsx # Global search state
│   │   ├── github-api.ts      # GitHub API client
│   │   ├── ingestion-service.ts # SVG parsing & normalization
│   │   └── export-utils.ts    # PNG/SVG export utilities
│   └── types/
│       └── schema.ts          # TypeScript schemas
├── public/
│   └── data/
│       └── icons.json         # Seed data (optional)
└── devbridge-context.md       # Project context tracking
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

## Roadmap

- [x] Core UI Components
- [x] Search Engine
- [x] GitHub Ingestion Pipeline
- [x] Enhanced Export Tools
- [x] Library Filtering
- [ ] Project Management (Favorites, Collections)
- [ ] Multi-project support
- [ ] Synonym expansion (AI integration)
- [ ] Concept clusters visualization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Search powered by [Fuse.js](https://fusejs.io/)
- Icons from various open-source libraries

---

**Status**: ✅ MVP Complete | 🚧 Active Development
