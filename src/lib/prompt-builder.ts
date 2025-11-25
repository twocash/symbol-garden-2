import { StyleSummary } from './style-analysis';

/**
 * Configuration for building a style-matched generation prompt.
 */
export interface PromptConfig {
    styleSummary: StyleSummary;
    userPrompt: string;
    styleStrictness: number; // 0-100
    referenceCount?: number; // Number of visual references provided
}

/**
 * The "Vector Compiler" System Prompt Template
 * Separates Universal Icon Rules from Dynamic Style Attributes.
 */
const SYSTEM_PROMPT_TEMPLATE = `## ROLE & OBJECTIVE
You are a Senior Iconographer and Vector Specialist. Your goal is to generate a single, high-contrast, "seed image" representing a specific subject. This image will be used for auto-vectorization, so clarity, separation of elements, and flat geometry are critical.

## THE "ICON PHYSICS" (STRICT RULES)
You must adhere to these visual constraints regardless of the subject:
1.  **Dimensionality:** STRICTLY 2D. Flat layout. No 3D rendering, no isometric angles, no tilt. The camera must be perfectly perpendicular to the canvas (0° elevation).
2.  **Lighting:** Absolute flat lighting. No drop shadows, no cast shadows, no gradients, no glossy reflections, no ambient occlusion.
3.  **Color:** Use a high-contrast palette. Ideally, black foreground on a pure white background (#FFFFFF) unless the style injection specifies otherwise.
4.  **Complexity:** Reductionist approach. Remove all "noise." If the subject is a bicycle, do not render the spokes individually; render the *concept* of the wheel. Do not render textures (e.g., no rust, no dirt, no realistic rubber texture).
5.  **Framing:** The subject must be centered with exactly 15% padding on all sides. Do not crop the subject.
6.  **Negative Space:** Ensure clear separation between distinct elements to prevent "blobbing" during vectorization.

## INPUT ANALYSIS
**User Subject:** {USER_INPUT_KEYWORD}
**Style DNA (Derived from Favorites):** {ANALYZED_STYLE_DESCRIPTION}

## GENERATION INSTRUCTION
Synthesize the **User Subject** using the visual language defined in the **Style DNA**.
- If the Style DNA says "Line Art," ensure strokes are uniform width and unclosed shapes are capped.
- If the Style DNA says "Solid/Glyph," ensure shapes are filled and weighty.
- If the Style DNA is "Playful," use rounded corners and exaggerated proportions.
- If the Style DNA is "Technical," use sharp angles and geometric precision.

{strictnessModifier}

**CRITICAL:** Do not generate text, watermarks, or mockups. Output only the raw icon graphic.`;

/**
 * Returns a strictness modifier based on the 0-100 strictness level.
 */
function getStrictnessModifier(strictness: number): string {
    if (strictness <= 33) {
        return `**CREATIVE FLEXIBILITY:** You may deviate slightly from the Style DNA for creative expression, but keep the Icon Physics intact.`;
    } else if (strictness <= 66) {
        return `**STYLE CONSISTENCY:** Follow the Style DNA closely. The new icon should look like it was drawn by the same designer.`;
    } else {
        return `**STRICT MATCHING:** The icon MUST be indistinguishable from the reference set. Do not deviate from the Style DNA.`;
    }
}

/**
 * Generates the Style DNA string from the StyleSummary.
 */
function generateStyleDNA(summary: StyleSummary): string {
    // Map stroke style
    let fillType = "Line Art";
    if (summary.strokeStyle === 'filled') fillType = "Solid/Glyph";
    else if (summary.strokeStyle === 'mixed') fillType = "Hybrid/Duotone";

    // Map stroke weight
    let strokeWeight = "Medium";
    if (summary.avgStrokeWidth < 1.5) strokeWeight = "Hairline";
    else if (summary.avgStrokeWidth > 3.0) strokeWeight = "Thick/Chunky";
    if (summary.strokeStyle === 'filled') strokeWeight = "None";

    // Map corner radius
    let cornerRadius = "Soft/Rounded";
    if (summary.avgCornerRadius < 1.0) cornerRadius = "Sharp/Geometric";
    else if (summary.avgCornerRadius > 8.0) cornerRadius = "Organic/Hand-drawn";

    // Map detail level
    let detailLevel = "Minimal";
    if (summary.detailLevel === 'low') detailLevel = "Abstract/Symbolic";
    else if (summary.detailLevel === 'high') detailLevel = "Illustrative";

    return `${fillType} style, ${strokeWeight} weight (approx ${summary.avgStrokeWidth.toFixed(1)}px), ${cornerRadius} corners, ${detailLevel} construction. Fill usage: ${summary.fillUsage}. Geometry: ${summary.dominantShapes}. Stroke styling: ${summary.strokeCap} caps, ${summary.strokeJoin} joins.`;
}

/**
 * Builds a complete, style-matched wrapper prompt for AI icon generation.
 */
export function buildWrapperPrompt(config: PromptConfig): string {
    const { styleSummary, userPrompt, styleStrictness } = config;

    // Validate inputs
    if (!styleSummary) {
        throw new Error('StyleSummary is required');
    }
    if (!userPrompt || userPrompt.trim().length === 0) {
        throw new Error('User prompt cannot be empty');
    }

    const styleDNA = generateStyleDNA(styleSummary);
    const strictnessModifier = getStrictnessModifier(styleStrictness);

    let prompt = SYSTEM_PROMPT_TEMPLATE
        .replace(/{USER_INPUT_KEYWORD}/g, userPrompt.trim())
        .replace(/{ANALYZED_STYLE_DESCRIPTION}/g, styleDNA)
        .replace(/{strictnessModifier}/g, strictnessModifier);

    // Prepend reference context if references are present
    if (config.referenceCount && config.referenceCount > 0) {
        const prefix = getReferenceContextPrefix(config.referenceCount);
        return prefix + prompt;
    }

    return prompt;
}

/**
 * Generates the reference context prefix for multimodal prompts.
 */
function getReferenceContextPrefix(referenceCount: number): string {
    if (referenceCount <= 0) return '';

    const markers = Array.from({ length: referenceCount }, (_, i) => `[${i + 1}]`).join(', ');

    return `REFERENCE CONTEXT:
The images provided above ${markers} are STYLE REFERENCES ONLY.
- IGNORE the subject matter (e.g., if they show a house, do NOT draw a house).
- ONLY extract: line weight, corner rounding, fill density, geometric style.

TASK:
`;
}

/**
 * Validates that a PromptConfig object has all required fields.
 */
export function validatePromptConfig(config: unknown): config is PromptConfig {
    if (typeof config !== 'object' || config === null) return false;

    const c = config as any;
    return (
        typeof c.styleSummary === 'object' &&
        typeof c.userPrompt === 'string' &&
        typeof c.styleStrictness === 'number' &&
        c.styleStrictness >= 0 &&
        c.styleStrictness <= 100
    );
}

/**
 * Helper function to preview a prompt with sample data.
 */
export function previewPrompt(userPrompt: string, strictness: number = 50): string {
    const sampleSummary: StyleSummary = {
        avgStrokeWidth: 2.0,
        strokeStyle: 'outline',
        strokeCap: 'round',
        strokeJoin: 'round',
        avgCornerRadius: 3.0,
        fillUsage: 'none',
        dominantShapes: 'circles and rounded rectangles',
        detailLevel: 'low',
        confidenceScore: 0.85,
    };

    return buildWrapperPrompt({
        styleSummary: sampleSummary,
        userPrompt,
        styleStrictness: strictness,
    });
}
