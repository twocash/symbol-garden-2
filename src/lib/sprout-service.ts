/**
 * Sprout Service - SVG Code Transpilation Engine
 * Sprint 10-A: The Sprout Engine
 *
 * Core philosophy: "Sprout" is a Code Refactoring Engine.
 * It takes "Source Code" (SVG from external libraries) and "Refactors" it
 * to match a "Style Guide" (the Library's Style Manifest).
 *
 * Key insight from Sprint 09-A: LLMs are better at "refactoring code" than
 * "tracing images". We send the actual SVG markup, not rendered pixels.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { optimizeSvgForLlm, extractSvgInnerContent } from './svg-optimizer';
import { SVGProcessor, createProfileFromRules, GENERATION_PROFILE } from './svg-processor';
import { rulesFromStyleDNA } from './style-enforcer';
import { parseStyleDNA } from './svg-prompt-builder';

export interface SproutConfig {
  sourceSvg: string;        // Complete SVG markup from source library
  styleManifest: string;    // Target library's Style DNA
  conceptName?: string;     // Optional: what the icon represents (for logging)
  apiKey?: string;          // Optional: user's API key
}

export interface SproutResult {
  svg: string;              // Transpiled SVG in target style
  success: boolean;
  metadata: {
    originalSource: string;
    originalViewBox: string;
    tokensSaved: number;    // How much the optimizer reduced
    processingTimeMs: number;
    ironDomeModified: boolean;
    complianceScore: number | null;
  };
  error?: string;
}

/**
 * Build the Sprout prompt for style-aware code transpilation
 *
 * Key improvements over Sprint 09-A tracer:
 * 1. Sends full SVG content (not just concatenated paths)
 * 2. LLM reads the style manifest to extract rules
 * 3. Preserves multi-path semantics where appropriate
 */
function buildSproutPrompt(
  optimizedSvg: string,
  sourceViewBox: string,
  styleManifest: string
): string {
  // Parse source viewBox
  const vbParts = sourceViewBox.split(' ').map(Number);
  const sourceWidth = vbParts[2] || 24;
  const sourceHeight = vbParts[3] || 24;

  // Check if source is already 24x24 (no coordinate conversion needed)
  const isAlready24x24 = sourceWidth === 24 && sourceHeight === 24;

  if (isAlready24x24) {
    // Simplified prompt - just apply style, preserve paths EXACTLY
    return `Apply style attributes to this SVG. Keep ALL path d="" values EXACTLY as-is.

## SOURCE SVG (already 24x24)
${optimizedSvg}

## TARGET STYLE
${styleManifest || 'stroke-width="2", stroke-linecap="round", stroke-linejoin="round", fill="none"'}

## CRITICAL RULES
- Copy ALL <path d="..."> values EXACTLY - do not modify coordinates
- Only change: stroke-width, stroke-linecap, stroke-linejoin, fill attributes
- Keep multiple paths separate
- Do NOT add <g>, transform, or modify any coordinates

## OUTPUT (SVG only, no explanation)
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">[paths exactly as source]</svg>`;
  }

  // Full conversion prompt for non-24x24 sources
  const scaleX = 20 / sourceWidth;
  const scaleY = 20 / sourceHeight;

  return `Convert this SVG to a 24x24 stroke-based icon while preserving EVERY detail exactly.

## SOURCE SVG (from ${sourceWidth}x${sourceHeight} grid)
${optimizedSvg}

## TARGET STYLE
${styleManifest || 'stroke-width="2", stroke-linecap="round", stroke-linejoin="round", fill="none"'}

## COORDINATE CONVERSION (CRITICAL)
1. Scale ALL coordinates to fit in 20x20 area:
   - Multiply X values by ${scaleX.toFixed(4)}
   - Multiply Y values by ${scaleY.toFixed(4)}
2. Add 2 to ALL coordinates to center (gives 2px padding)
3. VALIDATION: Every X and Y in output must be between 2 and 22

## RULES
- Do NOT use <g> or transform="" - recalculate d="" values directly
- Preserve EVERY path, curve, and shape from the source
- Keep multiple paths separate (do not merge)
- Use stroke="currentColor", fill="none"
- Convert circles/rects to paths if needed

## OUTPUT (SVG only, no explanation)
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="..."/></svg>`;
}

/**
 * Extract clean SVG from LLM response
 */
