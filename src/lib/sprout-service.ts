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

  return `You are a Senior SVG Engineer performing a STYLE TRANSFER operation.

## YOUR TASK
Transform the SOURCE SVG to match the TARGET STYLE RULES while preserving the exact geometric meaning.

## SOURCE SVG (from ${sourceWidth}x${sourceHeight} grid)
\`\`\`svg
${optimizedSvg}
\`\`\`

## TARGET STYLE RULES (Library Manifest)
\`\`\`
${styleManifest || 'Default: 24x24 grid, stroke-width="2", stroke-linecap="round", stroke-linejoin="round", no fill'}
\`\`\`

## TRANSFORMATION REQUIREMENTS

1. **READ THE MANIFEST** to identify:
   - Target grid size (usually 24x24)
   - Stroke width (e.g., 2px, 1.5px)
   - Line caps (round, square, butt)
   - Line joins (round, bevel, miter)
   - Fill style (none for stroke-based, currentColor for filled)

2. **REMAP COORDINATES** to the target grid:
   - Scale from ${sourceWidth}x${sourceHeight} → 24x24
   - Center the icon with ~2px padding on all sides (content in 2-22 range)
   - **CRITICAL:** Do NOT use transform="" attributes - bake all math into the d="" values

3. **PRESERVE STRUCTURE**:
   - If the source has multiple paths for semantic reasons (e.g., pause button = 2 bars), keep them separate
   - If paths are just split for no reason, you may merge them
   - Convert shapes (rect, circle, line) to path if needed for consistency

4. **APPLY STYLE ATTRIBUTES** from the manifest:
   - Set correct stroke-width, stroke-linecap, stroke-linejoin
   - Use fill="none" for stroke-based libraries
   - Use stroke="currentColor" for flexibility

## OUTPUT FORMAT
Return ONLY a valid SVG element. No explanation, no markdown fences, no extra text.

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- paths here -->
</svg>`;
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
