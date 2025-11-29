/**
 * API Route: /api/iconify/search
 *
 * P2: Search Iconify for icons matching a concept and return SVGs
 * Used by AIIconGeneratorModal for "Borrow & Adapt" feature
 */

import { NextRequest, NextResponse } from "next/server";
import { searchStrokeBasedIcons, getIconSvgsBatch } from "@/lib/iconify-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");
  const limit = parseInt(searchParams.get("limit") || "6", 10);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Search for stroke-based icons
    const searchResults = await searchStrokeBasedIcons(query, { limit: limit * 2 });

    if (searchResults.icons.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Limit to one per collection for diversity
    const byCollection = new Map<string, string>();
    for (const iconId of searchResults.icons) {
      const [prefix] = iconId.split(":");
      if (!byCollection.has(prefix)) {
        byCollection.set(prefix, iconId);
      }
      if (byCollection.size >= limit) break;
    }

    const iconIds = Array.from(byCollection.values());

    // Fetch SVGs for the selected icons
    const svgMap = await getIconSvgsBatch(iconIds);

    // Build results array
    const results = iconIds
      .map((iconId) => {
        const svg = svgMap.get(iconId);
        if (!svg) return null;

        const [prefix] = iconId.split(":");
        return {
          iconId,
          svg,
          collection: prefix,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Iconify Search API] Error:", error);
    return NextResponse.json(
      { error: "Search failed", results: [] },
      { status: 500 }
    );
  }
}
