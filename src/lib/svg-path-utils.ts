/**
 * SVG Path Utilities - Client-safe utilities for SVG path manipulation
 *
 * These functions convert SVG primitives (circle, rect, line, etc.) to path data.
 * Safe to use in both client and server components.
 */

/**
 * Convert a circle element to path data
 * Circle: M cx-r,cy a r,r 0 1,0 2r,0 a r,r 0 1,0 -2r,0
 */
function circleToPath(cx: number, cy: number, r: number): string {
  return `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
}

/**
 * Convert an ellipse element to path data
 */
function ellipseToPath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx},${cy}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0`;
}

/**
 * Convert a rect element to path data
 * Handles rounded corners (rx, ry)
 */
function rectToPath(x: number, y: number, width: number, height: number, rx = 0, ry = 0): string {
  // Use ry if rx is 0
  rx = rx || ry;
  ry = ry || rx;

  // Clamp radius to half width/height
  rx = Math.min(rx, width / 2);
  ry = Math.min(ry, height / 2);

  if (rx === 0 && ry === 0) {
    // Simple rectangle without rounded corners
    return `M${x},${y}h${width}v${height}h${-width}z`;
  }

  // Rectangle with rounded corners
  return `M${x + rx},${y}` +
    `h${width - 2 * rx}` +
    `a${rx},${ry} 0 0 1 ${rx},${ry}` +
    `v${height - 2 * ry}` +
    `a${rx},${ry} 0 0 1 ${-rx},${ry}` +
    `h${-(width - 2 * rx)}` +
    `a${rx},${ry} 0 0 1 ${-rx},${-ry}` +
    `v${-(height - 2 * ry)}` +
    `a${rx},${ry} 0 0 1 ${rx},${-ry}z`;
}

/**
 * Convert a line element to path data
 */
