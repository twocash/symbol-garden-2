/**
 * Test script for Iconify Service
 *
 * Run with: npx tsx scripts/test-iconify-service.ts
 */

import {
  searchIcons,
  searchStrokeBasedIcons,
  getIconSvg,
  getIconSvgById,
  getCollection,
  getCollections,
  getCollectionIconNames,
  searchAndGetSvgs,
  STROKE_BASED_COLLECTIONS,
} from '../src/lib/iconify-service';

async function runTests() {
  console.log('🧪 Testing Iconify Service\n');
  console.log('='.repeat(60));

  // Test 1: Basic search
  console.log('\n📍 Test 1: Basic search for "bike"');
  try {
    const results = await searchIcons('bike', { limit: 10 });
    console.log(`   Found ${results.total} total icons`);
    console.log(`   First 10: ${results.icons.slice(0, 10).join(', ')}`);
    console.log(`   Collections: ${Object.keys(results.collections).join(', ')}`);
    console.log('   ✅ PASS');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 2: Stroke-based search
  console.log('\n📍 Test 2: Stroke-based search for "rocket"');
  try {
    const results = await searchStrokeBasedIcons('rocket', { limit: 10 });
    console.log(`   Found ${results.total} total icons in stroke-based sets`);
    console.log(`   Icons: ${results.icons.join(', ')}`);

    // Verify all results are from stroke-based collections
    const allStrokeBased = results.icons.every(id => {
      const prefix = id.split(':')[0];
      return STROKE_BASED_COLLECTIONS.includes(prefix);
    });
    console.log(`   All from stroke-based collections: ${allStrokeBased}`);
    console.log(allStrokeBased ? '   ✅ PASS' : '   ❌ FAIL');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 3: Get individual icon SVG
  console.log('\n📍 Test 3: Get SVG for "lucide:bike"');
  try {
    const svg = await getIconSvg('lucide', 'bike');
    if (svg) {
      console.log(`   SVG length: ${svg.length} chars`);
      console.log(`   Starts with: ${svg.substring(0, 80)}...`);

      // Check for stroke attributes
      const hasStroke = svg.includes('stroke=');
      const hasViewBox = svg.includes('viewBox');
      console.log(`   Has stroke attribute: ${hasStroke}`);
      console.log(`   Has viewBox: ${hasViewBox}`);
      console.log('   ✅ PASS');
    } else {
      console.log('   ❌ FAIL: SVG is null');
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 4: Get icon by full ID
  console.log('\n📍 Test 4: Get SVG by ID "tabler:arrow-right"');
  try {
    const svg = await getIconSvgById('tabler:arrow-right');
    if (svg) {
      console.log(`   SVG length: ${svg.length} chars`);
      console.log('   ✅ PASS');
    } else {
      console.log('   ❌ FAIL: SVG is null');
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 5: Get collection metadata
  console.log('\n📍 Test 5: Get collection metadata for "lucide"');
  try {
    const collection = await getCollection('lucide');
    if (collection) {
      console.log(`   Name: ${collection.name}`);
      console.log(`   Total icons: ${collection.total}`);
      console.log(`   License: ${collection.license?.title || 'unknown'}`);
      console.log(`   Samples: ${collection.samples?.slice(0, 5).join(', ')}`);
      console.log('   ✅ PASS');
    } else {
      console.log('   ❌ FAIL: Collection is null');
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 6: Get stroke-based collections
  console.log('\n📍 Test 6: Get stroke-based collections');
  try {
    const collections = await getCollections({ strokeBasedOnly: true });
    console.log(`   Found ${collections.length} stroke-based collections:`);
    for (const c of collections.slice(0, 5)) {
      console.log(`   - ${c.prefix}: ${c.name} (${c.total} icons)`);
    }
    console.log('   ✅ PASS');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 7: Get icon names in collection
  console.log('\n📍 Test 7: Get icon names in "feather" collection');
  try {
    const iconNames = await getCollectionIconNames('feather');
    console.log(`   Found ${iconNames.length} icons in feather`);
    console.log(`   Sample names: ${iconNames.slice(0, 10).join(', ')}`);
    console.log('   ✅ PASS');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 8: Search and get SVGs (convenience function)
  console.log('\n📍 Test 8: searchAndGetSvgs("heart")');
  try {
    const results = await searchAndGetSvgs('heart', { limit: 4 });
    console.log(`   Got ${results.length} icons with SVGs:`);
    for (const { iconId, svg } of results) {
      console.log(`   - ${iconId}: ${svg.length} chars`);
    }
    console.log('   ✅ PASS');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 9: Caching (second call should be faster)
  console.log('\n📍 Test 9: Caching verification');
  try {
    const start1 = Date.now();
    await searchIcons('star', { limit: 5 });
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await searchIcons('star', { limit: 5 });
    const time2 = Date.now() - start2;

    console.log(`   First call: ${time1}ms`);
    console.log(`   Second call (cached): ${time2}ms`);
    console.log(`   Cache working: ${time2 < time1 / 2}`);
    console.log(time2 < time1 / 2 ? '   ✅ PASS' : '   ⚠️ CACHE MAY NOT BE WORKING');
  } catch (error) {
    console.log(`   ❌ FAIL: ${error}`);
  }

  // Test 10: Non-existent icon (should return null, not throw)
  console.log('\n📍 Test 10: Non-existent icon handling');
  try {
    const svg = await getIconSvg('lucide', 'this-icon-does-not-exist-xyz');
    console.log(`   Result for non-existent icon: ${svg === null ? 'null' : 'some value'}`);
    console.log(svg === null ? '   ✅ PASS' : '   ❌ FAIL: Should return null');
  } catch (error) {
    console.log(`   ❌ FAIL: Should not throw, but did: ${error}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Tests complete!\n');
}

runTests().catch(console.error);
