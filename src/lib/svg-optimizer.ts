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
 * Round all coordinates in a path d attribute
 * Handles: M, m, L, l, H, h, V, v, C, c, S, s, Q, q, T, t, A, a, Z, z
 */
function roundPathCoordinates(pathData: string, decimals: number): string {
  // Match numbers (including negative and decimals)
  return pathData.replace(/-?\d+\.?\d*/g, (match) => {
    const num = parseFloat(match);
    if (!isNaN(num)) {
      return roundToDecimal(num, decimals);
    }
    return match;
  });
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
