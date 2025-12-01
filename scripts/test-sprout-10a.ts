/**
 * Test script for Sprint 10-A: The Sprout Engine
 *
 * Run with: npx tsx scripts/test-sprout-10a.ts
 *
 * Tests:
 * 1. Token Optimizer - reduces SVG size for LLM
 * 2. Sprout Service - transpiles complex multi-path icons
 * 3. Style manifest integration
 *
 * Pass Criteria:
 * - Output SVG must be on 24x24 viewBox
 * - Use strictly 2px strokes (no fills for stroke-based)
 * - Look like the input concept
 */

import { optimizeSvgForLlm, extractSvgInnerContent } from '../src/lib/svg-optimizer';
import { sproutIcon, SproutConfig } from '../src/lib/sprout-service';

// Complex multi-path test icons from various libraries
const testCases = [
  {
    name: 'Material Design Pause (2 bars)',
    concept: 'pause',
    // Material Design pause icon - two vertical bars
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>`,
  },
  {
    name: 'Tabler User with Settings Gear',
    concept: 'user-cog',
    // Complex compound icon
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/>
      <path d="M6 21v-2a4 4 0 0 1 4 -4h2.5"/>
      <path d="M19.001 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>
      <path d="M19.001 15.5v1.5"/>
      <path d="M19.001 21v1.5"/>
      <path d="M22.032 17.25l-1.299 .75"/>
      <path d="M17.27 20l-1.3 .75"/>
      <path d="M15.97 17.25l1.3 .75"/>
      <path d="M20.733 20l1.3 .75"/>
    </svg>`,
  },
  {
    name: 'FontAwesome Brain (single complex path)',
    concept: 'brain',
    // Highly detailed single path
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
      <path d="M184 0c30.9 0 56 25.1 56 56V456c0 30.9-25.1 56-56 56c-28.9 0-52.7-21.9-55.7-50.1c-5.2 1.4-10.7 2.1-16.3 2.1c-35.3 0-64-28.7-64-64c0-7.4 1.3-14.6 3.6-21.2C21.4 367.4 0 338.2 0 304c0-31.9 18.7-59.5 45.8-72.3C37.1 220.8 32 207 32 192c0-30.7 21.6-56.3 50.4-62.6C80.8 123.9 80 118 80 112c0-29.9 20.6-55.1 48.3-62.1C131.3 21.9 155.1 0 184 0zM328 0c28.9 0 52.6 21.9 55.7 49.9c27.8 7 48.3 32.1 48.3 62.1c0 6-.8 11.9-2.4 17.4c28.8 6.2 50.4 31.9 50.4 62.6c0 15-5.1 28.8-13.8 39.7C493.3 244.5 512 272.1 512 304c0 34.2-21.4 63.4-51.6 74.8c2.3 6.6 3.6 13.8 3.6 21.2c0 35.3-28.7 64-64 64c-5.6 0-11.1-.7-16.3-2.1c-3 28.2-26.8 50.1-55.7 50.1c-30.9 0-56-25.1-56-56V56c0-30.9 25.1-56 56-56z"/>
    </svg>`,
  },
  {
    name: 'Lucide Mail (envelope shape)',
    concept: 'mail',
    // Simple multi-element icon
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>`,
  },
];

// Feather-style manifest (target style)
const featherManifest = `
# Feather Icons Style DNA

## Grid System
- viewBox: 0 0 24 24
- Content area: 2-22 (2px padding on all sides)

## Stroke Architecture
- stroke-width: 2
- stroke-linecap: round
- stroke-linejoin: round
- stroke: currentColor

## Fill Policy
- fill: none (stroke-only design)
- No solid fills, only outlines

## Corner Treatment
- All corners rounded (via linecap/linejoin)
- No sharp corners unless semantically required (e.g., square icon)

## Visual Weight
- Consistent 2px line weight throughout
- Optical adjustments for balance
`;

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Sprint 10-A: The Sprout Engine - Test Suite');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Test 1: Token Optimizer
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Test 1: Token Optimizer                                     │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  for (const test of testCases) {
    const result = optimizeSvgForLlm(test.svg);
    const savings = ((result.originalLength - result.optimizedLength) / result.originalLength * 100).toFixed(1);
    console.log(`${test.name}:`);
    console.log(`  Original: ${result.originalLength} chars`);
    console.log(`  Optimized: ${result.optimizedLength} chars`);
    console.log(`  Savings: ${savings}%`);
    console.log(`  ViewBox: ${result.viewBox}`);
    console.log('');
  }

  // Test 2: Sprout Service (requires API key)
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  GOOGLE_API_KEY not set - skipping Sprout Service tests');
    console.log('   Set the environment variable to run full tests.\n');
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Test 2: Sprout Service (LLM Transpilation)                 │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  // Test with one complex icon
  const testIcon = testCases[1]; // User with Gear
  console.log(`Testing: ${testIcon.name}`);
  console.log(`Concept: ${testIcon.concept}`);
  console.log('─'.repeat(60));

  const config: SproutConfig = {
    sourceSvg: testIcon.svg,
    styleManifest: featherManifest,
    conceptName: testIcon.concept,
    apiKey,
  };

  try {
    const result = await sproutIcon(config);

    if (result.success) {
      console.log('\n✅ SUCCESS');
      console.log(`Processing time: ${result.metadata.processingTimeMs}ms`);
      console.log(`Tokens saved: ${result.metadata.tokensSaved}`);
      console.log(`Iron Dome modified: ${result.metadata.ironDomeModified}`);
      console.log(`Compliance score: ${result.metadata.complianceScore}/100`);
      console.log('\n📝 Output SVG:');
      console.log('─'.repeat(60));
      console.log(result.svg);
      console.log('─'.repeat(60));

      // Validation checks
      console.log('\n🔍 Validation:');
      const hasCorrectViewBox = result.svg.includes('viewBox="0 0 24 24"');
      const hasStroke2 = result.svg.includes('stroke-width="2"');
      const hasFillNone = result.svg.includes('fill="none"');
      const hasPath = result.svg.includes('<path');
      const noTransform = !result.svg.includes('transform=');

      console.log(`  ✓ viewBox="0 0 24 24": ${hasCorrectViewBox ? '✅' : '❌'}`);
      console.log(`  ✓ stroke-width="2": ${hasStroke2 ? '✅' : '❌'}`);
      console.log(`  ✓ fill="none": ${hasFillNone ? '✅' : '❌'}`);
      console.log(`  ✓ Has path elements: ${hasPath ? '✅' : '❌'}`);
      console.log(`  ✓ No transforms: ${noTransform ? '✅' : '❌'}`);

    } else {
      console.log('\n❌ FAILED');
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('Test error:', error);
  }

  // Test 3: Quick test with simpler icon
  console.log('\n\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Test 3: Simple Icon (Mail)                                  │');
  console.log('└─────────────────────────────────────────────────────────────┘\n');

  const mailIcon = testCases[3];
  console.log(`Testing: ${mailIcon.name}`);

  try {
    const result = await sproutIcon({
      sourceSvg: mailIcon.svg,
      styleManifest: featherManifest,
      conceptName: mailIcon.concept,
      apiKey,
    });

    if (result.success) {
      console.log('✅ SUCCESS');
      console.log(`Time: ${result.metadata.processingTimeMs}ms`);
      console.log('\nOutput:');
      console.log(result.svg);
    } else {
      console.log('❌ FAILED:', result.error);
    }

  } catch (error) {
    console.error('Test error:', error);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Tests Complete');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run
runTests().catch(console.error);
