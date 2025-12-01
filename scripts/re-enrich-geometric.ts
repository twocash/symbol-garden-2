/**
 * Re-enrich existing icons with geometric type classification
 * Sprint 07: Adds geometricType to all indexed components
 *
 * Run: npx tsx scripts/re-enrich-geometric.ts
 *
 * This script:
 * 1. Loads the existing icon library
 * 2. Re-indexes each icon's components with geometric type extraction
 * 3. Saves the updated library back to disk
 */

import * as fs from 'fs';
import * as path from 'path';

// We need to set up the module resolution for @/ paths
const PROJECT_ROOT = path.join(__dirname, '..');

// Dynamic import to handle the module system
async function main() {
  // Check for API key
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_API_KEY environment variable is required');
    console.error('Set it with: export GOOGLE_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log('Sprint 07: Re-enrichment with Geometric Intelligence');
  console.log('=====================================================');

  // Load the library
  const libPath = path.join(PROJECT_ROOT, 'data', 'feather-icons.json');
  if (!fs.existsSync(libPath)) {
    console.error(`Error: Library not found at ${libPath}`);
    process.exit(1);
  }

  console.log(`Loading library from: ${libPath}`);
  const library = JSON.parse(fs.readFileSync(libPath, 'utf-8'));
  console.log(`Found ${library.length} icons`);

  // Import the indexer dynamically
  const { indexIconComponents } = await import('../src/lib/component-indexer');

  // Stats
  let enriched = 0;
  let errors = 0;
  const startTime = Date.now();

  // Process each icon
  for (let i = 0; i < library.length; i++) {
    const icon = library[i];

    try {
      // Re-index with geometric extraction
      const components = await indexIconComponents(icon, apiKey);

      // Update the icon
      icon.components = components;
      icon.componentSignature = components
        .map((c: any) => `${c.name}:${c.geometricType}`)
        .sort()
        .join('+');

      enriched++;

      // Log progress
      const geometricTypes = [...new Set(components.map((c: any) => c.geometricType))];
      console.log(`[${i + 1}/${library.length}] ${icon.name}: ${geometricTypes.join(', ')}`);

    } catch (error) {
      errors++;
      console.error(`[${i + 1}/${library.length}] Error processing ${icon.name}:`, error);
    }

    // Rate limiting - Gemini has per-minute limits
    if ((i + 1) % 10 === 0) {
      console.log(`--- Processed ${i + 1}/${library.length} (${Math.round((i + 1) / library.length * 100)}%) ---`);
    }

    // Pause between requests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Save the updated library
  console.log('\nSaving updated library...');
  fs.writeFileSync(libPath, JSON.stringify(library, null, 2));

  // Summary
  const elapsed = (Date.now() - startTime) / 1000;
  console.log('\n=====================================================');
  console.log('Re-enrichment Complete!');
  console.log(`  Icons processed: ${enriched}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Time: ${elapsed.toFixed(1)}s`);
  console.log(`  Library saved to: ${libPath}`);

  // Show sample of geometric distribution
  const geoStats: Record<string, number> = {};
  for (const icon of library) {
    for (const comp of icon.components || []) {
      const geo = comp.geometricType || 'unknown';
      geoStats[geo] = (geoStats[geo] || 0) + 1;
    }
  }

  console.log('\nGeometric Type Distribution:');
  for (const [type, count] of Object.entries(geoStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }
}

main().catch(console.error);
