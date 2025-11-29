/**
 * API Route: Index Components
 *
 * Part of the Sprout Engine (F3) - Component Indexer
 *
 * Analyzes icons to identify their semantic components (body, head, modifier, etc.)
 * This enables the Kitbash Engine (F4) to assemble icons from existing parts.
 *
 * POST /api/index-components
 * Body: {
 *   icons: Icon[],           // Icons to analyze
 *   apiKey?: string,         // Optional API key (falls back to env)
 * }
 *
 * Response: {
 *   results: Array<{
 *     iconId: string,
 *     iconName: string,
 *     components: IconComponent[],
 *     componentSignature: string,
 *     complexity: 'simple' | 'moderate' | 'complex',
 *   }>,
 *   stats: {
 *     iconsProcessed: number,
 *     totalComponents: number,
 *     uniqueComponentNames: number,
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Icon } from '@/types/schema';
import { indexIcon, IconComponentIndex } from '@/lib/component-indexer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { icons, apiKey } = body;

    if (!icons || !Array.isArray(icons) || icons.length === 0) {
      return NextResponse.json(
        { error: 'No icons provided' },
        { status: 400 }
      );
    }

    console.log(`[API] Indexing components for ${icons.length} icons`);

    const results: IconComponentIndex[] = [];
    const allComponentNames = new Set<string>();
    let totalComponents = 0;

    for (let i = 0; i < icons.length; i++) {
      const icon = icons[i] as Icon;

      try {
        const index = await indexIcon(icon, apiKey);
        results.push(index);

        for (const comp of index.components) {
          allComponentNames.add(comp.name);
          totalComponents++;
        }

        console.log(`[API] Indexed ${icon.name}: ${index.components.length} components (${index.complexity})`);
      } catch (error) {
        console.error(`[API] Error indexing ${icon.name}:`, error);
        // Continue with other icons
      }

      // Rate limiting
      if (i < icons.length - 1 && apiKey) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return NextResponse.json({
      results,
      stats: {
        iconsProcessed: results.length,
        totalComponents,
        uniqueComponentNames: allComponentNames.size,
      },
    });
  } catch (error) {
    console.error('[API] Component indexing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Component indexing failed', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/index-components',
    description: 'Analyze icons to identify their semantic components for the Sprout Engine',
    methods: ['POST'],
    requiredFields: ['icons'],
    optionalFields: ['apiKey'],
    componentCategories: [
      'body - Main shape (user torso, document rectangle)',
      'head - Top element (user head, arrow point)',
      'modifier - Badge, indicator, status symbol',
      'container - Enclosing shape (circle, shield, square)',
      'indicator - Check, x, plus, minus, arrow',
      'detail - Internal lines, decorative elements',
      'connector - Lines joining other elements',
    ],
  });
}