function lineToPath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${x1},${y1}L${x2},${y2}`;
}

/**
 * Convert a polyline element to path data
 */
function polylineToPath(points: string): string {
  const coords = points.trim().split(/[\s,]+/).map(Number);
  if (coords.length < 2) return '';

  let path = `M${coords[0]},${coords[1]}`;
  for (let i = 2; i < coords.length; i += 2) {
    path += `L${coords[i]},${coords[i + 1]}`;
  }
  return path;
}

/**
 * Convert a polygon element to path data (closed polyline)
 */
function polygonToPath(points: string): string {
  return polylineToPath(points) + 'z';
}

/**
 * Normalize a path string to ensure it starts with an absolute 'M' command.
 *
 * CRITICAL: When multiple paths are concatenated into a single string,
 * relative 'm' commands become relative to the END of the previous path,
 * breaking the geometry. This function ensures each path segment starts
 * with an absolute move command.
 */
function normalizePathStart(d: string): string {
  const trimmed = d.trim();
  if (trimmed.startsWith('m')) {
    // Convert relative 'm' to absolute 'M'
    return 'M' + trimmed.slice(1);
  }
  return trimmed;
}

/**
 * Extract all SVG elements and convert to combined path data
 * This is the key function for saving generated SVGs to the Icon schema
 *
 * Handles: path, circle, rect, line, polyline, polygon, ellipse
 *
 * IMPORTANT: All extracted paths are normalized to start with absolute 'M'
 * to prevent geometry corruption when paths are concatenated.
 */
export function extractCombinedPathData(svg: string): {
  pathData: string;
  viewBox: string;
  fillRule?: string;
} {
  const paths: string[] = [];

  // Extract viewBox
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';

  // Extract fill-rule from root or first path
  const fillRuleMatch = svg.match(/fill-rule="([^"]+)"/);
  const fillRule = fillRuleMatch ? fillRuleMatch[1] : undefined;

  // Extract path elements and normalize to absolute 'M' start
  const pathMatches = svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/?>/g);
  for (const match of pathMatches) {
    paths.push(normalizePathStart(match[1]));
  }

  // Extract and convert circle elements
  const circleMatches = svg.matchAll(/<circle[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"[^>]*\/?>/g);
  for (const match of circleMatches) {
    const cx = parseFloat(match[1]);
    const cy = parseFloat(match[2]);
    const r = parseFloat(match[3]);
    if (!isNaN(cx) && !isNaN(cy) && !isNaN(r)) {
      paths.push(circleToPath(cx, cy, r));
    }
  }
  // Also match circles with attributes in different order
  const circleMatches2 = svg.matchAll(/<circle[^>]*\/?>/g);
  for (const match of circleMatches2) {
    const elem = match[0];
    const cxMatch = elem.match(/cx="([^"]+)"/);
    const cyMatch = elem.match(/cy="([^"]+)"/);
    const rMatch = elem.match(/\sr="([^"]+)"/); // \s to avoid matching "stroke"
    if (cxMatch && cyMatch && rMatch) {
      const cx = parseFloat(cxMatch[1]);
      const cy = parseFloat(cyMatch[1]);
      const r = parseFloat(rMatch[1]);
      // Avoid duplicates from first regex
      const pathData = circleToPath(cx, cy, r);
      if (!paths.includes(pathData) && !isNaN(cx) && !isNaN(cy) && !isNaN(r)) {
        paths.push(pathData);
      }
    }
  }

  // Extract and convert rect elements
  const rectMatches = svg.matchAll(/<rect[^>]*\/?>/g);
  for (const match of rectMatches) {
    const elem = match[0];
    const xMatch = elem.match(/\sx="([^"]+)"/);
    const yMatch = elem.match(/\sy="([^"]+)"/);
    const widthMatch = elem.match(/width="([^"]+)"/);
    const heightMatch = elem.match(/height="([^"]+)"/);
    const rxMatch = elem.match(/rx="([^"]+)"/);
    const ryMatch = elem.match(/ry="([^"]+)"/);

    if (widthMatch && heightMatch) {
      const x = xMatch ? parseFloat(xMatch[1]) : 0;
      const y = yMatch ? parseFloat(yMatch[1]) : 0;
      const width = parseFloat(widthMatch[1]);
      const height = parseFloat(heightMatch[1]);
      const rx = rxMatch ? parseFloat(rxMatch[1]) : 0;
      const ry = ryMatch ? parseFloat(ryMatch[1]) : 0;

      if (!isNaN(width) && !isNaN(height)) {
        paths.push(rectToPath(x, y, width, height, rx, ry));
      }
    }
  }

  // Extract and convert line elements
  const lineMatches = svg.matchAll(/<line[^>]*\/?>/g);
  for (const match of lineMatches) {
    const elem = match[0];
    const x1Match = elem.match(/x1="([^"]+)"/);
    const y1Match = elem.match(/y1="([^"]+)"/);
    const x2Match = elem.match(/x2="([^"]+)"/);
    const y2Match = elem.match(/y2="([^"]+)"/);

    if (x1Match && y1Match && x2Match && y2Match) {
      const x1 = parseFloat(x1Match[1]);
      const y1 = parseFloat(y1Match[1]);
      const x2 = parseFloat(x2Match[1]);
      const y2 = parseFloat(y2Match[1]);

      if (!isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
        paths.push(lineToPath(x1, y1, x2, y2));
      }
    }
  }

  // Extract and convert polyline elements
  const polylineMatches = svg.matchAll(/<polyline[^>]*points="([^"]+)"[^>]*\/?>/g);
  for (const match of polylineMatches) {
    const pathData = polylineToPath(match[1]);
    if (pathData) paths.push(pathData);
  }

  // Extract and convert polygon elements
  const polygonMatches = svg.matchAll(/<polygon[^>]*points="([^"]+)"[^>]*\/?>/g);
  for (const match of polygonMatches) {
    const pathData = polygonToPath(match[1]);
    if (pathData) paths.push(pathData);
  }

  // Extract and convert ellipse elements
  const ellipseMatches = svg.matchAll(/<ellipse[^>]*\/?>/g);
  for (const match of ellipseMatches) {
    const elem = match[0];
    const cxMatch = elem.match(/cx="([^"]+)"/);
    const cyMatch = elem.match(/cy="([^"]+)"/);
    const rxMatch = elem.match(/rx="([^"]+)"/);
    const ryMatch = elem.match(/ry="([^"]+)"/);

    if (cxMatch && cyMatch && rxMatch && ryMatch) {
      const cx = parseFloat(cxMatch[1]);
      const cy = parseFloat(cyMatch[1]);
      const rx = parseFloat(rxMatch[1]);
      const ry = parseFloat(ryMatch[1]);

      if (!isNaN(cx) && !isNaN(cy) && !isNaN(rx) && !isNaN(ry)) {
        paths.push(ellipseToPath(cx, cy, rx, ry));
      }
    }
  }

  return {
    pathData: paths.join(' '),
    viewBox,
    fillRule,
  };
}
