/**
 * Test script for the Kitbash Engine (Sprout Engine F4)
 *
 * Run with: npx tsx scripts/test-kitbash-engine.ts
 */

import { planKitbash, executeKitbash, formatKitbashPlan, isKitbashable } from '../src/lib/kitbash-engine';
import { indexIconComponents, IconComponent } from '../src/lib/component-indexer';
import { FEATHER_RULES } from '../src/lib/style-enforcer';
import { Icon } from '../src/types/schema';
import * as fs from 'fs';
import * as path from 'path';

// Sample icons with pre-indexed components for testing
const testIcons: Icon[] = [
  {
    id: 'test-user',
    name: 'user',
    library: 'feather',
    path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    viewBox: '0 0 24 24',
    tags: ['person', 'account'],
    components: [
      {
        name: 'user-figure',
        category: 'body',
        pathData: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
        elementType: 'path',
        boundingBox: { x: 4, y: 3, width: 16, height: 18, centerX: 12, centerY: 12 },
        semanticTags: ['person', 'human', 'profile'],
        sourceIcon: 'test-user',
        weight: 1.0,
      },
    ],
    componentSignature: 'user-figure',
  },
  {
    id: 'test-shield',
    name: 'shield',
    library: 'feather',
    path: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    viewBox: '0 0 24 24',
    tags: ['security', 'protection'],
    components: [
      {
        name: 'shield-outline',
        category: 'container',
        pathData: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
        elementType: 'path',
        boundingBox: { x: 4, y: 2, width: 16, height: 20, centerX: 12, centerY: 12 },
        semanticTags: ['protection', 'security', 'defense'],
        sourceIcon: 'test-shield',
        weight: 1.0,
      },
    ],
    componentSignature: 'shield-outline',
  },
  {
    id: 'test-check',
    name: 'check',
    library: 'feather',
    path: 'M20 6L9 17l-5-5',
    viewBox: '0 0 24 24',
    tags: ['checkmark', 'done'],
    components: [
      {
        name: 'check-mark',
        category: 'indicator',
        pathData: 'M20 6L9 17l-5-5',
        elementType: 'path',
        boundingBox: { x: 4, y: 6, width: 16, height: 11, centerX: 12, centerY: 11.5 },
        semanticTags: ['validation', 'success', 'approval'],
        sourceIcon: 'test-check',
        weight: 0.8,
      },
    ],
    componentSignature: 'check-mark',
  },
  {
    id: 'test-lock',
    name: 'lock',
    library: 'feather',
    path: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
    viewBox: '0 0 24 24',
    tags: ['security', 'padlock'],
    components: [
      {
        name: 'lock-body',
        category: 'body',
        pathData: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
        elementType: 'path',
        boundingBox: { x: 3, y: 2, width: 18, height: 20, centerX: 12, centerY: 12 },
        semanticTags: ['security', 'lock', 'protection'],
        sourceIcon: 'test-lock',
        weight: 1.0,
      },
    ],
    componentSignature: 'lock-body',
  },
];

// Build component index from test icons
function buildTestIndex(): Map<string, IconComponent[]> {
  const index = new Map<string, IconComponent[]>();

  for (const icon of testIcons) {
    if (icon.components) {
      for (const comp of icon.components) {
        // Index by name
        const existing = index.get(comp.name) || [];
        existing.push(comp);
        index.set(comp.name, existing);

        // Index by semantic tags
        for (const tag of comp.semanticTags) {
          const tagKey = `tag:${tag}`;
          const tagExisting = index.get(tagKey) || [];
          tagExisting.push(comp);
          index.set(tagKey, tagExisting);
        }

        // Index by category
        const catKey = `category:${comp.category}`;
        const catExisting = index.get(catKey) || [];
        catExisting.push(comp);
        index.set(catKey, catExisting);
      }
    }
  }

  return index;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('KITBASH ENGINE TEST (Sprout Engine F4)');
  console.log('='.repeat(60));
  console.log();

  const componentIndex = buildTestIndex();
  console.log(`Built component index with ${componentIndex.size} keys`);
  console.log();

  // Test concepts
  const testConcepts = [
    'secure user',      // Should find: user + shield or lock
    'verified check',   // Should find: check
    'user shield',      // Should find: user + shield
    'dragon',           // Should NOT find anything (generate)
    'lock check',       // Should find: lock + check
  ];

  for (const concept of testConcepts) {
    console.log('-'.repeat(50));
    console.log(`Testing: "${concept}"`);
    console.log('-'.repeat(50));

    try {
      // Check if kitbashable
      const check = await isKitbashable(concept, componentIndex);
      console.log(`Kitbashable: ${check.kitbashable ? 'YES' : 'NO'} (${(check.coverage * 100).toFixed(0)}% coverage, ${check.strategy})`);

      // Plan
      const plan = await planKitbash(concept, componentIndex);
      console.log();
      console.log(formatKitbashPlan(plan));

      // Execute if we have a strategy other than 'generate'
      if (plan.strategy !== 'generate' && plan.suggestedLayouts.length > 0) {
        console.log();
        console.log('Executing kitbash...');
        const result = await executeKitbash(plan, 0, FEATHER_RULES);
        console.log(`Used generation: ${result.usedGeneration}`);
        if (result.generatedParts.length > 0) {
          console.log(`Generated parts: ${result.generatedParts.join(', ')}`);
        }
        console.log(`SVG length: ${result.svg.length} chars`);

        // Save SVG for inspection
        const outputDir = path.join(process.cwd(), 'spike-output-kitbash');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        const filename = `${concept.replace(/\s+/g, '-')}.svg`;
        fs.writeFileSync(path.join(outputDir, filename), result.svg);
        console.log(`Saved to: spike-output-kitbash/${filename}`);
      }

      console.log();
    } catch (error) {
      console.error(`Error testing "${concept}":`, error);
    }
  }

  // Summary
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
  console.log();
  console.log('The Kitbash Engine (F4) provides:');
  console.log('- Concept decomposition into required parts');
  console.log('- Component matching from indexed library');
  console.log('- Coverage calculation and strategy selection');
  console.log('- Layout generation for component positioning');
  console.log('- SVG assembly from existing components');
}

runTests().catch(console.error);
