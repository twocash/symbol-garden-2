/**
 * API Route: Generate SVG Icon
 *
 * Creates "master forgeries" - new icons that perfectly match an ingested library's style.
 *
 * POST /api/generate-svg
 * Body: {
 *   concept: string,           // The icon concept to generate (e.g., "rocket", "ai-brain")
 *   description?: string,      // Optional description for context
 *   libraryId?: string,        // Which ingested library to match (default: uses stored icons)
 *   icons?: Icon[],            // Icons from the client (from IndexedDB)
 *   options?: {
 *     fewShotCount?: number,   // Number of similar icons to reference (1-8, default: 4)
 *     decompositionMode?: 'static' | 'dynamic' | 'auto',  // How to get structural breakdown
 *     includePatternLibrary?: boolean,  // Include generic patterns (default: true)
 *     temperature?: number,    // Generation randomness (0-1, default: 0.2)
 *     variants?: number,       // Number of variants to generate (1-5, default: 1)
 *   }
 * }
 *
 * Response: {
 *   svg: string,              // Generated SVG code (or array if variants > 1)
 *   metadata: {
 *     fewShotExamples: string[],  // Names of icons used as reference
 *     decomposition: object | null,
 *     tokensUsed: number,
 *     attempts: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateIcon, generateIconVariants, GenerationConfig } from '@/lib/hybrid-generator';
import { clearDynamicCache } from '@/lib/decomposition-service';
import { Icon } from '@/types/schema';

// Fallback: load icons from file when client doesn't provide them
import * as fs from 'fs';
import * as path from 'path';

// Clear dynamic cache on first request after server restart
// This ensures we use the latest prompt templates
let cacheCleared = false;

/**
 * Load icons from the data directory (fallback when no icons provided)
 */
async function loadLibraryFromFile(libraryId: string): Promise<Icon[]> {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${libraryId}-icons.json`);

    // Try library-specific file first
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return Array.isArray(data) ? data : data.icons || [];
    }

    // Fall back to feather-icons.json
    const featherPath = path.join(dataDir, 'feather-icons.json');
    if (fs.existsSync(featherPath)) {
      const data = JSON.parse(fs.readFileSync(featherPath, 'utf-8'));
      return Array.isArray(data) ? data : data.icons || [];
    }

    return [];
  } catch (error) {
    console.error(`[API] Error loading library "${libraryId}" from file:`, error);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    // Clear dynamic decomposition cache on first request (ensures fresh prompts after code changes)
    if (!cacheCleared) {
      clearDynamicCache();
      cacheCleared = true;
      console.log('[API] Cleared dynamic decomposition cache');
    }

    const body = await req.json();

    // Validate required fields
    const { concept, description, libraryId = 'feather', icons: clientIcons, options = {}, styleManifest } = body;

    if (!concept || typeof concept !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: concept' },
        { status: 400 }
      );
    }

    // Use icons from client if provided, otherwise try loading from file
    let library: Icon[] = [];

    if (clientIcons && Array.isArray(clientIcons) && clientIcons.length > 0) {
      // Use icons sent from the client (from IndexedDB)
      library = clientIcons.filter((icon: Icon) => icon.path); // Only use icons with valid paths
      console.log(`[API] Using ${library.length} icons from client request`);
    } else {
      // Fallback to loading from file
      library = await loadLibraryFromFile(libraryId);
      console.log(`[API] Loaded ${library.length} icons from file for "${libraryId}"`);
    }

    if (library.length === 0) {
      return NextResponse.json(
        { error: `No icons found for library "${libraryId}". Please ingest an icon library first.` },
        { status: 404 }
      );
    }

    console.log(`[API] Generating "${concept}" in style of ${libraryId} (${library.length} icons available)`);

    // Build generation config
    const config: GenerationConfig = {
      concept: concept.trim(),
      description: description?.trim(),
      library,
      libraryId,
      fewShotCount: Math.min(8, Math.max(1, options.fewShotCount || 4)),
      decompositionMode: options.decompositionMode || 'auto',
      includePatternLibrary: options.includePatternLibrary !== false,
      temperature: Math.min(1, Math.max(0, options.temperature || 0.2)),
      styleManifest: styleManifest || undefined,  // Pass Style DNA if provided
    };

    if (styleManifest) {
      console.log(`[API] Style DNA provided (${styleManifest.length} chars)`);
    }

    // Generate single icon or variants
    const variantCount = Math.min(5, Math.max(1, options.variants || 1));

    if (variantCount === 1) {
      const result = await generateIcon(config);

      return NextResponse.json({
        svg: result.svg,
        metadata: {
          fewShotExamples: result.fewShotExamples,
          decomposition: result.decomposition,
          decompositionSource: result.decompositionSource,
          tokensUsed: result.tokensUsed,
          attempts: result.attempts,
        },
        // F1: Style compliance information
        compliance: result.compliance ? {
          passed: result.compliance.passed,
          score: result.compliance.score,
          violations: result.compliance.violations.map(v => ({
            rule: v.rule,
            expected: v.expected,
            actual: v.actual,
            severity: v.severity,
            autoFixed: v.autoFixable,
          })),
          changesApplied: result.compliance.changes.length,
        } : undefined,
      });
    } else {
      const results = await generateIconVariants(config, variantCount);

      return NextResponse.json({
        svgs: results.map(r => r.svg),
        metadata: {
          fewShotExamples: results[0]?.fewShotExamples || [],
          decomposition: results[0]?.decomposition || null,
          decompositionSource: results[0]?.decompositionSource || 'none',
          tokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
          variantCount: results.length,
        },
        // F1: Style compliance for all variants
        compliance: results.map(r => r.compliance ? {
          passed: r.compliance.passed,
          score: r.compliance.score,
          violationCount: r.compliance.violations.length,
          changesApplied: r.compliance.changes.length,
        } : undefined),
      });
    }
  } catch (error) {
    console.error('[API] Generation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error types
    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { error: 'API key not configured', details: errorMessage },
        { status: 500 }
      );
    }

    if (errorMessage.includes('Quota') || errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'API quota exceeded', details: 'Please wait and try again' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Generation failed', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/generate-svg',
    description: 'Generate SVG icons that match an ingested library style',
    methods: ['POST'],
    requiredFields: ['concept'],
    optionalFields: ['description', 'libraryId', 'options'],
    options: {
      fewShotCount: '1-8 (default: 4)',
      decompositionMode: 'static | dynamic | auto (default: auto)',
      includePatternLibrary: 'boolean (default: true)',
      temperature: '0-1 (default: 0.2)',
      variants: '1-5 (default: 1)',
    },
  });
}
