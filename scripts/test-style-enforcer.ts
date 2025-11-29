/**
 * Test script for the Style Enforcer (F1: Forgery Engine)
 * 
 * Run with: npx tsx scripts/test-style-enforcer.ts
 */

import { enforceStyle, rulesFromStyleDNA, formatComplianceResult, FEATHER_RULES, EnforcementRules } from '../src/lib/style-enforcer';
import { StyleSpec } from '../src/lib/svg-prompt-builder';

// Test cases
const testCases = [
  {
    name: 'SVG with wrong stroke-width',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    </svg>`,
    expected: { strokeWidth: 2 },
  },
  {
    name: 'SVG with wrong linecap (butt instead of round)',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt">
      <path d="M12 2L12 22"/>
    </svg>`,
    expected: { linecap: 'round' },
  },
  {
    name: 'SVG missing fill="none" on elements',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2L12 22"/>
    </svg>`,
    expected: { fillNone: true },
  },
  {
    name: 'SVG with fill on path (should be none)',
    svg: `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor"/>
    </svg>`,
    expected: { fillNone: true },
  },
  {
    name: 'Perfect SVG (should pass)',
    svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" fill="none"/>
      <path d="M12 2L12 22" fill="none"/>
    </svg>`,
    expected: { perfect: true },
  },
  {
    name: 'SVG with multiple issues',
    svg: `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1" stroke-linecap="butt" stroke-linejoin="miter">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <circle cx="12" cy="12" r="5"/>
    </svg>`,
    expected: { multipleIssues: true },
  },
];

console.log('=== Style Enforcer Test Suite ===\n');

for (const test of testCases) {
  console.log(`\n📋 Test: ${test.name}`);
  console.log('─'.repeat(50));
  
  const result = enforceStyle(test.svg, FEATHER_RULES);
  console.log(formatComplianceResult(result));
  
  // Show the fixed SVG if there were changes
  if (result.changes.length > 0) {
    console.log('\n📝 Fixed SVG (first 200 chars):');
    console.log(result.autoFixed.substring(0, 200) + '...');
  }
}

// Test with custom rules from StyleSpec
console.log('\n\n=== Custom Rules Test (Tabler-style) ===');
const tablerStyle: StyleSpec = {
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  viewBoxSize: 24,
};

const tablerRules = rulesFromStyleDNA(tablerStyle);
console.log('\nRules from StyleSpec:', JSON.stringify(tablerRules, null, 2));

const testSvg = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt">
  <path d="M5 12H19M12 5L19 12L12 19"/>
</svg>`;

const tablerResult = enforceStyle(testSvg, tablerRules);
console.log('\n' + formatComplianceResult(tablerResult));

console.log('\n=== All Tests Complete ===');
