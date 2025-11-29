/**
 * Test script for P1c Reference Oracle
 *
 * Run with: npx tsx scripts/test-reference-oracle.ts
 */

import { getStructuralReference, STROKE_BASED_COLLECTIONS } from '../src/lib/iconify-service';

// Get API key from environment
const API_KEY = process.env.GOOGLE_API_KEY;

async function testReferenceOracle() {
  console.log('🧪 Testing P1c Reference Oracle\n');
  console.log('='.repeat(60));

  const testConcepts = ['bike', 'rocket', 'heart', 'shopping-cart'];

  for (const concept of testConcepts) {
    console.log(`\n📍 Testing concept: "${concept}"`);
    console.log('-'.repeat(40));

    try {
      const startTime = Date.now();
      const ref = await getStructuralReference(concept, {
        maxIcons: 6,
        maxPerCollection: 1,
        apiKey: API_KEY,
      });
      const elapsed = Date.now() - startTime;

      if (!ref) {
        console.log(`   ❌ No reference found for "${concept}"`);
        continue;
      }

      console.log(`   ✅ Found ${ref.iconCount} icons from ${ref.collections.length} libraries`);
      console.log(`   Collections: ${ref.collections.join(', ')}`);

      if (ref.consensus.elements.length > 0) {
        console.log(`\n   Common Elements:`);
        for (const element of ref.consensus.elements) {
          console.log(`     - ${element}`);
        }
      }

      if (ref.consensus.spatialPattern) {
        console.log(`\n   Spatial Pattern:`);
        console.log(`     ${ref.consensus.spatialPattern}`);
      }

      if (ref.consensus.commonTraits.length > 0) {
        console.log(`\n   Geometric Traits: ${ref.consensus.commonTraits.join(', ')}`);
      }

      console.log(`\n   Example SVGs: ${ref.exampleSvgs.length}`);
      for (const example of ref.exampleSvgs) {
        console.log(`     - ${example.iconId}: ${example.svg.length} chars`);
      }

      console.log(`\n   ⏱️ Took ${elapsed}ms`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test complete!\n');
}

// Run test
testReferenceOracle().catch(console.error);
