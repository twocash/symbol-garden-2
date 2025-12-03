import { optimize } from 'svgo';

/**
 * Optimize SVG for LLM consumption (Token Optimizer)
 * Sprint 10-A: Reduces token count while preserving semantic structure
 *
 * - Rounds coordinates to 1 decimal place
 * - Removes metadata (title, desc, id, class)
 * - Strips comments and unnecessary whitespace
 * - Preserves multi-path structure for semantic clarity
 */
export function optimizeSvgForLlm(svgContent: string): {
  optimized: string;
  viewBox: string;
  originalLength: number;
  optimizedLength: number;
} {
  const originalLength = svgContent.length;

  // Extract viewBox before processing
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  let svg = svgContent;

  // Remove XML declaration if present
  svg = svg.replace(/<\?xml[^?]*\?>/g, '');

  // Remove comments
  svg = svg.replace(/<!--[\s\S]*?-->/g, '');

  // Remove metadata elements
  svg = svg.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
  svg = svg.replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '');
  svg = svg.replace(/<metadata[^>]*>[\s\S]*?<\/metadata>/gi, '');
  svg = svg.replace(/<defs[^>]*>[\s\S]*?<\/defs>/gi, '');

  // Remove id attributes (not needed for transpilation)
  svg = svg.replace(/\s+id="[^"]*"/g, '');

  // Remove class attributes
  svg = svg.replace(/\s+class="[^"]*"/g, '');

  // Remove data-* attributes
  svg = svg.replace(/\s+data-[a-z-]+="[^"]*"/g, '');

  // Remove style attributes (we'll apply target style)
  svg = svg.replace(/\s+style="[^"]*"/g, '');

  // Round coordinates in path d attributes to 1 decimal place
  svg = svg.replace(/d="([^"]+)"/g, (match, pathData) => {
    const rounded = roundPathCoordinates(pathData, 1);
    return `d="${rounded}"`;
  });

  // Round numeric attributes (cx, cy, r, x, y, width, height, etc.)
  svg = svg.replace(/(\s(?:cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|width|height))="([^"]+)"/g,
    (match, attr, value) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return `${attr}="${roundToDecimal(num, 1)}"`;
      }
      return match;
    }
  );

  // Collapse whitespace
  svg = svg.replace(/\s+/g, ' ').trim();

  // Clean up spaces around tags
  svg = svg.replace(/>\s+</g, '><');
  svg = svg.replace(/\s+>/g, '>');
  svg = svg.replace(/<\s+/g, '<');

  return {
    optimized: svg,
    viewBox,
    originalLength,
    optimizedLength: svg.length,
  };
}

/**
 * Round a number to specified decimal places
 */
function roundToDecimal(num: number, decimals: number): string {
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(num * factor) / factor;
  // Remove trailing zeros after decimal point
  return rounded.toString();
}

/**
 * Round all coordinates in a path d attribute (Arc-Aware)
 *
 * CRITICAL: Arc commands have a special format where flags (0 or 1) must NOT be rounded.
 * Arc format: A rx ry x-rotation large-arc-flag sweep-flag x y
 *
 * Compact notation example: "a22 22 0 012-3.9" means:
 *   rx=22, ry=22, rotation=0, large-arc=0, sweep=1, x=2, y=-3.9
 *
 * The naive regex /-?\d+\.?\d/g would see "012" as the number 12, corrupting the flags.
 * This function parses commands properly to preserve arc flag semantics.
 */
function roundPathCoordinates(pathData: string, decimals: number): string {
  // Split into commands - each starts with a letter
  const commandRegex = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;
  const result: string[] = [];
  let match;

  while ((match = commandRegex.exec(pathData)) !== null) {
    const cmd = match[1];
    const args = match[2].trim();

    if (cmd.toUpperCase() === 'Z') {
      // Z has no arguments
      result.push(cmd);
      continue;
    }

    if (cmd.toUpperCase() === 'A') {
      // Arc command needs special handling to preserve flags
      result.push(cmd + roundArcArguments(args, decimals));
    } else {
      // All other commands: just round all numbers
      const rounded = args.replace(/-?[\d.]+(?:[eE][+-]?\d+)?/g, (numStr) => {
        const num = parseFloat(numStr);
        return isNaN(num) ? numStr : roundToDecimal(num, decimals);
      });
      result.push(cmd + rounded);
    }
  }

  return result.join('');
}

/**
 * Round arc command arguments while preserving flags
 *
 * Arc: rx ry x-rotation large-arc-flag sweep-flag x y
 * - rx, ry: radii (round these)
 * - x-rotation: angle in degrees (round this)
 * - large-arc-flag: MUST be 0 or 1 (preserve exactly)
 * - sweep-flag: MUST be 0 or 1 (preserve exactly)
 * - x, y: endpoint (round these)
 *
 * Handles compact notation where flags run together: "0 012-3.9"
 * means rotation=0, large-arc=0, sweep=1, x=2, y=-3.9
 */
