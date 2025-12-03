# PRD 12-C: Persistent Style DNA (Write Once, Read Many)

> **Goal:** Optimize performance by caching analyzing Library Styles once globally, while allowing user-level overrides.
> **Status:** Draft

## 1. User Flow
1.  **Import:** User selects "Lucide" library.
2.  **Check:** System checks `GlobalManifestCache` for "lucide".
3.  **Hit:** Returns cached DNA (0ms).
4.  **Miss:**
    - System fetches 10-20 sample icons from Iconify "Lucide" collection.
    - Runs `StyleAnalyzer` (Iron Dome).
    - Generates DNA Manifest.
    - **Writes to Global Cache.**
5.  **Edit (Optional):** User tweaks the DNA (e.g., changes stroke-width).
    - System saves this as a `UserManifestOverride` for that user/project.

## 2. Data Structure

### 2.1 File Storage Strategy
Since we are serverless/file-based for now, we will use a JSON registry.

**File:** `src/data/style-dna-registry.json`
```json
{
  "lucide": {
    "generatedAt": "2024-12-05T10:00:00Z",
    "version": "1.0",
    "dna": {
      "strokeWidth": "2",
      "strokeLinecap": "round",
      "fill": "none",
      "cornerSmoothing": 0
    }
  },
  "feather": { ... }
}
2.2 Service Layer: StyleDnaService
TypeScript

// src/lib/style-dna-service.ts

import fs from 'fs/promises';
import path from 'path';

const REGISTRY_PATH = path.join(process.cwd(), 'src/data/style-dna-registry.json');

export class StyleDnaService {
  
  // 1. The Main Accessor
  static async getManifest(libraryId: string, userOverride?: StyleDNA): Promise<StyleDNA> {
    // A. Check User Override first
    if (userOverride) return userOverride;

    // B. Check Global Cache
    const cache = await this.readRegistry();
    if (cache[libraryId]) {
      return cache[libraryId].dna;
    }

    // C. Generate Fresh (and cache it)
    return await this.generateAndCache(libraryId);
  }

  // 2. The Generator
  private static async generateAndCache(libraryId: string): Promise<StyleDNA> {
    console.log(`[StyleDNA] Cold start for ${libraryId}...`);
    
    // Fetch samples via IconifyService
    const samples = await IconifyService.fetchSamples(libraryId, 10);
    
    // Analyze
    const dna = await LibraryAnalyzer.analyze(samples);
    
    // Write to Cache
    await this.writeToRegistry(libraryId, dna);
    
    return dna;
  }
}

3. UI Changes
Library Import Modal: Show a "Cached" badge if the DNA is already known.

Style Settings: Add a "Reset to System Default" button if the user has edited the DNA.

4. Integration Steps
[ ] Create src/data/style-dna-registry.json with empty object {}.

[ ] Implement StyleDnaService.

[ ] Update /api/sprout to use StyleDnaService.getManifest(libraryId) instead of re-analyzing every time.