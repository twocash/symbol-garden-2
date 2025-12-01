/**
 * API Route: Generate Tracer - SVG Path Transpilation
 *
 * Sprint 09-A: The Tracer Spike (Pivot to Code Transpilation)
 *
 * PIVOT: Instead of Vision-based tracing (which failed), we now use
 * "Code Transpilation" - treating SVG paths as source code to be refactored.
 *
 * The insight: LLMs are better at "refactoring code" than "tracing images".
 * We have the actual path data, so we give the model the "source code"
 * instead of asking it to guess from pixels.
 *
 * POST /api/generate-tracer
 * Body (JSON):
 *   structurePath: string      // The raw SVG path d attribute
 *   structureViewBox: string   // Original viewBox (e.g., "0 0 512 512")
 *   structureSource: string    // "fontawesome:brain" (for attribution)
 *   styleManifest?: string     // Library's Style DNA
 *   apiKey?: string            // Optional user API key
 *
 * Response:
 *   svg: string               // Generated SVG in target style
 *   structureSource: string   // Echo back for UI display
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SVGProcessor, createProfileFromRules, GENERATION_PROFILE } from '@/lib/svg-processor';
import { rulesFromStyleDNA } from '@/lib/style-enforcer';
import { parseStyleDNA } from '@/lib/svg-prompt-builder';

/**
 * Build the Transpiler prompt for code-based path conversion
 *
 * Key insight: We anonymize the input ("Input Geometry" not "Brain")
 * to prevent the model from ignoring the path and generating from memory.
 */
function buildTranspilerPrompt(
  structurePath: string,
  structureViewBox: string
): string {
  // Parse the viewBox to understand the source coordinate system
  const vbParts = structureViewBox.split(' ').map(Number);
  const sourceWidth = vbParts[2] || 24;
  const sourceHeight = vbParts[3] || 24;

  // Calculate scale factors
  const scaleX = 24 / sourceWidth;
  const scaleY = 24 / sourceHeight;

  // Direct prompt with explicit coordinate rules - centered
  return `Convert this SVG path to fit CENTERED in a 24x24 icon grid.

INPUT PATH (from ${sourceWidth}x${sourceHeight} viewBox):
d="${structurePath}"

CONVERSION STEPS:
1. Scale all coordinates to fit in 20x20 area (multiply X by ${(20/sourceWidth).toFixed(4)}, Y by ${(20/sourceHeight).toFixed(4)})
2. Then add 2 to ALL coordinates to center in grid (2-22 usable range)
3. Do NOT use transform/translate - recalculate d="" values directly
4. Keep as stroke (no fill)
5. Preserve every curve and detail exactly

VALIDATION: Every X and Y coordinate in output must be between 2 and 22.

OUTPUT (svg with path only, no groups):
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="..."/></svg>`;
}

/**
 * Extract clean SVG from LLM response
 */
