/**
 * Test script for the Component Indexer (Sprout Engine F3)
 *
 * Run with: npx tsx scripts/test-component-indexer.ts
 */

import { indexIcon, indexIconComponents, formatIconIndex, formatComponent } from '../src/lib/component-indexer';
import { Icon } from '../src/types/schema';
import * as fs from 'fs';
import * as path from 'path';

// Test icons with known structures
const testIcons: Icon[] = [
  {
    id: 'test-user',
    name: 'user',
    library: 'feather',
    path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    viewBox: '0 0 24 24',
    tags: ['person', 'account', 'profile'],
  },
  {
    id: 'test-check',
    name: 'check',
    library: 'feather',
    path: 'M20 6L9 17l-5-5',
    viewBox: '0 0 24 24',
    tags: ['checkmark', 'done', 'complete'],
  },
  {
    id: 'test-home',
    name: 'home',
    library: 'feather',
    path: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
    viewBox: '0 0 24 24',
    tags: ['house', 'building'],
  },
  {
    id: 'test-shield',
    name: 'shield',
    library: 'feather',
    path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    viewBox: '0 0 24 24',
    tags: ['security', 'protection'],
  },
  {
    id: 'test-arrow-right',
    name: 'arrow-right',
    library: 'feather',
    path: 'M5 12h14M12 5l7 7-7 7',
    viewBox: '0 0 24 24',
    tags: ['direction', 'navigate'],
  },
];

async function runTests() {
  console.log('='.repeat(60));
  console.log('COMPONENT INDEXER TEST (Sprout Engine F3)');
  console.log('='.repeat(60));
  console.log();

  // Check for API key
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('Note: No GOOGLE_API_KEY found. Running in fallback mode (basic parsing only).');
    console.log();
  }

  // Test individual icon indexing
  for (const icon of testIcons) {
    console.log('-'.repeat(50));
    console.log(`Testing: ${icon.name}`);
    console.log('-'.repeat(50));

    try {
      const index = await indexIcon(icon, apiKey);
      console.log(formatIconIndex(index));
      console.log();
    } catch (error) {
      console.error(`Error indexing ${icon.name}:`, error);
    }

    // Rate limiting for API calls
    if (apiKey) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Test with real library icons if available
  const featherPath = path.join(process.cwd(), 'data', 'feather-icons.json');
  if (fs.existsSync(featherPath)) {
    console.log('='.repeat(60));
    console.log('TESTING WITH REAL FEATHER ICONS');
    console.log('='.repeat(60));
    console.log();

    try {
      const data = JSON.parse(fs.readFileSync(featherPath, 'utf-8'));
      const icons = Array.isArray(data) ? data : data.icons || [];

      // Test with first 5 icons
      const sampleIcons = icons.slice(0, 5);

      for (const icon of sampleIcons) {
        console.log('-'.repeat(50));
        console.log(`Testing: ${icon.name}`);
        console.log('-'.repeat(50));

        try {
          const index = await indexIcon(icon, apiKey);
          console.log(formatIconIndex(index));
          console.log();
        } catch (error) {
          console.error(`Error indexing ${icon.name}:`, error);
        }

        if (apiKey) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (error) {
      console.error('Error loading feather icons:', error);
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('The Component Indexer (F3) is ready for:');
  console.log('- Semantic tagging of icon parts');
  console.log('- Building searchable component indexes');
  console.log('- Enabling the Kitbash Engine (F4)');
}

runTests().catch(console.error);
