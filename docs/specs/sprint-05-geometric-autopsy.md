# Sprint 05: The Geometric Autopsy (Library DNA)

## Objective
Shift style analysis from "Runtime Guesswork" to "Ingestion-Time Definition." When a user imports an icon library (e.g., Lineicons), we will use Gemini 1.5 Pro to analyze 20 diverse samples and generate a "Style Manifest" (The DNA). This manifest becomes the non-negotiable "System Prompt" for all future icon generations in that project.

## Implementation Specs

### 1. Schema Update (`src/types/schema.ts`)
Add `styleManifest` string field to `LibrarySchema`.

### 2. The Autopsy Engine (`src/lib/style-analysis.ts`)
Implement `generateLibraryManifest(icons: Icon[])`.

**Logic:**
1. Sample 20 diverse icons (mix of circular, rectangular, diagonal).
2. Prompt Gemini 1.5 Pro: "Perform a geometric autopsy. Define the grid, stroke weight, corner radius, and terminal rules."
3. Return the text block.

### 3. Ingestion Hook (`src/lib/ingestion-service.ts`)
In `ingestGitHubRepo`, after all icons are parsed:
1. Call `generateLibraryManifest`.
2. Save the result to the Library record.

### 4. The "Constitution" Injection (`src/lib/ai-icon-service.ts`)
1. Update `generateIconVariants` to accept `libraryManifest?: string`.
2. Update `askGeminiToWriteImagenPrompt` to prioritize this Manifest over the live seed analysis.

**Prompt Logic:**
"You are an architect following this Design System Specification: [INSERT MANIFEST]. Strict adherence is required."

## Verification
1. **Ingest Test:** Import a small repo. Verify `styleManifest` is populated in the DB.
2. **Generation Test:** Generate a "Basketball". Verify the logs show the Manifest being injected into the prompt.
