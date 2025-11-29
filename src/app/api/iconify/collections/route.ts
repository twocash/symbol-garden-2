/**
 * API Route: /api/iconify/collections
 *
 * Returns Iconify collections for browsing/searching.
 *
 * Query params:
 * - search: Search term to filter collections by name
 * - popular: If "true", returns popular stroke-based collections
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCollections,
  getCollection,
  STROKE_BASED_COLLECTIONS,
} from "@/lib/iconify-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search");
  const popular = searchParams.get("popular");

  try {
    if (popular === "true") {
      // Return popular stroke-based collections
      const collections = await Promise.all(
        STROKE_BASED_COLLECTIONS.map(async (prefix) => {
          const collection = await getCollection(prefix);
          return collection ? {
            prefix,
            name: collection.name || prefix,
            total: collection.total || 0,
            license: collection.license?.title || collection.license?.spdx,
          } : null;
        })
      );

      return NextResponse.json({
        collections: collections.filter(Boolean),
      });
    }

    if (search) {
      // Search collections by name
      const allCollections = await getCollections();

      const searchLower = search.toLowerCase();
      const filtered = allCollections
        .filter(c =>
          c.prefix.toLowerCase().includes(searchLower) ||
          c.name.toLowerCase().includes(searchLower)
        )
        .slice(0, 20) // Limit results
        .map(c => ({
          prefix: c.prefix,
          name: c.name,
          total: c.total,
          license: c.license?.title || c.license?.spdx,
        }));

      return NextResponse.json({
        collections: filtered,
      });
    }

    // Default: return stroke-based collections
    const collections = await getCollections({ strokeBasedOnly: true });

    return NextResponse.json({
      collections: collections.map(c => ({
        prefix: c.prefix,
        name: c.name,
        total: c.total,
        license: c.license?.title || c.license?.spdx,
      })),
    });
  } catch (error) {
    console.error("Iconify collections error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch collections" },
      { status: 500 }
    );
  }
}
