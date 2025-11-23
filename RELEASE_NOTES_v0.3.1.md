# Release Notes: v0.3.1

**Release Date**: November 21, 2025  
**Deployed**: [symbol-garden-2.vercel.app](https://symbol-garden-2.vercel.app)

---

## 🎨 New Feature: Secondary Color Palettes

### Overview
Workspaces can now save up to 8 secondary brand colors in addition to the primary color, enabling faster icon customization workflows.

### What's Included

#### Workspace Settings
- **Brand Defaults Card**: New "Secondary colors" section
- **Add Colors**: Click "+" to add colors (up to 8 per workspace)
- **Edit Colors**: Click any swatch to modify with color picker
- **Remove Colors**: Hover and click "×" or use "Remove" button in picker
- **Validation**: Automatic hex format validation
- **Empty State**: Clear messaging when no colors are saved

#### Icon Details
- **Workspace Colors Row**: Displays primary + all secondary colors as swatches
- **One-Click Application**: Click any swatch to instantly apply that color
- **Visual Feedback**: Active color highlighted with border and scale
- **Tooltips**: Hex values shown on hover

### Benefits
- ✅ No more re-entering hex values
- ✅ Consistent brand colors across icons
- ✅ Faster workflow for multi-color projects
- ✅ Reduced "off-by-one" color errors

---

## 🐛 Bug Fix: Workspace Drawer Sync

### Issue
When workspace settings drawer was open and user switched workspaces, the drawer continued showing the previous workspace's settings.

### Fix
Drawer now auto-updates to show the newly selected workspace's settings, maintaining UI consistency across all panels (sidebar, grid, and drawer).

### User Experience
- ✅ No more mixed state (grid shows WS2, drawer shows WS1)
- ✅ Single "current workspace" across all UI panels
- ✅ Seamless workspace switching without confusion

---

## 📝 Changes

### Modified Files (10)
1. `schema.ts` - Added `secondaryColors` array field
2. `project-context.tsx` - Added palette management functions
3. `secondary-color-palette.tsx` - **NEW** UI component
4. `RightSidebarWorkspace.tsx` - Integrated palette into settings
5. `RightDrawer.tsx` - Wired up palette handlers
6. `IconDetailsPanel.tsx` - Added workspace color swatches
7. `Sidebar.tsx` - Fixed drawer sync + version bump
8. `package.json` - Version 0.3.1
9. `README.md` - Updated features and roadmap
10. `.agent/agent.md` - Updated context

### Lines Changed
- **+511 additions** / **-46 deletions**

---

## 🚀 Deployment

```bash
git commit -m "Release v0.3.1: Secondary Color Palettes + Workspace Drawer Sync"
git push origin main
```

**Status**: ✅ Pushed to GitHub  
**Vercel**: Auto-deploying to production...

---

## 🎯 Next Steps

Continue development on:
- Collections (organize icons within workspaces)
- Advanced filtering by style, category, tags
- Export presets and templates

---

**Built with** ❤️ **using Antigravity AI**
