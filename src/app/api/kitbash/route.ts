/**
 * API Route: Kitbash Engine
 *
 * Part of the Sprout Engine (F4) - Assembly from existing components
 *
 * Three modes:
 * 1. Plan: Analyze concept and return kitbash plan with coverage/strategy
 * 2. Execute: Run the plan to produce an assembled SVG
 * 3. Refine: Polish a draft assembly into a cohesive icon (Sprint 06)
 *
 * POST /api/kitbash
 * Body: {
 *   mode: 'plan' | 'execute' | 'refine',
 *   concept: string,              // e.g., "secure user"
 *   icons: Icon[],                // Library icons with components indexed
 *   layoutIndex?: number,         // Which layout to use (default: 0)
 *   plan?: KitbashPlan,           // For execute mode, pass previous plan
 *   draftSvg?: string,            // For refine mode, the SVG to refine
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
 *
 * Response (refine mode): {
 *   svg: string,                  // Refined SVG
 *   success: boolean,             // Was refinement successful?
 *   changes: string[],            // What was fixed
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
import { refineIcon } from '@/lib/hybrid-generator';
import * as fs from 'fs';
import * as path from 'path';

// Load enriched icons from server-side file (has components with geometricType)
function loadEnrichedIcons(): Icon[] | null {
  try {
    const libPath = path.join(process.cwd(), 'data', 'feather-icons.json');
    if (fs.existsSync(libPath)) {
      const data = fs.readFileSync(libPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[Kitbash] Failed to load enriched icons:', error);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, concept, icons, layoutIndex = 0, plan: providedPlan, styleManifest, apiKey: clientApiKey } = body;

    if (!concept || typeof concept !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: concept' },
        { status: 400 }
      );
    }

    // Resolve API key: user's key from System Settings takes priority, then env var
    const apiKey = clientApiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured', details: 'Please set your Google API key in System Settings' },
        { status: 400 }
      );
    }

    console.log(`[API] Kitbash: ${mode} mode for "${concept}"`);
    console.log(`[API] Kitbash: API key source: ${clientApiKey ? 'user (System Settings)' : 'environment variable'}`);

    // Handle refine mode first - it doesn't need icons
    if (mode === 'refine') {
      const { draftSvg } = body;

      if (!draftSvg || typeof draftSvg !== 'string') {
        return NextResponse.json(
          { error: 'Missing required field: draftSvg for refine mode' },
          { status: 400 }
        );
      }

      console.log(`[API] Kitbash Refinery: Refining "${concept}" (${draftSvg.length} chars)`);

      const result = await refineIcon(draftSvg, {
        concept,
        styleManifest,
        apiKey,
        temperature: 0.1, // Low temperature for precise topology repair
      });

      console.log(`[API] Kitbash Refinery: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.processingTimeMs.toFixed(0)}ms)`);

      return NextResponse.json({
        svg: result.svg,
        success: result.success,
        changes: result.changes,
        processingTimeMs: result.processingTimeMs,
      });
    }

    // For plan and execute modes, icons are required
    if (!icons || !Array.isArray(icons) || icons.length === 0) {
      return NextResponse.json(
        { error: 'No icons provided' },
        { status: 400 }
      );
    }

    // Build component index from icons
    // Prefer server-side enriched icons (have components with geometricType)
    // Fall back to client icons if no enriched data available
    const enrichedIcons = loadEnrichedIcons();
    const iconsToIndex = enrichedIcons || (icons as Icon[]);

    console.log(`[Kitbash] Using ${enrichedIcons ? 'server-side enriched' : 'client-provided'} icons (${iconsToIndex.length} total)`);

    const componentIndex = new Map<string, IconComponent[]>();

    for (const icon of iconsToIndex) {
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

          // Sprint 07: Index by geometric type for Blueprint Protocol
          if (comp.geometricType) {
            const geoKey = `geometric:${comp.geometricType}`;
            const geoExisting = componentIndex.get(geoKey) || [];
            geoExisting.push(comp);
            componentIndex.set(geoKey, geoExisting);
          }
        }
      }
    }

    // Get list of icon names for LLM guidance
    const availableIconNames = (icons as Icon[]).map(i => i.name);

    console.log(`[API] Kitbash: ${componentIndex.size} indexed components from ${icons.length} icons`);

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
        { error: `Invalid mode: ${mode}. Use 'plan', 'execute', or 'refine'.` },
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
      refine: 'Polish draft assembly into cohesive icon (Sprint 06 Refinery)',
    },
    strategies: {
      graft: '100% parts found - pure mechanical assembly',
      hybrid: 'Some parts found - AI fills gaps',
      adapt: 'Single part found - modify existing',
      generate: 'No parts found - full AI generation needed',
    },
    requiredFields: ['concept', 'icons'],
    optionalFields: ['mode', 'layoutIndex', 'plan', 'styleManifest', 'draftSvg'],
  });
}
