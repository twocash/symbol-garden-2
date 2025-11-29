/**
 * Iconify Service - Interface to Iconify API for icon discovery and import
 *
 * Provides:
 * - Icon search across 275k+ icons
 * - Individual icon SVG retrieval
 * - Collection metadata and browsing
 * - Filtering for stroke-based icon sets
 *
 * API docs: https://iconify.design/docs/api/
 */

// ============================================================================
// Types
// ============================================================================

export interface IconifyIcon {
  prefix: string;      // Collection prefix, e.g., "lucide"
  name: string;        // Icon name, e.g., "bike"
  svg?: string;        // Full SVG markup (fetched separately)
}

export interface IconifyCollection {
  prefix: string;
  name: string;
  total: number;
  author?: {
    name: string;
    url?: string;
  };
  license?: {
    title: string;
    spdx?: string;
    url?: string;
  };
  height?: number | number[];
  displayHeight?: number;
  samples?: string[];
  palette?: boolean;    // true = colored/multicolor, false = monotone
  category?: string;
  tags?: string[];      // e.g., ["Uses Stroke", "Has Padding"]
}

export interface IconifySearchResult {
  icons: string[];     // Full icon IDs, e.g., ["lucide:bike", "tabler:bike"]
  total: number;
  limit: number;
  start: number;
  collections: Record<string, {
    name: string;
    total: number;
    author?: { name: string };
    license?: { title: string; spdx?: string };
  }>;
}

export interface SearchOptions {
  limit?: number;           // Max results (default 64)
  start?: number;           // Offset for pagination
  prefixes?: string[];      // Filter to specific collections
  category?: string;        // Filter by category
}

export interface CollectionListOptions {
  strokeBasedOnly?: boolean;  // Filter to stroke-based sets
}

// ============================================================================
// Constants
// ============================================================================

// Iconify has multiple backup hosts for reliability
const ICONIFY_HOSTS = [
  'https://api.iconify.design',
  'https://api.simplesvg.com',
  'https://api.unisvg.com',
];

// Known stroke-based collections (24x24, monochrome)
// These are the most relevant for Symbol Garden's use case
export const STROKE_BASED_COLLECTIONS = [
  'lucide',       // 1,500+ icons, Feather fork
  'tabler',       // 5,000+ icons, consistent stroke style
  'feather',      // 287 icons, the original
  'phosphor',     // 9,000+ icons, multiple weights
  'heroicons',    // 800+ icons, Tailwind ecosystem
  'humbleicons',  // 270+ icons, clean minimal
  'majesticons',  // 760+ icons, line variants
  'iconoir',      // 1,500+ icons, consistent 24px
  'carbon',       // 2,000+ icons, IBM design system
  'solar',        // 1,000+ icons, modern style
];

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  searchResults: 5 * 60 * 1000,           // 5 minutes
  iconSvg: 24 * 60 * 60 * 1000,           // 24 hours
  collectionMetadata: 7 * 24 * 60 * 60 * 1000, // 7 days
  collectionsList: 24 * 60 * 60 * 1000,   // 24 hours
};

// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expires: number;
}

class IconifyCache {
  private memory = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.memory.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.memory.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  clear(): void {
    this.memory.clear();
  }

  // Prune expired entries (call periodically to prevent memory leaks)
  prune(): void {
    const now = Date.now();
    const keys = Array.from(this.memory.keys());
    for (const key of keys) {
      const entry = this.memory.get(key);
      if (entry && now > entry.expires) {
        this.memory.delete(key);
      }
    }
  }
}

const cache = new IconifyCache();

// ============================================================================
// Core API Functions
// ============================================================================

/**
 * Fetch with automatic fallback to backup hosts and timeout
 */
