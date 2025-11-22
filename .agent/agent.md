# Agent Instructions: Symbol Garden 2.0

## Project Context

This is Symbol Garden 2.0, an AI-enhanced icon library manager with multi-workspace organization.

**Version:** 0.3.0  
**Tech Stack:** Next.js 16, TypeScript, React 19, Tailwind CSS 4, Google Gemini API  
**Architecture:** Context-First (UIContext, ProjectContext, SearchContext)

## Key Conventions

### Code Style
- TypeScript strict mode enabled
- React Server Components by default, use `"use client"` when needed
- Context API for state management (no Redux/Zustand)
- shadcn/ui for UI components
- Tailwind CSS for styling (no inline styles)

### File Organization
- `/src/app` - Next.js App Router pages and API routes
- `/src/components` - React components (icons, layout, dialogs, ui)
- `/src/lib` - Contexts, utilities, services
- `/src/types` - TypeScript schemas and interfaces

### State Management
- **UIContext** - Drawer state, modal management
- **ProjectContext** - Workspace CRUD, favorites, brand settings
- **SearchContext** - Search, filtering, icon selection

## Development Workflows

### Adding a New Feature
1. Update `task.md` with checklist items
2. Create `implementation_plan.md` for complex features
3. Implement changes
4. Update `devbridge-context.md` with session notes
5. Commit and push to GitHub (auto-deploys via Vercel)

### Common Commands
```bash
npm run dev         # Start dev server
npm run build       # Build for production
npm run lint        # Run ESLint
```

## Project-Specific Notes

*(Add your custom instructions here)*

---

**Last Updated:** 2025-11-21
