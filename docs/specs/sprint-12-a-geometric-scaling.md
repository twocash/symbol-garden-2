# PRD 12-A: Universal Deterministic Scaling (Geometric Intelligence)

> **Goal:** Eliminate LLM hallucinations in coordinate scaling by moving all geometric normalization to the CPU.
> **Status:** Draft
> **Priority:** Critical (Pre-requisite for 12-B)

## 1. Context
Currently, `sprout-service.ts` relies on the LLM to resize icons (e.g., 20x20 → 24x24). This causes:
1.  **Truncation:** LLMs give up on long path strings.
2.  **Precision Errors:** `12.0` becomes `11.9`.
3.  **Latency:** Math via tokens is slow.

## 2. Technical Solution
We will implement an **Affine Transformation Engine** that parses SVG path data and mathematically scales it to a standard 24x24 `viewBox`.

### 2.1 New Utility: `src/lib/geometric-scaler.ts`

**Requirements:**
- Accept any valid SVG input string.
- Parse `viewBox` to determine `scaleX` and `scaleY`.
- Parse all `<path>` `d` attributes.
- Apply `x' = x * scaleX` and `y' = y * scaleY` to all commands.
- Round to 1 decimal place (0.1px precision is sufficient for web).
- Handle Center Scaling: If the icon is square (e.g., 20x20), scale to 24x24. If rectangular (e.g., 10x20), scale to fit 24x24 preserving aspect ratio and center it.

### 2.2 Implementation Logic (Reference for Coding)

```typescript
import { parseSVG, makeAbsolute } from 'svg-path-parser'; // Recommended lib
// OR reuse existing internal utils if robust enough

interface ScaleResult {
  svg: string;
  originalViewBox: string;
  scaleFactor: number;
}

export function normalizeTo24x24(sourceSvg: string): ScaleResult {
  // 1. Extract ViewBox
  const viewBoxRegex = /viewBox=["']\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s*["']/;
  const match = sourceSvg.match(viewBoxRegex);
  
  // Default to 0 0 24 24 if missing
  const [_, minX, minY, width, height] = match ? match.map(Number) : [0, 0, 0, 24, 24];
  
  // 2. Calculate Scale Factors (Fit to 24x24)
  // Target is 24x24. We usually want a 2px padding, so target effective area is 20x20?
  // DECISION: Standardize to FULL 24x24 frame for now.
  const targetSize = 24;
  const scaleX = targetSize / width;
  const scaleY = targetSize / height;
  
  // 3. Parse and Transform Paths
  // This requires a robust path parser. 
  // Pseudocode for the transform loop:
  const newD = commands.map(cmd => {
      // Scale coordinates
      if ('x' in cmd) cmd.x = Number((cmd.x * scaleX).toFixed(1));
      if ('y' in cmd) cmd.y = Number((cmd.y * scaleY).toFixed(1));
      // Handle Bezier control points (x1, y1, x2, y2) similarly...
      return serializeCommand(cmd);
  }).join(' ');
  
  return {
    svg: `<svg viewBox="0 0 24 24" ...><path d="${newD}" .../></svg>`,
    originalViewBox: `${minX} ${minY} ${width} ${height}`,
    scaleFactor: scaleX
  };
}

Here is the comprehensive Sprint 12 documentation package. I have structured these as three distinct PRDs designed to be implemented sequentially.

These are written specifically for Claude Code (or any agentic IDE) to consume: they include file paths, specific function signatures, and "implementation nuggets"—dense blocks of logic that the AI can copy-paste and adapt easily.

Sprint 12 Master Plan: The Geometric & Persistence Update
Sequence:

PRD 12-A: Universal Deterministic Scaling (The Math Engine)

PRD 12-B: Robust AST Pipeline (The Safety Engine)

PRD 12-C: Persistent Style DNA (The Caching Engine)

PRD 12-A: Universal Deterministic Scaling
Filename: docs/specs/sprint-12a-geometric-scaling.md

Markdown

# PRD 12-A: Universal Deterministic Scaling (Geometric Intelligence)

> **Goal:** Eliminate LLM hallucinations in coordinate scaling by moving all geometric normalization to the CPU.
> **Status:** Draft
> **Priority:** Critical (Pre-requisite for 12-B)

## 1. Context
Currently, `sprout-service.ts` relies on the LLM to resize icons (e.g., 20x20 → 24x24). This causes:
1.  **Truncation:** LLMs give up on long path strings.
2.  **Precision Errors:** `12.0` becomes `11.9`.
3.  **Latency:** Math via tokens is slow.

## 2. Technical Solution
We will implement an **Affine Transformation Engine** that parses SVG path data and mathematically scales it to a standard 24x24 `viewBox`.

### 2.1 New Utility: `src/lib/geometric-scaler.ts`

**Requirements:**
- Accept any valid SVG input string.
- Parse `viewBox` to determine `scaleX` and `scaleY`.
- Parse all `<path>` `d` attributes.
- Apply `x' = x * scaleX` and `y' = y * scaleY` to all commands.
- Round to 1 decimal place (0.1px precision is sufficient for web).
- Handle Center Scaling: If the icon is square (e.g., 20x20), scale to 24x24. If rectangular (e.g., 10x20), scale to fit 24x24 preserving aspect ratio and center it.

### 2.2 Implementation Logic (Reference for Coding)

```typescript
import { parseSVG, makeAbsolute } from 'svg-path-parser'; // Recommended lib
// OR reuse existing internal utils if robust enough

interface ScaleResult {
  svg: string;
  originalViewBox: string;
  scaleFactor: number;
}

export function normalizeTo24x24(sourceSvg: string): ScaleResult {
  // 1. Extract ViewBox
  const viewBoxRegex = /viewBox=["']\s*(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s*["']/;
  const match = sourceSvg.match(viewBoxRegex);
  
  // Default to 0 0 24 24 if missing
  const [_, minX, minY, width, height] = match ? match.map(Number) : [0, 0, 0, 24, 24];
  
  // 2. Calculate Scale Factors (Fit to 24x24)
  // Target is 24x24. We usually want a 2px padding, so target effective area is 20x20?
  // DECISION: Standardize to FULL 24x24 frame for now.
  const targetSize = 24;
  const scaleX = targetSize / width;
  const scaleY = targetSize / height;
  
  // 3. Parse and Transform Paths
  // This requires a robust path parser. 
  // Pseudocode for the transform loop:
  const newD = commands.map(cmd => {
      // Scale coordinates
      if ('x' in cmd) cmd.x = Number((cmd.x * scaleX).toFixed(1));
      if ('y' in cmd) cmd.y = Number((cmd.y * scaleY).toFixed(1));
      // Handle Bezier control points (x1, y1, x2, y2) similarly...
      return serializeCommand(cmd);
  }).join(' ');
  
  return {
    svg: `<svg viewBox="0 0 24 24" ...><path d="${newD}" .../></svg>`,
    originalViewBox: `${minX} ${minY} ${width} ${height}`,
    scaleFactor: scaleX
  };
}

3. Integration Plan
Create src/lib/geometric-scaler.ts.

Add unit tests in src/lib/__tests__/geometric-scaler.test.ts with:

A 20x20 icon (should scale up 1.2x).

A 100x100 icon (should scale down 0.24x).

A 12x24 icon (should center horizontally).

4. Success Criteria
[ ] normalizeTo24x24 processes a complex icon (e.g., fa-solid:dragon) in <5ms.

[ ] Output SVG visually matches input SVG (no distortion).

[ ] Output viewBox is strictly 0 0 24 24.