async function fetchWithFallback(path: string): Promise<Response> {
  let lastError: Error | null = null;
  const TIMEOUT_MS = 10000; // 10 second timeout per host

  for (const host of ICONIFY_HOSTS) {
    try {
      console.log(`[Iconify] Fetching: ${host}${path}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${host}${path}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[Iconify] Success from ${host}`);
        return response;
      }

      // 404 is a valid response (icon not found), don't try other hosts
      if (response.status === 404) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      console.log(`[Iconify] ${host} returned ${response.status}, trying next...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[Iconify] ${host} failed: ${message}`);
      lastError = error instanceof Error ? error : new Error(message);
      // Continue to next host
    }
  }

  throw lastError || new Error('All Iconify hosts failed');
}

/**
 * Fetch SVG with automatic fallback (returns text, not JSON)
 */
async function fetchSvgWithFallback(path: string): Promise<string | null> {
  let lastError: Error | null = null;
  const TIMEOUT_MS = 10000; // 10 second timeout per host

  for (const host of ICONIFY_HOSTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${host}${path}`, {
        headers: {
          'Accept': 'image/svg+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.text();
      }

      if (response.status === 404) {
        return null;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error('All Iconify hosts failed');
}

/**
 * Search icons across Iconify
 *
 * @param query - Search term (e.g., "bike", "arrow")
 * @param options - Search options
 * @returns Search results with icon IDs and collection metadata
 *
 * @example
 * const results = await searchIcons('bike', { limit: 20 });
 * // results.icons = ["lucide:bike", "tabler:bike", ...]
 */
export async function searchIcons(
  query: string,
  options: SearchOptions = {}
): Promise<IconifySearchResult> {
  const { limit = 64, start = 0, prefixes, category } = options;

  // Build cache key
  const cacheKey = `search:${query}:${limit}:${start}:${prefixes?.join(',')}:${category}`;
  const cached = cache.get<IconifySearchResult>(cacheKey);
  if (cached) return cached;

  // Build query params
  const params = new URLSearchParams({
    query,
    limit: String(limit),
  });

  if (start > 0) {
    params.set('start', String(start));
  }

  if (prefixes && prefixes.length > 0) {
    params.set('prefixes', prefixes.join(','));
  }

  if (category) {
    params.set('category', category);
  }

  const response = await fetchWithFallback(`/search?${params.toString()}`);
  const data = await response.json() as IconifySearchResult;

  cache.set(cacheKey, data, CACHE_TTL.searchResults);
  return data;
}

/**
 * Search icons in stroke-based collections only
 *
 * Filters search to collections known to use stroke-based icon styles,
 * making results more relevant for Symbol Garden.
 */
export async function searchStrokeBasedIcons(
  query: string,
  options: Omit<SearchOptions, 'prefixes'> = {}
): Promise<IconifySearchResult> {
  return searchIcons(query, {
    ...options,
    prefixes: STROKE_BASED_COLLECTIONS,
  });
}

/**
 * Get SVG for a specific icon
 *
 * @param prefix - Collection prefix (e.g., "lucide")
 * @param name - Icon name (e.g., "bike")
 * @returns SVG markup string, or null if not found
 *
 * @example
 * const svg = await getIconSvg('lucide', 'bike');
 * // svg = '<svg xmlns="http://www.w3.org/2000/svg" ...>...</svg>'
 */
export async function getIconSvg(
  prefix: string,
  name: string
): Promise<string | null> {
  const cacheKey = `svg:${prefix}:${name}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const svg = await fetchSvgWithFallback(`/${prefix}/${name}.svg`);

  if (svg) {
    cache.set(cacheKey, svg, CACHE_TTL.iconSvg);
  }

  return svg;
}

/**
 * Get SVG from full icon ID (prefix:name format)
 */
export async function getIconSvgById(iconId: string): Promise<string | null> {
  const [prefix, name] = iconId.split(':');
  if (!prefix || !name) {
    throw new Error(`Invalid icon ID format: ${iconId}. Expected "prefix:name"`);
  }
  return getIconSvg(prefix, name);
}

/**
 * Get metadata for a specific collection
 *
 * @param prefix - Collection prefix (e.g., "lucide")
 * @returns Collection metadata including name, icon count, license, etc.
 */
export async function getCollection(
  prefix: string
): Promise<IconifyCollection | null> {
  const cacheKey = `collection:${prefix}`;
  const cached = cache.get<IconifyCollection>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithFallback(`/collection?prefix=${prefix}`);

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  // Transform API response to our interface
  const collection: IconifyCollection = {
    prefix: data.prefix || prefix,
    name: data.name || prefix,
    total: data.total || 0,
    author: data.author,
    license: data.license,
    height: data.height,
    displayHeight: data.displayHeight,
    samples: data.samples,
    palette: data.palette,
    category: data.category,
    tags: data.tags,
  };

  cache.set(cacheKey, collection, CACHE_TTL.collectionMetadata);
  return collection;
}

/**
 * Get list of all available icon collections
 *
 * @param options - Filter options
 * @returns Array of collection metadata
 */
export async function getCollections(
  options: CollectionListOptions = {}
): Promise<IconifyCollection[]> {
  const { strokeBasedOnly = false } = options;

  const cacheKey = `collections:${strokeBasedOnly}`;
  const cached = cache.get<IconifyCollection[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithFallback('/collections');
  const data = await response.json() as Record<string, Omit<IconifyCollection, 'prefix'>>;

  let collections: IconifyCollection[] = Object.entries(data).map(([prefix, info]) => ({
    prefix,
    ...info,
  }));

  // Filter to stroke-based if requested
  if (strokeBasedOnly) {
    collections = collections.filter(c => STROKE_BASED_COLLECTIONS.includes(c.prefix));
  }

  cache.set(cacheKey, collections, CACHE_TTL.collectionsList);
  return collections;
}

/**
 * Get all icon names in a collection
 *
 * @param prefix - Collection prefix
 * @returns Array of icon names (without prefix)
 */
export async function getCollectionIconNames(prefix: string): Promise<string[]> {
  const cacheKey = `collection-icons:${prefix}`;
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithFallback(`/collection?prefix=${prefix}&info=true&chars=true`);
  const data = await response.json();

  // Icons can be in 'icons' object or 'uncategorized' array
  let iconNames: string[] = [];

  if (data.icons) {
    iconNames = Object.keys(data.icons);
  }

  if (data.uncategorized) {
    iconNames = [...iconNames, ...data.uncategorized];
  }

  // Also check categories
  if (data.categories) {
    for (const category of Object.values(data.categories) as string[][]) {
      iconNames = [...iconNames, ...category];
    }
  }

  // Deduplicate
  iconNames = Array.from(new Set(iconNames));

  cache.set(cacheKey, iconNames, CACHE_TTL.collectionMetadata);
  return iconNames;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse icon ID into prefix and name
 */
export function parseIconId(iconId: string): { prefix: string; name: string } | null {
  const parts = iconId.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { prefix: parts[0], name: parts[1] };
}

/**
 * Create icon ID from prefix and name
 */
export function createIconId(prefix: string, name: string): string {
  return `${prefix}:${name}`;
}

/**
 * Check if a collection is stroke-based
 */
export function isStrokeBasedCollection(prefix: string): boolean {
  return STROKE_BASED_COLLECTIONS.includes(prefix);
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Prune expired cache entries
 */
export function pruneCache(): void {
  cache.prune();
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get SVGs for multiple icons in parallel
 *
 * @param iconIds - Array of icon IDs (prefix:name format)
 * @returns Map of icon ID to SVG (null if not found)
 */
export async function getIconSvgsBatch(
  iconIds: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();

  // Fetch in parallel with concurrency limit
  const BATCH_SIZE = 10;

  for (let i = 0; i < iconIds.length; i += BATCH_SIZE) {
    const batch = iconIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (iconId) => {
      const svg = await getIconSvgById(iconId);
      results.set(iconId, svg);
    });

    await Promise.all(promises);
  }

  return results;
}

/**
 * Search for a concept and get SVGs for top results
 *
 * Convenience function that combines search + SVG retrieval
 */
export async function searchAndGetSvgs(
  query: string,
  options: { limit?: number; strokeBasedOnly?: boolean } = {}
): Promise<Array<{ iconId: string; svg: string }>> {
  const { limit = 6, strokeBasedOnly = true } = options;

  const searchFn = strokeBasedOnly ? searchStrokeBasedIcons : searchIcons;
  const results = await searchFn(query, { limit });

  const svgMap = await getIconSvgsBatch(results.icons);

  return results.icons
    .map(iconId => ({ iconId, svg: svgMap.get(iconId) }))
    .filter((item): item is { iconId: string; svg: string } => item.svg !== null);
}

// ============================================================================
// Reference Oracle (P1c) - Cross-library structural consensus
// ============================================================================

/**
 * Structural reference extracted from cross-library icon analysis
 */
export interface StructuralReference {
  /** The concept that was analyzed */
  concept: string;

  /** Number of icons analyzed */
  iconCount: number;

  /** Consensus patterns across libraries */
  consensus: {
    /** Common visual elements found (e.g., "two circles at bottom", "angular frame") */
    elements: string[];
    /** Spatial arrangement pattern (e.g., "wheels at y~18, frame rises to y~6") */
    spatialPattern: string;
    /** Common geometric traits */
    commonTraits: string[];
  };

  /** 2-3 example SVGs for visual reference */
  exampleSvgs: Array<{ iconId: string; svg: string }>;

  /** Collections that had this concept */
  collections: string[];
}

export interface StructuralReferenceOptions {
  /** Collections to search (defaults to STROKE_BASED_COLLECTIONS) */
  collections?: string[];
  /** Max icons to fetch per collection (default: 1) */
  maxPerCollection?: number;
  /** Max total icons to analyze (default: 6) */
  maxIcons?: number;
  /** API key for LLM analysis */
  apiKey?: string;
}

/**
 * Get structural reference for a concept by analyzing cross-library implementations
 *
 * This function:
 * 1. Searches for the concept across multiple stroke-based icon libraries
 * 2. Fetches SVGs from different collections to see how they interpret the concept
 * 3. Uses LLM to extract structural consensus (common elements, spatial patterns)
 *
 * @param concept - The icon concept to analyze (e.g., "bike", "rocket")
 * @param options - Configuration options
 * @returns Structural reference with consensus and example SVGs
 *
 * @example
 * const ref = await getStructuralReference('bike', { apiKey: 'xxx' });
 * // ref.consensus.elements = ["two circles for wheels", "angular frame", "seat at top"]
 * // ref.consensus.spatialPattern = "wheels horizontally aligned at bottom, frame rises diagonally"
 */
export async function getStructuralReference(
  concept: string,
  options: StructuralReferenceOptions = {}
): Promise<StructuralReference | null> {
  const {
    collections = STROKE_BASED_COLLECTIONS,
    maxPerCollection = 1,
    maxIcons = 6,
    apiKey,
  } = options;

  console.log(`[ReferenceOracle] Searching for "${concept}" across ${collections.length} collections`);

  // Search for the concept in the specified stroke-based collections
  const searchResults = await searchIcons(concept, {
    limit: maxIcons * 2, // Get more results to ensure diversity
    prefixes: collections,
  });

  if (searchResults.icons.length === 0) {
    console.log(`[ReferenceOracle] No icons found for "${concept}"`);
    return null;
  }

  // Group by collection and take maxPerCollection from each
  const byCollection = new Map<string, string[]>();
  for (const iconId of searchResults.icons) {
    const [prefix] = iconId.split(':');
    if (!byCollection.has(prefix)) {
      byCollection.set(prefix, []);
    }
    const collectionIcons = byCollection.get(prefix)!;
    if (collectionIcons.length < maxPerCollection) {
      collectionIcons.push(iconId);
    }
  }

  // Flatten and limit to maxIcons
  const selectedIds: string[] = [];
  const usedCollections = Array.from(byCollection.keys());
  for (const prefix of byCollection.keys()) {
    const icons = byCollection.get(prefix)!;
    selectedIds.push(...icons);
    if (selectedIds.length >= maxIcons) break;
  }
  const finalIds = selectedIds.slice(0, maxIcons);

  console.log(`[ReferenceOracle] Selected ${finalIds.length} icons from ${usedCollections.length} collections`);

  // Fetch SVGs
  const svgMap = await getIconSvgsBatch(finalIds);
  const examples = finalIds
    .map(iconId => ({ iconId, svg: svgMap.get(iconId) }))
    .filter((item): item is { iconId: string; svg: string } => item.svg !== null);

  if (examples.length === 0) {
    console.log(`[ReferenceOracle] Could not fetch any SVGs for "${concept}"`);
    return null;
  }

  // If no API key, return examples without LLM analysis
  if (!apiKey) {
    console.log(`[ReferenceOracle] No API key - returning ${examples.length} examples without consensus analysis`);
    return {
      concept,
      iconCount: examples.length,
      consensus: {
        elements: [],
        spatialPattern: '',
        commonTraits: [],
      },
      exampleSvgs: examples.slice(0, 3),
      collections: usedCollections,
    };
  }

  // Use LLM to extract structural consensus
  const consensus = await analyzeStructuralConsensus(concept, examples, apiKey);

  return {
    concept,
    iconCount: examples.length,
    consensus,
    exampleSvgs: examples.slice(0, 3), // Limit to 3 examples for prompt size
    collections: usedCollections,
  };
}

/**
 * Use LLM to analyze SVGs and extract structural consensus
 */
async function analyzeStructuralConsensus(
  concept: string,
  examples: Array<{ iconId: string; svg: string }>,
  apiKey: string
): Promise<StructuralReference['consensus']> {
  // Dynamic import to avoid bundling issues
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Analyze these ${examples.length} SVG icon implementations of "${concept}" from different icon libraries.

${examples.map((e, i) => `
### Icon ${i + 1}: ${e.iconId}
\`\`\`svg
${e.svg}
\`\`\`
`).join('\n')}

Extract the STRUCTURAL CONSENSUS - what visual elements and spatial arrangements appear consistently across these implementations.

Respond in this EXACT JSON format:
{
  "elements": ["list of 3-5 common visual elements, e.g., 'two circles for wheels', 'angular frame connecting top to bottom'"],
  "spatialPattern": "description of how elements are typically arranged spatially, e.g., 'wheels at bottom (y~18), frame rises diagonally to seat at y~8'",
  "commonTraits": ["geometric traits like 'symmetry', 'compound shapes', 'circular elements', 'angular lines']
}

Focus on STRUCTURAL patterns, not style (ignore stroke-width, colors, etc.). What elements must a "${concept}" icon have, and where should they be positioned?`;

  try {
    console.log(`[ReferenceOracle] Analyzing structural consensus with LLM...`);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    });

    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[ReferenceOracle] Could not extract JSON from LLM response');
      return { elements: [], spatialPattern: '', commonTraits: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[ReferenceOracle] Extracted consensus: ${parsed.elements?.length || 0} elements, ${parsed.commonTraits?.length || 0} traits`);

    return {
      elements: parsed.elements || [],
      spatialPattern: parsed.spatialPattern || '',
      commonTraits: parsed.commonTraits || [],
    };
  } catch (error) {
    console.error('[ReferenceOracle] LLM analysis failed:', error);
    return { elements: [], spatialPattern: '', commonTraits: [] };
  }
}
