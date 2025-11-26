# Sprint 03: Vector Pipeline & Style Fidelity

## Executive Summary
This sprint upgrades the entire generation pipeline—from Prompting to Vectorization—to ensure generated icons match the **Visual Weight** and **Construction Style** (Filled vs. Outlined) of the user's library.

## Section 1: Visual Weight Analysis (The "Eye")
**File:** `src/lib/style-analysis.ts`

### Task: Implement Weight Calculation
Add `calculateVisualWeight(buffer: Buffer): number`.
- **Logic:** Convert image to binary black/white and calculate the percentage of black pixels (Density).
- **Thresholds:**
    - `< 5%`: Light (Thin strokes).
    - `5% - 15%`: Regular.
    - `> 15%`: Bold (Heavy strokes/Filled).

### Task: Integrate into Workflow
Update `analyzeStyleReferences` in `src/lib/ai-icon-service.ts`:
- Run `calculateVisualWeight` on all seed buffers.
- Return the average `visualWeight` in the style summary.

---

## Section 2: Prompt Engineering (The "Voice")
**File:** `src/lib/prompt-builder.ts` & `src/lib/ai-icon-service.ts`

### Task: Dynamic Prompt Construction
Update `askGeminiToWriteImagenPrompt` to enforce the correct construction method.

**Logic:**
1.  **If Strategy == OUTLINED:**
    - **FORBID:** "silhouette", "solid shape", "filled", "stencil".
    - **REQUIRE:** "monoline line art", "hollow shape", "continuous stroke".
    - **INJECT WEIGHT:**
        - If `visualWeight > 15`: "thick, bold marker lines".
        - If `visualWeight < 5`: "fine, hairline technical drawing".
2.  **If Strategy == FILLED:**
    - Keep existing "silhouette/stencil" logic.

---

## Section 3: Data Flow (The "Spine")
**Files:** `api/generate/route.ts`, `AIIconGeneratorModal.tsx`, `api/vectorize/route.ts`

### Task: Pass the Context
Ensure the `strategy` (FILLED/OUTLINED) and `visualWeight` (number) are passed from the Generation step to the Vectorization step.

---

## Section 5: Verification (The Test)
**File:** `scripts/test-blur-pipeline.ts`

### Task: Create Automated Test
Create a script that takes a "Thin Hexagon" input and runs it with `targetWeight: 20` (Bold).
- **Expectation:** The output SVG should have significantly thicker lines than the input image.
- **Artifacts:** Save `debug/blurred.png` and `debug/thresholded.png` to visually verify the thickening process.

## Section 6: Grid Quantization (The "Bulletproof" Fix)
**File:** `src/lib/style-analysis.ts` & `src/lib/ai-icon-service.ts`

### The Problem
AI SVGs use a 1024px coordinate space with high precision (e.g., `354.2345`).
Target libraries (e.g., Lineicons) use small grids (e.g., 24px) with low precision.
**Result:** The AI output preserves "noise" as valid geometry.

### Task 1: Detect Target Grid
Update `analyzeStyleReferences` in `style-analysis.ts`.
- **Logic:** Check the `viewBox` of seed SVGs.
- **Extraction:** If `viewBox="0 0 24 24"`, set `targetGrid = 24`.
- **Default:** If undetected, default to `24`.

### Task 2: Implement "Grid Snapping" in SVGO
Update `vectorizeImage` in `ai-icon-service.ts`.
We must run `svgo` with a custom configuration that enforces the grid.

**The Pipeline Step (Final Output):**
1.  **Calculate Scale Factor:** `scale = targetGrid / 1024` (e.g., 0.0234).
2.  **SVGO Configuration:**
    ```javascript
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // 1. Simplify curves aggressively
            convertPathData: {
              floatPrecision: 1,  // <--- THE FIX: Rounds coordinates to 1 decimal
              transformPrecision: 1,
              makeArcs: true,     // Converts wobbly curves to perfect circles
              straightCurves: true,
              collapseRepeated: true,
            },
            // 2. Remove "Turds" vector-side
            removeSmalls: {
              active: true,
              params: { elems: 'path', area: 10 } // Removes tiny noise islands
            }
          }
        }
      },
      // 3. Force Scale Down to Grid
      {
        name: 'addAttributesToSVGElement',
        params: {
          attributes: [
            { viewBox: `0 0 ${targetGrid} ${targetGrid}` },
            { width: '256' }, // Display size
            { height: '256' }
          ]
        }
      }
    ]
    ```

**Verification:**
The final SVG path `d` should look like `M2 12 L22 12` (clean integers) instead of `M2.01 11.99 L21.99 12.01`.