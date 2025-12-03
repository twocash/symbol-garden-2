/**
 * Arc Fidelity Test - Sprint 11
 *
 * Tests the Sprout pipeline with the Heroicons rocket to identify
 * where arc command corruption occurs.
 */

// Source: Heroicons rocket-launch (fetched from Iconify API)
const SOURCE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.59 14.37q.159.666.16 1.38a6 6 0 0 1-6 6v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.9 14.9 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.9 14.9 0 0 0-2.58 5.84m2.699 2.7q-.155.032-.311.06a15 15 0 0 1-2.448-2.448l.06-.312m-2.24 2.39a4.49 4.49 0 0 0-1.757 4.306q.341.054.696.054a4.5 4.5 0 0 0 3.61-1.812M16.5 9a1.5 1.5 0 1 1-3 0a1.5 1.5 0 0 1 3 0"/></svg>`;

/**
 * Parse arc commands from a path d attribute
 * Arc format: A rx ry x-rotation large-arc-flag sweep-flag x y
 *
 * Handles ALL notation variants:
 * - Spaced: a6 6 0 0 1 -6 6
 * - Compact flags: a6 6 0 01-6 6 (flags 01 = large=0, sweep=1)
 * - Very compact: a22 22 0 012-3.9 (flags 01, then x=2)
 */
function parseArcs(d: string): Array<{
  command: string;
  rx: number;
  ry: number;
  rotation: number;
  largeArc: number;
  sweep: number;
  x: number;
  y: number;
  raw: string;
}> {
  const arcs: Array<{
    command: string;
    rx: number;
    ry: number;
    rotation: number;
    largeArc: number;
    sweep: number;
    x: number;
    y: number;
    raw: string;
  }> = [];

  // Find all arc commands
  const arcCommandRegex = /([Aa])([^AaMmZzLlHhVvCcSsQqTt]*)/g;
  let cmdMatch;

  while ((cmdMatch = arcCommandRegex.exec(d)) !== null) {
    const command = cmdMatch[1];
    const argsStr = cmdMatch[2];

    // Tokenize arc arguments properly
    const tokens: string[] = [];
    let pos = 0;
    let paramIndex = 0;

    while (pos < argsStr.length && tokens.length < 7) {
      // Skip whitespace and commas
      while (pos < argsStr.length && /[\s,]/.test(argsStr[pos])) pos++;
      if (pos >= argsStr.length) break;

      // Parameters 3 and 4 (0-indexed) are flags
      const isFlag = paramIndex === 3 || paramIndex === 4;

      if (isFlag && (argsStr[pos] === '0' || argsStr[pos] === '1')) {
        tokens.push(argsStr[pos]);
        pos++;
        paramIndex++;
        continue;
      }

      // Regular number
      const numMatch = argsStr.slice(pos).match(/^-?[\d.]+(?:[eE][+-]?\d+)?/);
      if (numMatch) {
        tokens.push(numMatch[0]);
        pos += numMatch[0].length;
        paramIndex++;
      } else {
        pos++;
      }
    }

    if (tokens.length >= 7) {
      arcs.push({
        command,
        rx: parseFloat(tokens[0]),
        ry: parseFloat(tokens[1]),
        rotation: parseFloat(tokens[2]),
        largeArc: parseInt(tokens[3]),
        sweep: parseInt(tokens[4]),
        x: parseFloat(tokens[5]),
        y: parseFloat(tokens[6]),
        raw: command + argsStr.substring(0, pos).trim(),
      });
    }
  }

  return arcs;
}

/**
 * Extract path d attribute from SVG
 */