function extractSvgFromResponse(response: string): string {
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

/**
 * Strip <g transform="..."> wrappers that Iron Dome may incorrectly add
 *
 * Iron Dome's bounds detection doesn't properly account for arc commands,
 * which can cause false "out of bounds" detection and unnecessary transform wrappers.
 * The LLM is instructed to generate coordinates within the 24x24 grid, so we
 * trust the coordinates and strip any transform wrappers.
 */
function stripTransformWrappers(svg: string): string {
  // Match <g transform="translate(...) scale(...)"> wrapper pattern
  // This is the specific pattern Iron Dome's fixSvgBounds adds
  const transformWrapperPattern = /<g\s+transform="translate\([^)]+\)\s*scale\([^)]+\)">\s*([\s\S]*?)\s*<\/g>/g;

  let result = svg;
  let match;

  while ((match = transformWrapperPattern.exec(svg)) !== null) {
    // Replace the wrapper with just its contents
    result = result.replace(match[0], match[1].trim());
    console.log('[Sprout] Stripped transform wrapper from output');
  }

  return result;
}

/**
 * Main Sprout function - transpile an icon from one style to another
 */
export async function sproutIcon(config: SproutConfig): Promise<SproutResult> {
  const startTime = Date.now();
  const { sourceSvg, styleManifest, conceptName = 'icon' } = config;

  // Resolve API key
  const apiKey = config.apiKey || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      svg: '',
      success: false,
      metadata: {
        originalSource: sourceSvg.substring(0, 100),
        originalViewBox: '0 0 24 24',
        tokensSaved: 0,
        processingTimeMs: Date.now() - startTime,
        ironDomeModified: false,
        complianceScore: null,
      },
      error: 'API key not configured',
    };
  }

  try {
    // Step 1: Optimize SVG for LLM (Token Optimizer)
    console.log(`[Sprout] Starting transpilation for "${conceptName}"`);
    const { optimized, viewBox, originalLength, optimizedLength } = optimizeSvgForLlm(sourceSvg);
    const tokensSaved = originalLength - optimizedLength;
    console.log(`[Sprout] Token optimization: ${originalLength} → ${optimizedLength} chars (saved ${tokensSaved})`);

    // Step 2: Build the prompt
    const prompt = buildSproutPrompt(optimized, viewBox, styleManifest);
    console.log(`[Sprout] Prompt length: ${prompt.length} chars`);

    // Step 3: Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    console.log(`[Sprout] Calling Gemini 2.5 Flash...`);
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.1, // Low temperature for precise transformation
        maxOutputTokens: 16384, // Gemini 2.5 thinking tokens consume output budget
      },
    });

    // Step 4: Process response
    const response = result.response;
    const finishReason = response.candidates?.[0]?.finishReason;
    console.log(`[Sprout] Finish reason: ${finishReason}`);

    if (finishReason === 'SAFETY') {
      return {
        svg: '',
        success: false,
        metadata: {
          originalSource: sourceSvg.substring(0, 100),
          originalViewBox: viewBox,
          tokensSaved,
          processingTimeMs: Date.now() - startTime,
          ironDomeModified: false,
          complianceScore: null,
        },
        error: 'Response blocked by safety filters',
      };
    }

    const responseText = response.text();
    if (!responseText || responseText.length === 0) {
      return {
        svg: '',
        success: false,
        metadata: {
          originalSource: sourceSvg.substring(0, 100),
          originalViewBox: viewBox,
          tokensSaved,
          processingTimeMs: Date.now() - startTime,
          ironDomeModified: false,
          complianceScore: null,
        },
        error: 'Model returned empty response',
      };
    }

    // Step 5: Extract and validate SVG
    let svg = extractSvgFromResponse(responseText);
    console.log(`[Sprout] Extracted SVG: ${svg.substring(0, 200)}...`);

    if (!isValidSvg(svg)) {
      return {
        svg: '',
        success: false,
        metadata: {
          originalSource: sourceSvg.substring(0, 100),
          originalViewBox: viewBox,
          tokensSaved,
          processingTimeMs: Date.now() - startTime,
          ironDomeModified: false,
          complianceScore: null,
        },
        error: 'Generated output is not valid SVG',
      };
    }

    // Step 6: Process through Iron Dome for final compliance
    const rules = styleManifest
      ? rulesFromStyleDNA(parseStyleDNA(styleManifest))
      : GENERATION_PROFILE;

    const profile = createProfileFromRules(rules, 'generate');
    const processResult = SVGProcessor.process(svg, 'generate', profile);

    svg = processResult.svg;

    // Step 7: Strip any <g transform="..."> wrappers that Iron Dome may have added
    // Iron Dome's bounds fix incorrectly adds transforms for arcs (arc bounding is complex)
    // The LLM-generated coordinates should already be within bounds per our prompt
    svg = stripTransformWrappers(svg);

    const processingTime = Date.now() - startTime;
    console.log(`[Sprout] Complete in ${processingTime}ms`);
    console.log(`[Sprout] Iron Dome: ${processResult.modified ? 'MODIFIED' : 'UNCHANGED'}`);
    if (processResult.compliance) {
      console.log(`[Sprout] Compliance: ${processResult.compliance.passed ? 'PASS' : 'FAIL'} (${processResult.compliance.score}/100)`);
    }

    return {
      svg,
      success: true,
      metadata: {
        originalSource: sourceSvg.substring(0, 100),
        originalViewBox: viewBox,
        tokensSaved,
        processingTimeMs: processingTime,
        ironDomeModified: processResult.modified,
        complianceScore: processResult.compliance?.score || null,
      },
    };

  } catch (error) {
    console.error('[Sprout] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      svg: '',
      success: false,
      metadata: {
        originalSource: sourceSvg.substring(0, 100),
        originalViewBox: '0 0 24 24',
        tokensSaved: 0,
        processingTimeMs: Date.now() - startTime,
        ironDomeModified: false,
        complianceScore: null,
      },
      error: errorMessage,
    };
  }
}

/**
 * Batch sprout multiple icons (for future use)
 */
export async function sproutBatch(
  configs: SproutConfig[],
  concurrency: number = 3
): Promise<SproutResult[]> {
  const results: SproutResult[] = [];

  // Process in batches to avoid rate limiting
  for (let i = 0; i < configs.length; i += concurrency) {
    const batch = configs.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(sproutIcon));
    results.push(...batchResults);
  }

  return results;
}
