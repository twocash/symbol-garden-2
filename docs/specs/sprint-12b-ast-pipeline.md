# PRD 12-B: Robust AST Pipeline & Sprout Refactor

> **Goal:** harden the ingestion pipeline against malformed HTML/SVG and optimize LLM usage by feeding it pre-normalized data.
> **Status:** Draft
> **Dependencies:** PRD 12-A

## 1. Context
`sprout-service.ts` currently uses Regex to strip attributes. This is fragile. Also, the LLM prompt is complex because it handles scaling. We will switch to an AST-based parser and simplify the prompt.

## 2. Technical Solution

### 2.1 AST Parser Implementation
Replace Regex manipulation with `cheerio` (server-side DOM implementation).

**Why Cheerio?** It's lightweight, fast, and handles the quirks of XML/SVG parsing better than regex.

### 2.2 Refactoring `sprout-service.ts`

The new `sproutIcon` flow:

1.  **Ingest:** Receive Source SVG.
2.  **Normalize (CPU):** Call `normalizeTo24x24(sourceSvg)` (from PRD 12-A).
    - *Result:* Clean, 24x24 SVG.
3.  **Fast Path Check:**
    - If `mode === 'adopt'` or no significant semantic change requested:
    - **AST Transformation:** Load into Cheerio.
        - Remove `class`, `style`, `id`.
        - Strip `stroke`, `fill`, `stroke-width` from *children*.
        - Apply Target DNA attributes to `<svg>` root.
    - Return Result.
4.  **LLM Path (Style Only):**
    - If stylistic change is complex (e.g., "Make it sketch style"):
    - **Prompt:** "Here is a clean 24x24 SVG. Apply this specific style: [Manifest]. Do NOT move points. Just change stroke/fill/caps."

### 2.3 Implementation Logic (AST Stripper)

```typescript
import * as cheerio from 'cheerio';

export function robustStyleTransfer(svgString: string, styleManifest: StyleManifest): string {
  const $ = cheerio.load(svgString, { xmlMode: true });
  
  // 1. Clean Attributes on Children
  $('*').each((i, el) => {
    const tag = $(el).prop('tagName');
    if (tag === 'svg') return; // Skip root for now
    
    // List of presentation attributes to strip so root styles cascade
    const attrsToStrip = ['stroke', 'stroke-width', 'fill', 'stroke-linecap', 'stroke-linejoin'];
    attrsToStrip.forEach(attr => $(el).removeAttr(attr));
  });

  // 2. Apply Manifest to Root
  const $root = $('svg');
  $root.attr('viewBox', '0 0 24 24'); // Ensure compliance
  $root.attr('fill', 'none');
  $root.attr('stroke', 'currentColor');
  $root.attr('stroke-width', styleManifest.strokeWidth);
  $root.attr('stroke-linecap', styleManifest.strokeLinecap);
  
  return $.html('svg');
}
3. Tasks
[ ] Install cheerio.

[ ] Refactor sprout-service.ts to use robustStyleTransfer.

[ ] Update buildSproutPrompt to remove "Coordinate Conversion" instructions (since it's done).