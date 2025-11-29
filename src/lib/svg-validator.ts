/**
 * SVG Validator - Validates and fixes generated SVG icons
 *
 * Primary focus: Coordinate validation for 24x24 viewBox icons
 * - Detects out-of-bounds coordinates
 * - Can auto-fix by scaling/translating to fit within bounds
 * - Validates SVG structure and style consistency
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  /** Fixed SVG if auto-fix was applied */
  fixedSvg?: string;
}

export interface ValidationError {
  type: 'out-of-bounds' | 'invalid-structure' | 'missing-element' | 'parse-error';
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  type: 'near-boundary' | 'unusual-size' | 'style-inconsistency';
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationOptions {
  /** ViewBox size (default: 24) */
  viewBoxSize?: number;
  /** Margin from edge to trigger warning (default: 1) */
  warningMargin?: number;
  /** Auto-fix out-of-bounds coordinates by scaling */
  autoFix?: boolean;
  /** Padding when auto-fixing (default: 2) */
  fixPadding?: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Extract all numeric coordinates from an SVG path d attribute
 */
function extractPathCoordinates(d: string): { x: number[]; y: number[] } {
  const xCoords: number[] = [];
  const yCoords: number[] = [];

  // Split into commands
  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

  let currentX = 0;
  let currentY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).match(/-?[\d.]+/g)?.map(Number) || [];

    const isRelative = type === type.toLowerCase();

    switch (type.toUpperCase()) {
      case 'M': // MoveTo
      case 'L': // LineTo
        for (let i = 0; i < nums.length; i += 2) {
          if (isRelative) {
            currentX += nums[i];
            currentY += nums[i + 1] || 0;
          } else {
            currentX = nums[i];
            currentY = nums[i + 1] || currentY;
          }
          xCoords.push(currentX);
          yCoords.push(currentY);
        }
        break;

      case 'H': // Horizontal line
        for (const n of nums) {
          currentX = isRelative ? currentX + n : n;
          xCoords.push(currentX);
          yCoords.push(currentY);
        }
        break;

      case 'V': // Vertical line
        for (const n of nums) {
          currentY = isRelative ? currentY + n : n;
          xCoords.push(currentX);
          yCoords.push(currentY);
        }
        break;

      case 'C': // Cubic bezier
        for (let i = 0; i < nums.length; i += 6) {
          if (isRelative) {
            xCoords.push(currentX + nums[i], currentX + nums[i + 2], currentX + nums[i + 4]);
            yCoords.push(currentY + nums[i + 1], currentY + nums[i + 3], currentY + nums[i + 5]);
            currentX += nums[i + 4];
            currentY += nums[i + 5];
          } else {
            xCoords.push(nums[i], nums[i + 2], nums[i + 4]);
            yCoords.push(nums[i + 1], nums[i + 3], nums[i + 5]);
            currentX = nums[i + 4];
            currentY = nums[i + 5];
          }
        }
        break;

      case 'S': // Smooth cubic bezier
        for (let i = 0; i < nums.length; i += 4) {
          if (isRelative) {
            xCoords.push(currentX + nums[i], currentX + nums[i + 2]);
            yCoords.push(currentY + nums[i + 1], currentY + nums[i + 3]);
            currentX += nums[i + 2];
            currentY += nums[i + 3];
          } else {
            xCoords.push(nums[i], nums[i + 2]);
            yCoords.push(nums[i + 1], nums[i + 3]);
            currentX = nums[i + 2];
            currentY = nums[i + 3];
          }
        }
        break;

      case 'Q': // Quadratic bezier
        for (let i = 0; i < nums.length; i += 4) {
          if (isRelative) {
            xCoords.push(currentX + nums[i], currentX + nums[i + 2]);
            yCoords.push(currentY + nums[i + 1], currentY + nums[i + 3]);
            currentX += nums[i + 2];
            currentY += nums[i + 3];
          } else {
            xCoords.push(nums[i], nums[i + 2]);
            yCoords.push(nums[i + 1], nums[i + 3]);
            currentX = nums[i + 2];
            currentY = nums[i + 3];
          }
        }
        break;

      case 'T': // Smooth quadratic bezier
        for (let i = 0; i < nums.length; i += 2) {
          if (isRelative) {
            currentX += nums[i];
            currentY += nums[i + 1];
          } else {
            currentX = nums[i];
            currentY = nums[i + 1];
          }
          xCoords.push(currentX);
          yCoords.push(currentY);
        }
        break;

      case 'A': // Arc
        for (let i = 0; i < nums.length; i += 7) {
          if (isRelative) {
            currentX += nums[i + 5];
            currentY += nums[i + 6];
          } else {
            currentX = nums[i + 5];
            currentY = nums[i + 6];
          }
          xCoords.push(currentX);
          yCoords.push(currentY);
        }
        break;

      case 'Z': // Close path
        // No coordinates
        break;
    }
  }

