/**
 * API Route: /api/iconify/import
 *
 * Imports an Iconify collection and converts to Symbol Garden format.
 *
 * POST body:
 * - prefix: Iconify collection prefix (e.g., "lucide")
 * - apiKey: Optional Gemini API key for Style DNA generation
 *
 * Returns streaming JSON events:
 * - { status: "fetching", progress: N, total: M }
 * - { status: "converting" }
 * - { status: "analyzing" }
 * - { status: "complete", icons: [...], manifest: "...", name: "..." }
 */

import { NextRequest } from "next/server";
import {
  getCollection,
  getCollectionIconNames,
  getIconSvg,
} from "@/lib/iconify-service";
import { Icon } from "@/types/schema";
import { analyzeLibrary } from "@/app/actions/analyze-library";

// Helper to convert SVG shapes to path commands
function elementToPath(tagName: string, attrs: Record<string, string>): string | null {
  switch (tagName) {
    case "path": {
      const d = attrs.d;
      if (!d) return null;
      // Normalize relative start to absolute
      return d.trim().replace(/^m/, "M");
    }

    case "rect": {
      const x = parseFloat(attrs.x || "0");
      const y = parseFloat(attrs.y || "0");
      const w = parseFloat(attrs.width || "0");
      const h = parseFloat(attrs.height || "0");
      const rx = parseFloat(attrs.rx || "0");
      const ry = parseFloat(attrs.ry || "0");

      if (rx || ry) {
        const r = rx || ry;
        return `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
      }
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    }

    case "circle": {
      const cx = parseFloat(attrs.cx || "0");
      const cy = parseFloat(attrs.cy || "0");
      const r = parseFloat(attrs.r || "0");
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }

    case "ellipse": {
      const cx = parseFloat(attrs.cx || "0");
      const cy = parseFloat(attrs.cy || "0");
      const rx = parseFloat(attrs.rx || "0");
      const ry = parseFloat(attrs.ry || "0");
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
    }

    case "line": {
      const x1 = attrs.x1 || "0";
      const y1 = attrs.y1 || "0";
      const x2 = attrs.x2 || "0";
      const y2 = attrs.y2 || "0";
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    case "polyline": {
      const points = attrs.points;
      if (!points) return null;
      const cleaned = points.trim().replace(/,/g, " ");
      const coords = cleaned.split(/\s+/);
      if (coords.length < 2) return null;
      let d = `M ${coords[0]} ${coords[1]}`;
      for (let i = 2; i < coords.length; i += 2) {
        d += ` L ${coords[i]} ${coords[i + 1]}`;
      }
      return d;
    }

    case "polygon": {
      const points = attrs.points;
      if (!points) return null;
      const cleaned = points.trim().replace(/,/g, " ");
      const coords = cleaned.split(/\s+/);
      if (coords.length < 2) return null;
      let d = `M ${coords[0]} ${coords[1]}`;
      for (let i = 2; i < coords.length; i += 2) {
        d += ` L ${coords[i]} ${coords[i + 1]}`;
      }
      return d + " Z";
    }

    default:
      return null;
  }
}

// Helper to extract path data from SVG by converting all elements to paths
function extractPathFromSvg(svg: string): string | null {
  const paths: string[] = [];

  // Match all shape elements (including nested in groups)
  // Regex pattern to match path, rect, circle, ellipse, line, polyline, polygon
  const elementPattern = /<(path|rect|circle|ellipse|line|polyline|polygon)\s+([^>]*)\/?>(?:<\/\1>)?/gi;

  let match;
  while ((match = elementPattern.exec(svg)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrString = match[2];

    // Parse attributes
    const attrs: Record<string, string> = {};
    const attrPattern = /(\w+(?:-\w+)?)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    const pathData = elementToPath(tagName, attrs);
    if (pathData) {
      paths.push(pathData);
    }
  }

  if (paths.length === 0) {
    return null;
  }

  return paths.join(" ");
}

// Helper to detect render style from SVG
function detectRenderStyle(svg: string): "stroke" | "fill" {
  // Check for stroke-based indicators
  const hasStroke = svg.includes('stroke="currentColor"') || svg.includes("stroke=");
  const hasFillNone = svg.includes('fill="none"');

  if (hasStroke && hasFillNone) {
    return "stroke";
  }

  return "fill";
}

// Helper to extract viewBox
function extractViewBox(svg: string): string {
  const match = svg.match(/viewBox="([^"]+)"/);
  return match ? match[1] : "0 0 24 24";
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const body = await request.json();
        const { prefix, apiKey } = body;

        if (!prefix || typeof prefix !== "string") {
          sendEvent({ error: "Missing collection prefix" });
          controller.close();
          return;
        }

        // Get collection metadata
        const collection = await getCollection(prefix);
        if (!collection) {
          sendEvent({ error: `Collection "${prefix}" not found` });
          controller.close();
          return;
        }

        // Get all icon names
        const iconNames = await getCollectionIconNames(prefix);
        const total = iconNames.length;

        if (total === 0) {
          sendEvent({ error: "No icons found in collection" });
          controller.close();
          return;
        }

        sendEvent({ status: "fetching", progress: 0, total });

        // Fetch icons in batches
        const icons: Icon[] = [];
        const BATCH_SIZE = 20;

        for (let i = 0; i < iconNames.length; i += BATCH_SIZE) {
          const batch = iconNames.slice(i, i + BATCH_SIZE);

          const batchResults = await Promise.all(
            batch.map(async (name) => {
              const svg = await getIconSvg(prefix, name);
              if (!svg) return null;

              const path = extractPathFromSvg(svg);
              if (!path) return null;

              return {
                id: `${prefix}-${name}`,
                name: name.replace(/-/g, " "),
                library: collection.name || prefix,
                path,
                viewBox: extractViewBox(svg),
                renderStyle: detectRenderStyle(svg),
                tags: [prefix, name.replace(/-/g, " ")],
              } as Icon;
            })
          );

          icons.push(...batchResults.filter((i): i is Icon => i !== null));

          sendEvent({ status: "fetching", progress: Math.min(i + BATCH_SIZE, total), total });
        }

        sendEvent({ status: "converting" });

        // Generate Style DNA if API key provided
        let manifest = "";
        if (apiKey && icons.length > 0) {
          sendEvent({ status: "analyzing" });
          try {
            // Use a sample of icons for analysis (first 20)
            const sampleIcons = icons.slice(0, 20);
            manifest = await analyzeLibrary(sampleIcons, apiKey) || "";
          } catch (error) {
            console.error("Style DNA generation failed:", error);
            // Continue without manifest
          }
        }

        sendEvent({
          status: "complete",
          icons,
          manifest,
          name: collection.name || prefix,
        });

        controller.close();
      } catch (error) {
        console.error("Import error:", error);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Import failed",
            }) + "\n"
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
