/**
 * API Route: Kitbash Engine
 *
 * Part of the Sprout Engine (F4) - Assembly from existing components
 *
 * Two modes:
 * 1. Plan: Analyze concept and return kitbash plan with coverage/strategy
 * 2. Execute: Run the plan to produce an assembled SVG
 *
 * POST /api/kitbash
 * Body: {
 *   mode: 'plan' | 'execute',
 *   concept: string,              // e.g., "secure user"
 *   icons: Icon[],                // Library icons with components indexed
 *   layoutIndex?: number,         // Which layout to use (default: 0)
 *   plan?: KitbashPlan,           // For execute mode, pass previous plan
 * }
 *
 * Response (plan mode): {
 *   plan: KitbashPlan,
 *   formatted: string,            // Human-readable summary
 * }
 *
 * Response (execute mode): {
 *   result: KitbashResult,
 *   svg: string,
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { Icon } from '@/types/schema';
import { IconComponent, buildComponentIndex } from '@/lib/component-indexer';
import {
  planKitbash,
  executeKitbash,
  formatKitbashPlan,
  KitbashPlan,
} from '@/lib/kitbash-engine';
import { rulesFromStyleDNA, rulesFromManifest, FEATHER_RULES } from '@/lib/style-enforcer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, concept, icons, layoutIndex = 0, plan: providedPlan, styleManifest } = body;

    if (!concept || typeof concept !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: concept' },
        { status: 400 }
      );
    }

    if (!icons || !Array.isArray(icons) || icons.length === 0) {
      return NextResponse.json(
        { error: 'No icons provided' },
        { status: 400 }
      );
    }

    // Build component index from icons
    // Note: In production, this should be pre-computed and cached
    const componentIndex = new Map<string, IconComponent[]>();

    for (const icon of icons as Icon[]) {
      if (icon.components && Array.isArray(icon.components)) {
        for (const comp of icon.components) {
          const existing = componentIndex.get(comp.name) || [];
          existing.push(comp);
          componentIndex.set(comp.name, existing);

          // Also index by semantic tags
          for (const tag of comp.semanticTags || []) {
            const tagKey = `tag:${tag}`;
            const tagExisting = componentIndex.get(tagKey) || [];
            tagExisting.push(comp);
            componentIndex.set(tagKey, tagExisting);
          }

          // Index by category
          const catKey = `category:${comp.category}`;
          const catExisting = componentIndex.get(catKey) || [];
          catExisting.push(comp);
          componentIndex.set(catKey, catExisting);
        }
      }
    }

    // Get list of icon names for LLM guidance
    const availableIconNames = (icons as Icon[]).map(i => i.name);

    // Get API key from environment
    const apiKey = process.env.GOOGLE_API_KEY;

    console.log(`[API] Kitbash: ${mode} mode for "${concept}" with ${componentIndex.size} indexed components`);
    console.log(`[API] Kitbash: API key ${apiKey ? 'available' : 'NOT available'}`);

    if (mode === 'plan' || !mode) {
      // Planning mode
      const plan = await planKitbash(concept, componentIndex, apiKey, availableIconNames);
      const formatted = formatKitbashPlan(plan);

      return NextResponse.json({
        plan,
        formatted,
      });
    } else if (mode === 'execute') {
      // Execution mode
      const plan = providedPlan || await planKitbash(concept, componentIndex, apiKey, availableIconNames);

      // Get enforcement rules
      let rules = FEATHER_RULES;
      if (styleManifest) {
        try {
          rules = rulesFromManifest(styleManifest);
        } catch (e) {
          console.warn('[API] Failed to parse style manifest, using defaults');
        }
      }

      const result = await executeKitbash(plan, layoutIndex, rules);

      return NextResponse.json({
        result,
        svg: result.svg,
        plan: result.plan,
        layout: result.layout,
        usedGeneration: result.usedGeneration,
        generatedParts: result.generatedParts,
      });
    } else {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}. Use 'plan' or 'execute'.` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[API] Kitbash error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'Kitbash failed', details: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/kitbash',
    description: 'Assemble icons from existing library components (Sprout Engine F4)',
    methods: ['POST'],
    modes: {
      plan: 'Analyze concept and return assembly plan with coverage/strategy',
      execute: 'Execute plan to produce assembled SVG',
    },
    strategies: {
      graft: '100% parts found - pure mechanical assembly',
      hybrid: 'Some parts found - AI fills gaps',
      adapt: 'Single part found - modify existing',
      generate: 'No parts found - full AI generation needed',
    },
    requiredFields: ['concept', 'icons'],
    optionalFields: ['mode', 'layoutIndex', 'plan', 'styleManifest'],
  });
}
