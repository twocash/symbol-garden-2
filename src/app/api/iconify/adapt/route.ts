/**
 * API Route: /api/iconify/adapt
 *
 * P2: Adapt an imported icon's style to match the target library
 * Adjusts stroke-width, stroke-linecap, stroke-linejoin, and viewBox
 */

import { NextRequest, NextResponse } from "next/server";
import { parseStyleDNA } from "@/lib/svg-prompt-builder";

/**
 * Convert a rect element to path commands
 */
function rectToPath(rect: string): string {
  const x = parseFloat(rect.match(/x="([^"]+)"/)?.[1] || '0');
  const y = parseFloat(rect.match(/y="([^"]+)"/)?.[1] || '0');
  const width = parseFloat(rect.match(/width="([^"]+)"/)?.[1] || '0');
  const height = parseFloat(rect.match(/height="([^"]+)"/)?.[1] || '0');
  const rx = parseFloat(rect.match(/rx="([^"]+)"/)?.[1] || '0');
  const ry = parseFloat(rect.match(/ry="([^"]+)"/)?.[1] || rx.toString());

  if (rx > 0 || ry > 0) {
    // Rounded rect - use arcs
    const r = Math.min(rx, ry, width / 2, height / 2);
    return `M${x + r},${y} L${x + width - r},${y} A${r},${r} 0 0 1 ${x + width},${y + r} L${x + width},${y + height - r} A${r},${r} 0 0 1 ${x + width - r},${y + height} L${x + r},${y + height} A${r},${r} 0 0 1 ${x},${y + height - r} L${x},${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  } else {
    // Simple rect
    return `M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`;
  }
}

/**
 * Convert a circle element to path commands
 */
function circleToPath(circle: string): string {
  const cx = parseFloat(circle.match(/cx="([^"]+)"/)?.[1] || '0');
  const cy = parseFloat(circle.match(/cy="([^"]+)"/)?.[1] || '0');
  const r = parseFloat(circle.match(/r="([^"]+)"/)?.[1] || '0');

  // Circle as two arcs
  return `M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy}`;
}

/**
 * Convert a line element to path commands
 */
function lineToPath(line: string): string {
  const x1 = line.match(/x1="([^"]+)"/)?.[1] || '0';
  const y1 = line.match(/y1="([^"]+)"/)?.[1] || '0';
  const x2 = line.match(/x2="([^"]+)"/)?.[1] || '0';
  const y2 = line.match(/y2="([^"]+)"/)?.[1] || '0';

  return `M${x1},${y1} L${x2},${y2}`;
}

/**
 * Convert a polyline element to path commands
 */
function polylineToPath(polyline: string): string {
  const points = polyline.match(/points="([^"]+)"/)?.[1] || '';
  const pairs = points.trim().split(/[\s,]+/);

  if (pairs.length < 2) return '';

  const commands: string[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const x = pairs[i];
    const y = pairs[i + 1];
    if (i === 0) {
      commands.push(`M${x},${y}`);
    } else {
      commands.push(`L${x},${y}`);
    }
  }

  return commands.join(' ');
}

/**
 * Convert a polygon element to path commands (like polyline but closed)
 */
function polygonToPath(polygon: string): string {
  return polylineToPath(polygon) + ' Z';
}

/**
 * Extract and convert all SVG elements to path data
 */
function extractAllPaths(svg: string): string {
  const paths: string[] = [];

  // Extract existing path elements
  const pathMatches = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/?>/g)];
  for (const match of pathMatches) {
    paths.push(match[1]);
  }

  // Convert rect elements
  const rectMatches = [...svg.matchAll(/<rect[^>]*\/?>(?:<\/rect>)?/g)];
  for (const match of rectMatches) {
    const converted = rectToPath(match[0]);
    if (converted) paths.push(converted);
  }

  // Convert circle elements
  const circleMatches = [...svg.matchAll(/<circle[^>]*\/?>(?:<\/circle>)?/g)];
  for (const match of circleMatches) {
    const converted = circleToPath(match[0]);
    if (converted) paths.push(converted);
  }

  // Convert line elements
  const lineMatches = [...svg.matchAll(/<line[^>]*\/?>(?:<\/line>)?/g)];
  for (const match of lineMatches) {
    const converted = lineToPath(match[0]);
    if (converted) paths.push(converted);
  }

  // Convert polyline elements
  const polylineMatches = [...svg.matchAll(/<polyline[^>]*\/?>(?:<\/polyline>)?/g)];
  for (const match of polylineMatches) {
    const converted = polylineToPath(match[0]);
    if (converted) paths.push(converted);
  }

  // Convert polygon elements
  const polygonMatches = [...svg.matchAll(/<polygon[^>]*\/?>(?:<\/polygon>)?/g)];
  for (const match of polygonMatches) {
    const converted = polygonToPath(match[0]);
    if (converted) paths.push(converted);
  }

  return paths.join(' ');
}

/**
 * Extract viewBox from SVG
 */
function extractViewBox(svg: string): string {
  const match = svg.match(/viewBox="([^"]+)"/);
  return match ? match[1] : "0 0 24 24";
}

/**
 * Apply style adaptation to SVG
 */
function adaptSvgStyle(
  svg: string,
  targetStyle: {
    strokeWidth?: number;
    strokeLinecap?: string;
    strokeLinejoin?: string;
    viewBoxSize?: number;
  }
): string {
  let adapted = svg;

  // Replace stroke-width
  if (targetStyle.strokeWidth) {
    adapted = adapted.replace(
      /stroke-width="[^"]*"/g,
      `stroke-width="${targetStyle.strokeWidth}"`
    );
  }

  // Replace stroke-linecap
  if (targetStyle.strokeLinecap) {
    adapted = adapted.replace(
      /stroke-linecap="[^"]*"/g,
      `stroke-linecap="${targetStyle.strokeLinecap}"`
    );
    // Add if not present
    if (!adapted.includes('stroke-linecap=')) {
      adapted = adapted.replace(/<svg/, `<svg stroke-linecap="${targetStyle.strokeLinecap}"`);
    }
  }

  // Replace stroke-linejoin
  if (targetStyle.strokeLinejoin) {
    adapted = adapted.replace(
      /stroke-linejoin="[^"]*"/g,
      `stroke-linejoin="${targetStyle.strokeLinejoin}"`
    );
    // Add if not present
    if (!adapted.includes('stroke-linejoin=')) {
      adapted = adapted.replace(/<svg/, `<svg stroke-linejoin="${targetStyle.strokeLinejoin}"`);
    }
  }

  // Ensure fill="none" for stroke-based icons
  if (!adapted.includes('fill="none"')) {
    adapted = adapted.replace(/<svg/, '<svg fill="none"');
  }

  return adapted;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { iconId, svg, targetLibrary, styleManifest } = body;

    if (!svg) {
      return NextResponse.json(
        { error: "SVG is required" },
        { status: 400 }
      );
    }

    console.log(`[Adapt API] Adapting ${iconId} for ${targetLibrary}`);

    // Parse style DNA if available
    let targetStyle: {
      strokeWidth?: number;
      strokeLinecap?: string;
      strokeLinejoin?: string;
      viewBoxSize?: number;
    } = {
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    };

    if (styleManifest) {
      const parsed = parseStyleDNA(styleManifest);
      targetStyle = {
        strokeWidth: parsed.strokeWidth || 2,
        strokeLinecap: parsed.strokeLinecap || "round",
        strokeLinejoin: parsed.strokeLinejoin || "round",
        viewBoxSize: parsed.viewBoxSize || 24,
      };
      console.log(`[Adapt API] Using Style DNA: linecap=${targetStyle.strokeLinecap}, linejoin=${targetStyle.strokeLinejoin}`);
    }

    // Apply style adaptation
    const adaptedSvg = adaptSvgStyle(svg, targetStyle);

    // Extract and convert all SVG elements to path data
    const path = extractAllPaths(adaptedSvg);
    const viewBox = extractViewBox(adaptedSvg);

    console.log(`[Adapt API] Extracted path (${path.length} chars) from SVG`);

    return NextResponse.json({
      adaptedSvg,
      path: path || extractAllPaths(svg), // Fallback to original
      viewBox,
      targetStyle,
    });
  } catch (error) {
    console.error("[Adapt API] Error:", error);
    return NextResponse.json(
      { error: "Adaptation failed" },
      { status: 500 }
    );
  }
}
