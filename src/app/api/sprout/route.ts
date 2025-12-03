/**
 * API Route: Sprout - SVG Style Transfer Engine
 * Sprint 10-A: The Sprout Engine
 *
 * POST /api/sprout
 * Transpiles an SVG from one style to another using LLM-based code refactoring.
 *
 * Body (JSON):
 *   sourceSvg: string       // Complete SVG markup from source library
 *   libraryId: string       // Target library ID (to fetch styleManifest)
 *   concept?: string        // Optional: what the icon represents
 *   styleManifest?: string  // Optional: override manifest (if not using libraryId)
 *   apiKey?: string         // Optional: user's API key
 *
 * Response:
 *   svg: string             // Transpiled SVG in target style
 *   success: boolean
 *   metadata: object        // Processing details
 */

import { NextRequest, NextResponse } from 'next/server';
import { sproutIcon, SproutConfig } from '@/lib/sprout-service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      sourceSvg,
      libraryId,
      concept,
      styleManifest: providedManifest,
      apiKey,
    } = body;

    // Validate required fields
    if (!sourceSvg) {
      return NextResponse.json(
        { error: 'Missing required field: sourceSvg', success: false },
        { status: 400 }
      );
    }

    // Resolve style manifest
    // In a full implementation, we'd fetch this from the library storage
    // For now, accept it as a parameter or use a default
    let styleManifest = providedManifest || '';

    // If libraryId provided but no manifest, we could fetch from DB
    // This is a placeholder for the integration
    if (libraryId && !styleManifest) {
      console.log(`[Sprout API] libraryId=${libraryId} but no manifest provided, using default`);
      // TODO: Fetch from storage: const library = await getLibrary(libraryId);
      // styleManifest = library?.styleManifest || '';
    }

    console.log(`[Sprout API] Request: concept="${concept || 'unknown'}", svg=${sourceSvg.length} chars`);
    console.log(`[Sprout API] Source SVG preview: ${sourceSvg.substring(0, 300)}...`);

    // Build config and call service
    const config: SproutConfig = {
      sourceSvg,
      styleManifest,
      conceptName: concept,
      apiKey,
    };

    const result = await sproutIcon(config);

    if (!result.success) {
      console.error(`[Sprout API] Failed: ${result.error}`);
      return NextResponse.json(
        {
          error: result.error || 'Sprout failed',
          success: false,
          metadata: result.metadata,
        },
        { status: 500 }
      );
    }

    console.log(`[Sprout API] Success: ${result.metadata.processingTimeMs}ms, compliance=${result.metadata.complianceScore}`);

    return NextResponse.json({
      svg: result.svg,
      success: true,
      originalSource: concept || 'external',
      metadata: result.metadata,
    });

  } catch (error) {
    console.error('[Sprout API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('API key')) {
      return NextResponse.json(
        { error: 'API key not configured', success: false },
        { status: 400 }
      );
    }

    if (errorMessage.includes('Quota') || errorMessage.includes('429')) {
      return NextResponse.json(
        { error: 'API quota exceeded', success: false },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/sprout',
    description: 'SVG Style Transfer Engine - transpiles icons from one style to another',
    methods: ['POST'],
    bodyFormat: 'JSON',
    requiredFields: ['sourceSvg'],
    optionalFields: ['libraryId', 'concept', 'styleManifest', 'apiKey'],
    features: [
      'Token optimization (reduces coordinates to 1 decimal place)',
      'Style manifest parsing (LLM extracts rules from manifest)',
      'Multi-path preservation (keeps semantic structure)',
      'Iron Dome post-processing (ensures style compliance)',
    ],
    version: '10-A',
  });
}
