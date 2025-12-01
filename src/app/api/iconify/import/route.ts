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

// Helper to extract path data from SVG
// Icons can have multiple paths (e.g., airplay has screen + triangle)
function extractPathFromSvg(svg: string): string | null {
  // Extract ALL path d attributes and combine them
  const pathRegex = /<path[^>]*\sd="([^"]+)"/g;
  const paths: string[] = [];
  let match;

  while ((match = pathRegex.exec(svg)) !== null) {
    paths.push(match[1]);
  }

  if (paths.length > 0) {
    // When combining paths, the first path is fine as-is
    // But subsequent paths that start with lowercase 'm' (relative moveto)
    // need to be converted to 'M' (absolute) since they're now standalone
    const combinedPaths = paths.map((p, i) => {
      if (i === 0) return p;
      // Convert leading relative moveto to absolute
      // A relative 'm' after a path ends would be relative to the last point,
      // but when we split paths, each should start with absolute 'M'
      return p.replace(/^m/, 'M');
    });
    return combinedPaths.join(' ');
  }

  // Try <circle>, <rect>, <line>, <polyline> - construct a simplified path
  // For now, just store the inner content if no path found
  const innerMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (innerMatch) {
    // Return the SVG content as-is, we'll handle it differently
    return innerMatch[1].trim();
  }

  return null;
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