function extractPathD(svg: string): string[] {
  const paths: string[] = [];
  const regex = /d="([^"]+)"/g;
  let match;
  while ((match = regex.exec(svg)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Test 1: Parse arcs from source SVG
 */
function testSourceArcs() {
  console.log('='.repeat(60));
  console.log('TEST 1: Parse arcs from source Heroicons rocket');
  console.log('='.repeat(60));

  const paths = extractPathD(SOURCE_SVG);
  console.log(`Found ${paths.length} path(s)\n`);

  for (const path of paths) {
    console.log('Path d:', path.substring(0, 100) + '...\n');

    const arcs = parseArcs(path);
    console.log(`Found ${arcs.length} arc command(s):\n`);

    for (const arc of arcs) {
      console.log(`  ${arc.command} rx=${arc.rx} ry=${arc.ry} rot=${arc.rotation} large=${arc.largeArc} sweep=${arc.sweep} x=${arc.x} y=${arc.y}`);
      console.log(`    Raw: "${arc.raw}"`);
    }
  }
}

/**
 * Test 2: Run through svg-optimizer and check arc preservation
 */
async function testOptimizer() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Token Optimizer arc preservation');
  console.log('='.repeat(60));

  const { optimizeSvgForLlm } = await import('../src/lib/svg-optimizer');

  const result = optimizeSvgForLlm(SOURCE_SVG);
  console.log(`\nOriginal: ${result.originalLength} chars`);
  console.log(`Optimized: ${result.optimizedLength} chars`);
  console.log(`ViewBox: ${result.viewBox}\n`);

  const sourcePaths = extractPathD(SOURCE_SVG);
  const optimizedPaths = extractPathD(result.optimized);

  console.log('Comparing arcs before/after optimization:\n');

  for (let i = 0; i < sourcePaths.length; i++) {
    const sourceArcs = parseArcs(sourcePaths[i]);
    const optArcs = parseArcs(optimizedPaths[i] || '');

    console.log(`Path ${i + 1}: ${sourceArcs.length} source arcs, ${optArcs.length} optimized arcs`);

    for (let j = 0; j < sourceArcs.length; j++) {
      const src = sourceArcs[j];
      const opt = optArcs[j];

      if (!opt) {
        console.log(`  ❌ Arc ${j + 1} MISSING after optimization!`);
        continue;
      }

      const flagsMatch = src.largeArc === opt.largeArc && src.sweep === opt.sweep;
      const radiusMatch = Math.abs(src.rx - opt.rx) < 0.5 && Math.abs(src.ry - opt.ry) < 0.5;

      if (flagsMatch && radiusMatch) {
        console.log(`  ✅ Arc ${j + 1} preserved`);
      } else {
        console.log(`  ❌ Arc ${j + 1} CORRUPTED:`);
        console.log(`     Source: large=${src.largeArc} sweep=${src.sweep} rx=${src.rx} ry=${src.ry}`);
        console.log(`     After:  large=${opt.largeArc} sweep=${opt.sweep} rx=${opt.rx} ry=${opt.ry}`);
      }
    }
  }

  console.log('\n--- Optimized SVG ---');
  console.log(result.optimized);
}

/**
 * Test 3: Test the NEW arc-aware rounding
 */
function testRounding() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Arc-aware coordinate rounding');
  console.log('='.repeat(60));

  const testCases = [
    { path: 'M10 10 a6 6 0 0 1-6 6', desc: 'Standard arc with negative coord' },
    { path: 'M5 5 a14.98 14.98 0 0 0 6.16-12.12', desc: 'Arc with decimals' },
    { path: 'M16.5 9 a1.5 1.5 0 1 1-3 0 a1.5 1.5 0 0 1 3 0', desc: 'Circle (two arcs)' },
    { path: 'M0 0 a22 22 0 012-3.9', desc: 'Compact: flags run together (0 01)' },
    { path: 'M0 0 a22 22 0 112-3.9', desc: 'Compact: both flags=1 (1 1)' },
    { path: 'M0 0 A5.5 5.5 45 1 0 10 10', desc: 'Absolute arc with rotation' },
  ];

  // Import and test the actual function
  // We'll inline the new implementation for testing
  function roundToDecimal(num: number, decimals: number): string {
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(num * factor) / factor;
    return rounded.toString();
  }

  function tokenizeArcArgs(args: string): Array<{ value: string; isFlag: boolean }> {
    const tokens: Array<{ value: string; isFlag: boolean }> = [];
    let pos = 0;
    let paramIndex = 0;

    while (pos < args.length) {
      while (pos < args.length && /[\s,]/.test(args[pos])) pos++;
      if (pos >= args.length) break;

      const isFlag = (paramIndex % 7 === 3) || (paramIndex % 7 === 4);

      if (isFlag) {
        if (args[pos] === '0' || args[pos] === '1') {
          tokens.push({ value: args[pos], isFlag: true });
          pos++;
          paramIndex++;
          continue;
        }
      }

      const numMatch = args.slice(pos).match(/^-?[\d.]+(?:[eE][+-]?\d+)?/);
      if (numMatch) {
        tokens.push({ value: numMatch[0], isFlag: false });
        pos += numMatch[0].length;
        paramIndex++;
      } else {
        pos++;
      }
    }
    return tokens;
  }

  function roundArcArguments(args: string, decimals: number): string {
    const tokens = tokenizeArcArgs(args);
    if (tokens.length === 0) return args;

    const result: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      if (i + 6 >= tokens.length) {
        result.push(...tokens.slice(i).map(t => t.value));
        break;
      }

      result.push(roundToDecimal(parseFloat(tokens[i].value), decimals));
      result.push(' ');
      result.push(roundToDecimal(parseFloat(tokens[i + 1].value), decimals));
      result.push(' ');
      result.push(roundToDecimal(parseFloat(tokens[i + 2].value), decimals));
      result.push(' ');

      const largeArc = tokens[i + 3].value === '1' ? '1' : '0';
      const sweep = tokens[i + 4].value === '1' ? '1' : '0';
      result.push(largeArc);
      result.push(' ');
      result.push(sweep);
      result.push(' ');

      result.push(roundToDecimal(parseFloat(tokens[i + 5].value), decimals));
      result.push(' ');
      result.push(roundToDecimal(parseFloat(tokens[i + 6].value), decimals));

      i += 7;
      if (i < tokens.length) result.push(' ');
    }

    return result.join('');
  }

  function roundPathCoordinates(pathData: string, decimals: number): string {
    const commandRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
    const result: string[] = [];
    let match;

    while ((match = commandRegex.exec(pathData)) !== null) {
      const cmd = match[1];
      const args = match[2].trim();

      if (cmd.toUpperCase() === 'Z') {
        result.push(cmd);
        continue;
      }

      if (cmd.toUpperCase() === 'A') {
        result.push(cmd + roundArcArguments(args, decimals));
      } else {
        const rounded = args.replace(/-?[\d.]+(?:[eE][+-]?\d+)?/g, (numStr) => {
          const num = parseFloat(numStr);
          return isNaN(num) ? numStr : roundToDecimal(num, decimals);
        });
        result.push(cmd + rounded);
      }
    }

    return result.join('');
  }

  console.log('\nTesting arc-aware roundPathCoordinates():\n');

  let allPassed = true;

  for (const { path, desc } of testCases) {
    console.log(`  ${desc}`);
    console.log(`  Input:  "${path}"`);

    const rounded = roundPathCoordinates(path, 1);
    console.log(`  Output: "${rounded}"`);

    // Parse and compare arcs
    const srcArcs = parseArcs(path);
    const dstArcs = parseArcs(rounded);

    if (srcArcs.length !== dstArcs.length) {
      console.log(`  ❌ ARC COUNT MISMATCH: ${srcArcs.length} → ${dstArcs.length}`);
      allPassed = false;
    } else {
      let passed = true;
      for (let j = 0; j < srcArcs.length; j++) {
        const src = srcArcs[j];
        const dst = dstArcs[j];
        if (src.largeArc !== dst.largeArc || src.sweep !== dst.sweep) {
          console.log(`  ❌ Arc ${j + 1} FLAGS CORRUPTED: large=${src.largeArc}→${dst.largeArc} sweep=${src.sweep}→${dst.sweep}`);
          passed = false;
          allPassed = false;
        }
      }
      if (passed) {
        console.log(`  ✅ All ${srcArcs.length} arc(s) preserved correctly`);
      }
    }
    console.log('');
  }

  console.log(allPassed ? '🎉 ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
}

// Run tests
async function main() {
  console.log('Arc Fidelity Test Suite - Sprint 11\n');

  testSourceArcs();
  testRounding();
  await testOptimizer();
}

main().catch(console.error);