function extractSvg(response: string): string {
  let svg = response.trim();

  // Remove markdown code fences
  svg = svg.replace(/```svg\n?/g, '').replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

  // Extract just the SVG if there's extra text
  const svgMatch = svg.match(/<svg[\s\S]*?<\/svg>/);
  if (svgMatch) {
    svg = svgMatch[0];
  }

  return svg;
}

/**
 * Validate SVG structure
 */
function isValidSvg(svg: string): boolean {
  return (
    svg.startsWith('<svg') &&
    svg.endsWith('</svg>') &&
    svg.includes('viewBox') &&
    (svg.includes('<path') || svg.includes('<circle') || svg.includes('<rect') || svg.includes('<line'))
  );
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse JSON body (no longer FormData - simpler without image)
    const body = await req.json();

    const {
      structurePath,
      structureViewBox = '0 0 24 24',
      structureSource,
      styleManifest,
      apiKey: clientApiKey,
    } = body;

    // Validate required fields
    if (!structurePath) {
      return NextResponse.json(
        { error: 'Missing required field: structurePath' },
        { status: 400 }
      );
    }

    // Resolve API key
    const apiKey = clientApiKey || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured', details: 'Please set your Google API key in System Settings' },
        { status: 400 }
      );
    }

    console.log(`[Transpiler] Starting transpilation from ${structureSource}`);
    console.log(`[Transpiler] Source viewBox: ${structureViewBox}`);
    console.log(`[Transpiler] Path length: ${structurePath.length} chars`);
    console.log(`[Transpiler] Path preview: ${structurePath.substring(0, 100)}...`);

    // Build the transpiler prompt
    const prompt = buildTranspilerPrompt(structurePath, structureViewBox);
    console.log(`[Transpiler] Prompt length: ${prompt.length} chars`);

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Generate with text-only input (no image!)
    console.log(`[Transpiler] Calling Gemini 2.5 Flash (text-only, no vision)`);
    let result;
    try {
      result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1, // Low temperature for precise math
          maxOutputTokens: 16384, // Increased - Gemini 2.5 uses thinking tokens that count against this
        },
      });
      console.log(`[Transpiler] Gemini API call completed`);
    } catch (apiError) {
      console.error(`[Transpiler] Gemini API error:`, apiError);
      const errorMsg = apiError instanceof Error ? apiError.message : String(apiError);
      return NextResponse.json(
        { error: 'Gemini API error', details: errorMsg },
        { status: 500 }
      );
    }

    // Check response
    const response = result.response;
    console.log(`[Transpiler] Response candidates:`, response.candidates?.length || 0);
    console.log(`[Transpiler] Finish reason:`, response.candidates?.[0]?.finishReason || 'UNKNOWN');

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      console.error(`[Transpiler] Response blocked by safety filters`);
      return NextResponse.json(
        { error: 'Generation blocked', details: 'Response blocked by safety filters.' },
        { status: 400 }
      );
    }

    const responseText = response.text();

    if (!responseText || responseText.length === 0) {
      console.error(`[Transpiler] Empty response from model`);
      return NextResponse.json(
        { error: 'Generation failed', details: 'Model returned empty response.' },
        { status: 500 }
      );
    }

    let svg = extractSvg(responseText);

    console.log(`[Transpiler] Raw response length: ${responseText.length}`);
    console.log(`[Transpiler] Extracted SVG length: ${svg.length}`);
    console.log(`[Transpiler] SVG preview: ${svg.substring(0, 300)}...`);

    // Validate basic SVG structure
    if (!isValidSvg(svg)) {
      console.error(`[Transpiler] Invalid SVG generated: ${svg.substring(0, 200)}...`);
      return NextResponse.json(
        { error: 'Generation failed', details: 'Generated output is not valid SVG' },
        { status: 500 }
      );
    }

    // Process through Iron Dome for style compliance
    const rules = styleManifest
      ? rulesFromStyleDNA(parseStyleDNA(styleManifest))
      : GENERATION_PROFILE;

    const profile = createProfileFromRules(rules, 'generate');
    const processResult = SVGProcessor.process(svg, 'generate', profile);

    svg = processResult.svg;

    const processingTime = Date.now() - startTime;
    console.log(`[Transpiler] Complete in ${processingTime}ms`);
    console.log(`[Transpiler] Iron Dome: ${processResult.modified ? 'MODIFIED' : 'UNCHANGED'}`);
    if (processResult.compliance) {
      console.log(`[Transpiler] Style compliance: ${processResult.compliance.passed ? 'PASS' : 'FAIL'} (Score: ${processResult.compliance.score}/100)`);
    }

    return NextResponse.json({
      svg,
      structureSource,
      metadata: {
        processingTimeMs: processingTime,
        ironDomeModified: processResult.modified,
        complianceScore: processResult.compliance?.score || null,
        approach: 'transpiler', // Track which approach was used
      },
    });
  } catch (error) {
    console.error('[Transpiler] Generation error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
    endpoint: '/api/generate-tracer',
    description: 'SVG Path Transpilation - converts path data between coordinate systems and styles',
    methods: ['POST'],
    bodyFormat: 'JSON',
    requiredFields: ['structurePath'],
    optionalFields: ['structureViewBox', 'structureSource', 'styleManifest', 'apiKey'],
    notes: [
      'Pivoted from Vision to Code Transpilation approach',
      'Treats SVG paths as "source code" to be refactored',
      'No image processing - pure text-to-text transformation',
      'Uses gemini-2.5-flash for code generation',
    ],
  });
}