  return { x: xCoords, y: yCoords };
}

/**
 * Extract coordinates from circle element
 */
function extractCircleCoordinates(element: string): { x: number[]; y: number[] } {
  const cxMatch = element.match(/cx\s*=\s*['"]?(-?[\d.]+)/);
  const cyMatch = element.match(/cy\s*=\s*['"]?(-?[\d.]+)/);
  const rMatch = element.match(/r\s*=\s*['"]?(-?[\d.]+)/);

  if (!cxMatch || !cyMatch || !rMatch) return { x: [], y: [] };

  const cx = parseFloat(cxMatch[1]);
  const cy = parseFloat(cyMatch[1]);
  const r = parseFloat(rMatch[1]);

  return {
    x: [cx - r, cx + r],
    y: [cy - r, cy + r],
  };
}

/**
 * Extract coordinates from rect element
 */
function extractRectCoordinates(element: string): { x: number[]; y: number[] } {
  const xMatch = element.match(/\bx\s*=\s*['"]?(-?[\d.]+)/);
  const yMatch = element.match(/\by\s*=\s*['"]?(-?[\d.]+)/);
  const wMatch = element.match(/width\s*=\s*['"]?(-?[\d.]+)/);
  const hMatch = element.match(/height\s*=\s*['"]?(-?[\d.]+)/);

  const x = xMatch ? parseFloat(xMatch[1]) : 0;
  const y = yMatch ? parseFloat(yMatch[1]) : 0;
  const w = wMatch ? parseFloat(wMatch[1]) : 0;
  const h = hMatch ? parseFloat(hMatch[1]) : 0;

  return {
    x: [x, x + w],
    y: [y, y + h],
  };
}

/**
 * Extract coordinates from line element
 */
function extractLineCoordinates(element: string): { x: number[]; y: number[] } {
  const x1Match = element.match(/x1\s*=\s*['"]?(-?[\d.]+)/);
  const y1Match = element.match(/y1\s*=\s*['"]?(-?[\d.]+)/);
  const x2Match = element.match(/x2\s*=\s*['"]?(-?[\d.]+)/);
  const y2Match = element.match(/y2\s*=\s*['"]?(-?[\d.]+)/);

  const x: number[] = [];
  const y: number[] = [];

  if (x1Match) x.push(parseFloat(x1Match[1]));
  if (x2Match) x.push(parseFloat(x2Match[1]));
  if (y1Match) y.push(parseFloat(y1Match[1]));
  if (y2Match) y.push(parseFloat(y2Match[1]));

  return { x, y };
}

/**
 * Get bounding box of all elements in an SVG
 */
function getSvgBoundingBox(svg: string): BoundingBox {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (coords: { x: number[]; y: number[] }) => {
    for (const x of coords.x) {
      if (isFinite(x)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    }
    for (const y of coords.y) {
      if (isFinite(y)) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  };

  // Extract path elements
  const pathMatches = svg.matchAll(/<path[^>]*d\s*=\s*["']([^"']+)["'][^>]*\/?>/g);
  for (const match of pathMatches) {
    updateBounds(extractPathCoordinates(match[1]));
  }

  // Extract circle elements
  const circleMatches = svg.matchAll(/<circle[^>]*\/?>/g);
  for (const match of circleMatches) {
    updateBounds(extractCircleCoordinates(match[0]));
  }

  // Extract rect elements
  const rectMatches = svg.matchAll(/<rect[^>]*\/?>/g);
  for (const match of rectMatches) {
    updateBounds(extractRectCoordinates(match[0]));
  }

  // Extract line elements
  const lineMatches = svg.matchAll(/<line[^>]*\/?>/g);
  for (const match of lineMatches) {
    updateBounds(extractLineCoordinates(match[0]));
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Scale and translate SVG to fit within bounds
 */
function fixSvgBounds(svg: string, bounds: BoundingBox, options: ValidationOptions): string {
  const viewBoxSize = options.viewBoxSize || 24;
  const padding = options.fixPadding || 2;

  const currentWidth = bounds.maxX - bounds.minX;
  const currentHeight = bounds.maxY - bounds.minY;

  const targetSize = viewBoxSize - (padding * 2);
  const scale = Math.min(targetSize / currentWidth, targetSize / currentHeight);

  // Calculate translation to center after scaling
  const scaledWidth = currentWidth * scale;
  const scaledHeight = currentHeight * scale;
  const translateX = padding + (targetSize - scaledWidth) / 2 - bounds.minX * scale;
  const translateY = padding + (targetSize - scaledHeight) / 2 - bounds.minY * scale;

  // Apply transform via group wrapper
  const svgContent = svg.replace(/<svg[^>]*>/, (match) => {
    return `${match}\n  <g transform="translate(${translateX.toFixed(2)}, ${translateY.toFixed(2)}) scale(${scale.toFixed(4)})">`;
  }).replace(/<\/svg>/, '  </g>\n</svg>');

  return svgContent;
}

/**
 * Validate an SVG icon
 */
export function validateSvg(svg: string, options: ValidationOptions = {}): ValidationResult {
  const viewBoxSize = options.viewBoxSize || 24;
  const warningMargin = options.warningMargin || 1;

  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check basic structure
  if (!svg.includes('<svg')) {
    errors.push({
      type: 'invalid-structure',
      message: 'SVG must contain <svg> element',
    });
    return { isValid: false, errors, warnings };
  }

  if (!svg.includes('</svg>')) {
    errors.push({
      type: 'invalid-structure',
      message: 'SVG must have closing </svg> tag',
    });
    return { isValid: false, errors, warnings };
  }

  // Check for content elements
  const hasContent = /<(path|circle|rect|line|polyline|polygon|ellipse)[^>]*/.test(svg);
  if (!hasContent) {
    errors.push({
      type: 'missing-element',
      message: 'SVG must contain at least one drawing element (path, circle, rect, etc.)',
    });
    return { isValid: false, errors, warnings };
  }

  // Check viewBox
  const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (!viewBoxMatch) {
    warnings.push({
      type: 'style-inconsistency',
      message: 'SVG should have a viewBox attribute',
    });
  } else {
    const viewBox = viewBoxMatch[1].split(/\s+/).map(Number);
    if (viewBox.length !== 4 || viewBox[2] !== viewBoxSize || viewBox[3] !== viewBoxSize) {
      warnings.push({
        type: 'style-inconsistency',
        message: `ViewBox should be "0 0 ${viewBoxSize} ${viewBoxSize}"`,
        details: { actualViewBox: viewBoxMatch[1] },
      });
    }
  }

  // Get bounding box
  const bounds = getSvgBoundingBox(svg);

  // Check for out-of-bounds coordinates
  const outOfBounds: string[] = [];
  if (bounds.minX < 0) outOfBounds.push(`minX=${bounds.minX.toFixed(1)}`);
  if (bounds.minY < 0) outOfBounds.push(`minY=${bounds.minY.toFixed(1)}`);
  if (bounds.maxX > viewBoxSize) outOfBounds.push(`maxX=${bounds.maxX.toFixed(1)}`);
  if (bounds.maxY > viewBoxSize) outOfBounds.push(`maxY=${bounds.maxY.toFixed(1)}`);

  if (outOfBounds.length > 0) {
    errors.push({
      type: 'out-of-bounds',
      message: `Coordinates exceed ${viewBoxSize}x${viewBoxSize} bounds: ${outOfBounds.join(', ')}`,
      details: { bounds },
    });
  }

  // Check for near-boundary warnings
  const nearBoundary: string[] = [];
  if (bounds.minX >= 0 && bounds.minX < warningMargin) nearBoundary.push('left');
  if (bounds.minY >= 0 && bounds.minY < warningMargin) nearBoundary.push('top');
  if (bounds.maxX <= viewBoxSize && bounds.maxX > viewBoxSize - warningMargin) nearBoundary.push('right');
  if (bounds.maxY <= viewBoxSize && bounds.maxY > viewBoxSize - warningMargin) nearBoundary.push('bottom');

  if (nearBoundary.length > 0) {
    warnings.push({
      type: 'near-boundary',
      message: `Icon is very close to ${nearBoundary.join(', ')} edge(s)`,
      details: { bounds },
    });
  }

  // Auto-fix if requested
  let fixedSvg: string | undefined;
  if (options.autoFix && outOfBounds.length > 0) {
    fixedSvg = fixSvgBounds(svg, bounds, options);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fixedSvg,
  };
}

/**
 * Quick check if SVG coordinates are within bounds
 */
export function isWithinBounds(svg: string, viewBoxSize: number = 24): boolean {
  const bounds = getSvgBoundingBox(svg);
  return (
    bounds.minX >= 0 &&
    bounds.minY >= 0 &&
    bounds.maxX <= viewBoxSize &&
    bounds.maxY <= viewBoxSize
  );
}

/**
 * Get the bounding box of an SVG
 */
export function getBoundingBox(svg: string): BoundingBox {
  return getSvgBoundingBox(svg);
}

/**
 * Ensure all shape elements have fill="none" explicitly set
 * This prevents filled shapes when SVG is rendered (fill doesn't inherit from parent)
 */
export function ensureStrokeOnly(svg: string): string {
  // Elements that need fill="none" for stroke-only rendering
  const shapeElements = ['path', 'circle', 'rect', 'ellipse', 'polygon', 'polyline', 'line'];

  let result = svg;

  for (const element of shapeElements) {
    // Match elements that don't already have fill="none"
    const regex = new RegExp(`<${element}([^>]*?)(/?)>`, 'g');

    result = result.replace(regex, (match, attrs, selfClose) => {
      // Check if already has fill="none"
      if (/fill\s*=\s*["']none["']/.test(attrs)) {
        return match;
      }

      // Check if has any fill attribute (might be fill="something")
      if (/fill\s*=/.test(attrs)) {
        // Replace existing fill with none
        const newAttrs = attrs.replace(/fill\s*=\s*["'][^"']*["']/, 'fill="none"');
        return `<${element}${newAttrs}${selfClose}>`;
      }

      // Add fill="none"
      return `<${element}${attrs} fill="none"${selfClose}>`;
    });
  }

  return result;
}

/**
 * Normalize SVG to Feather-style format
 * - Ensures stroke-only rendering
 * - Cleans up formatting
 */
export function normalizeSvg(svg: string): string {
  // Ensure all elements have fill="none"
  let result = ensureStrokeOnly(svg);

  // Ensure root SVG has fill="none" if not present
  if (!/<svg[^>]*fill\s*=/.test(result)) {
    result = result.replace(/<svg/, '<svg fill="none"');
  }

  return result;
}

/**
 * Format validation result for logging
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.isValid) {
    lines.push('✅ SVG is valid');
  } else {
    lines.push('❌ SVG validation failed');
  }

  for (const error of result.errors) {
    lines.push(`  ERROR [${error.type}]: ${error.message}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  WARN [${warning.type}]: ${warning.message}`);
  }

  if (result.fixedSvg) {
    lines.push('  → Auto-fix applied');
  }

  return lines.join('\n');
}