function roundArcArguments(args: string, decimals: number): string {
  // Tokenize: we need to extract numbers while being aware of arc structure
  // Arc has 7 parameters per arc command, and multiple arcs can be chained

  const tokens = tokenizeArcArgs(args);
  if (tokens.length === 0) return args;

  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    // Need at least 7 tokens for one arc
    if (i + 6 >= tokens.length) {
      // Not enough for a full arc, just append remaining as-is
      result.push(...tokens.slice(i).map(t => t.value));
      break;
    }

    // rx, ry, rotation - round these
    result.push(roundToDecimal(parseFloat(tokens[i].value), decimals));
    result.push(' ');
    result.push(roundToDecimal(parseFloat(tokens[i + 1].value), decimals));
    result.push(' ');
    result.push(roundToDecimal(parseFloat(tokens[i + 2].value), decimals));
    result.push(' ');

    // large-arc-flag, sweep-flag - preserve exactly as 0 or 1
    const largeArc = tokens[i + 3].value === '1' ? '1' : '0';
    const sweep = tokens[i + 4].value === '1' ? '1' : '0';
    result.push(largeArc);
    result.push(' ');
    result.push(sweep);
    result.push(' ');

    // x, y - round these
    result.push(roundToDecimal(parseFloat(tokens[i + 5].value), decimals));
    result.push(' ');
    result.push(roundToDecimal(parseFloat(tokens[i + 6].value), decimals));

    i += 7;

    // Add space before next arc if there is one
    if (i < tokens.length) {
      result.push(' ');
    }
  }

  return result.join('');
}

/**
 * Tokenize arc arguments, handling compact notation
 *
 * Compact notation challenges:
 * - "0 012-3.9" = [0, 0, 1, 2, -3.9] (flags 0,1 followed by coords 2,-3.9)
 * - Flags are always single digits (0 or 1)
 * - After rotation, next two single digits are flags
 */
function tokenizeArcArgs(args: string): Array<{ value: string; isFlag: boolean }> {
  const tokens: Array<{ value: string; isFlag: boolean }> = [];
  let pos = 0;
  let paramIndex = 0; // 0-6 for each arc (rx,ry,rot,large,sweep,x,y)

  while (pos < args.length) {
    // Skip whitespace and commas
    while (pos < args.length && /[\s,]/.test(args[pos])) {
      pos++;
    }
    if (pos >= args.length) break;

    // Parameters 3 and 4 (indices 3,4 within each 7-param arc) are flags
    const isFlag = (paramIndex % 7 === 3) || (paramIndex % 7 === 4);

    if (isFlag) {
      // Flag: must be exactly '0' or '1'
      if (args[pos] === '0' || args[pos] === '1') {
        tokens.push({ value: args[pos], isFlag: true });
        pos++;
        paramIndex++;
        continue;
      }
    }

    // Regular number: capture until next separator, command, or flag position
    const numMatch = args.slice(pos).match(/^-?[\d.]+(?:[eE][+-]?\d+)?/);
    if (numMatch) {
      tokens.push({ value: numMatch[0], isFlag: false });
      pos += numMatch[0].length;
      paramIndex++;
    } else {
      // Unexpected character, skip
      pos++;
    }
  }

  return tokens;
}

/**
 * Extract the inner content of an SVG (everything between <svg> and </svg>)
 * Useful for sending just the paths/shapes to the LLM
 */
export function extractSvgInnerContent(svgString: string): string {
  const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match ? match[1].trim() : '';
}

export async function optimizeSvg(
    svgString: string,
    targetGridSize: number = 24,
    floatPrecision: number = 1
): Promise<string> {
    try {
        const result = optimize(svgString, {
            multipass: true,
            floatPrecision: floatPrecision, // Use the passed precision (default 1)
            plugins: [
                {
                    name: 'preset-default',
                    params: {
                        overrides: {
                            removeViewBox: false, // Keep the viewBox!
                        },
                    },
                } as any,
                {
                    name: 'convertPathData',
                    params: {
                        floatPrecision: floatPrecision, // Rounds coordinates to 1 decimal place (Grid Snap effect)
                        transformPrecision: floatPrecision,
                        makeArcs: undefined,
                        noSpaceAfterFlags: undefined,
                    }
                },
                {
                    name: 'addAttributesToSVGElement',
                    params: {
                        attributes: [
                            { viewBox: `0 0 ${targetGridSize} ${targetGridSize}` },
                            { width: "256" },
                            { height: "256" }
                        ]
                    }
                }
            ],
        });

        if ('data' in result) {
            return result.data;
        }
        return svgString; // Fallback to original if optimization fails
    } catch (error) {
        console.error('[SVG Optimizer] Warning:', error);
        return svgString;
    }
}
