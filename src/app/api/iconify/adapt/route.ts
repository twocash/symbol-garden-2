/**
 * API Route: /api/iconify/adapt
 *
 * P2: Adapt an imported icon's style to match the target library
 * Adjusts stroke-width, stroke-linecap, stroke-linejoin, and viewBox
 */

import { NextRequest, NextResponse } from "next/server";
import { parseStyleDNA } from "@/lib/svg-prompt-builder";

/**
 * Extract path data from an SVG string
 */
function extractPaths(svg: string): string {
  const pathMatches = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*\/?>/g)];
  if (pathMatches.length === 0) {
    // Try other elements
    const circleMatches = [...svg.matchAll(/<circle[^>]*\/>/g)];
    const lineMatches = [...svg.matchAll(/<line[^>]*\/>/g)];
    const rectMatches = [...svg.matchAll(/<rect[^>]*\/>/g)];

    // If we have other elements, we can't easily extract as a path
    // Return the original SVG content
    if (circleMatches.length > 0 || lineMatches.length > 0 || rectMatches.length > 0) {
      // For now, just extract any path we can find
      return pathMatches.map(m => m[1]).join(' ') || '';
    }
  }

  return pathMatches.map(m => m[1]).join(' ');
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

    // Extract path data for storage
    const path = extractPaths(adaptedSvg);
    const viewBox = extractViewBox(adaptedSvg);

    // If we couldn't extract a path, we need to keep the full SVG structure
    // For now, still return the path (may be empty for complex SVGs)

    return NextResponse.json({
      adaptedSvg,
      path: path || extractPaths(svg), // Fallback to original paths
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
