import { VertexAI } from '@google-cloud/vertexai';
import sharp from 'sharp';
import { promisify } from 'util';
// @ts-ignore
const potrace = require('potrace');
import { optimizeSvg } from './svg-optimizer';
import { convertSvgToPng } from './image-converter';
import { StyleSummary } from './style-analysis';
import { StyleJuryService } from './style-jury-service';
const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = 'us-central1';
const STANDARD_MODEL = 'imagen-3.0-generate-001';

// V10 NEGATIVE PROMPT: "Anti-Solid" Focus
const NEGATIVE_PROMPT = "solid fill, silhouette, filled circle, color, orange, red, blue, gray, shading, gradient, texture, realistic, photo, 3d, sketch, pencil, complex, background, border, frame";

const trace = promisify(potrace.trace) as (buffer: Buffer, options?: any) => Promise<string>;

export async function vectorizeImage(
    imageBuffer: Buffer,
    fillStrategy: 'FILLED' | 'OUTLINED' = 'FILLED',
    options: number | { visualWeight: number, targetFillRatio?: number, targetGrid?: number } = 10
): Promise<string> {
    const targetVisualWeight = typeof options === 'number' ? options : options.visualWeight;
    const targetFillRatio = typeof options === 'number' ? 0.85 : (options.targetFillRatio || 0.85);
    const targetGridSize = typeof options === 'number' ? 24 : (options.targetGrid || 24);

    try {
        console.log(`Vectorizing V10 (Weight: ${targetVisualWeight.toFixed(1)}%, Grid: ${targetGridSize})...`);

        const isBold = targetVisualWeight > 12;

        // 1. PREPROCESS: The "Ink Extraction" Pipeline
        // We need to process at a moderate resolution (1024) to keep lines solid.
        // 2048 was too high (caught noise), 512 is too low (loses shape).

        const processRes = 1024;

        // Blur/Threshold logic to manage line weight
        const blurSigma = isBold ? 2.0 : 1.0;
        const thresholdLevel = 90; // Lowered to 90 to aggressively remove fine details (replaces gamma 0.6)

        // Initial Load & Grayscale
        let pipeline = sharp(imageBuffer)
            .resize(processRes, processRes, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .grayscale();

        // SAFETY CROP: Remove the outer 10 pixels to kill the "Square Border" artifact
        // This fixes the bug where Potrace traces the image frame.
        const metadata = await pipeline.metadata();
        const w = metadata.width || processRes;
        const h = metadata.height || processRes;
        const margin = 10;
        pipeline = pipeline.extract({ left: margin, top: margin, width: w - (margin * 2), height: h - (margin * 2) });

        // Continue Processing
        const cleanBuffer = await pipeline
            .resize(processRes, processRes, { fit: 'contain', background: { r: 255, g: 255, b: 255 } }) // Pad back to full size
            .resize(processRes, processRes, { fit: 'contain', background: { r: 255, g: 255, b: 255 } }) // Pad back to full size
            // .gamma(0.6) removed: sharp requires 1.0-3.0 range. Lowered threshold achieves same "wash out" effect.
            .blur(blurSigma) // Dilate lines (make them thicker)
            .threshold(thresholdLevel) // Cut to pure B&W
            .toBuffer();

        // 3. SCALE NORMALIZATION
        const trimmed = sharp(cleanBuffer).trim();
        const CANVAS_SIZE = 1024;
        const targetDimension = Math.round(CANVAS_SIZE * targetFillRatio);

        const resizedContent = await trimmed
            .resize({
                width: targetDimension,
                height: targetDimension,
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .toBuffer();

        const processedBuffer = await sharp({
            create: { width: CANVAS_SIZE, height: CANVAS_SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } }
        })
            .composite([{ input: resizedContent }])
            .toFormat('png')
            .toBuffer();

        // 4. TRACE
        const params = {
            threshold: 128,
            optCurve: true,
            alphaMax: 0.5,  // Balanced: 0.2 was too jagged, 1.0 was too round. 0.5 is Lineicons style.
            turdSize: 100,
            optTolerance: 0.2,
            blackOnWhite: true
        };

        const rawSvg = await trace(processedBuffer, params);

        // 5. OPTIMIZE
        try {
            return await optimizeSvg(rawSvg, targetGridSize);
        } catch (optError) {
            console.error("Optimization failed, using manual fallback:", optError);

            const scale = (targetGridSize / CANVAS_SIZE).toFixed(5);
            let scaledSvg = rawSvg
                .replace(/width=".*?"/, `width="256"`)
                .replace(/height=".*?"/, `height="256"`)
                .replace(/viewBox=".*?"/, `viewBox="0 0 ${targetGridSize} ${targetGridSize}"`);

            if (!scaledSvg.includes('transform=')) {
                scaledSvg = scaledSvg.replace('<path d="', `<g transform="scale(${scale})"><path d="`).replace('"/>', '"/></g>');
            }
            return scaledSvg;
        }

    } catch (error) {
        console.error('Vectorization failed:', error);
        throw error;
    }
}

// [analyzeStyleReferences remains the same]
async function analyzeStyleReferences(styleReferences: Buffer[], libraryHint?: string) {
    try {
        const { calculateVisualWeight, calculateFillRatio } = await import('./style-analysis');
        let totalWeight = 0;
        for (const buf of styleReferences) totalWeight += await calculateVisualWeight(buf);
        const weight = styleReferences.length ? totalWeight / styleReferences.length : 10;

        return {
            closestLibraryMatch: libraryHint || "Lineicons",
            fillStrategy: "OUTLINED",
            styleProfile: "Bold geometric outline",
            consistencyInstructions: "No fills",
            visualWeight: weight,
            targetFillRatio: 0.85,
            targetGrid: 24
        };
    } catch (e) {
        return { fillStrategy: "OUTLINED", visualWeight: 15, targetGrid: 24 } as any;
    }
}

/**
 * V9 PROMPT: "FIXED WIDTH"
 * Forces the AI to simulate a single brush size, killing flourishes.
 */
/**
 * V10 PROMPT: "INK FIRST"
 * We place the style constraints BEFORE the subject to override object bias.
 */
/**
 * V10 PROMPT: "INK FIRST"
 * We place the style constraints BEFORE the subject to override object bias.
 */
export async function askGeminiToWriteImagenPrompt(
    userSubject: string,
    styleAnalysis: any
): Promise<string> {
    try {
        const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const vertex_ai = new VertexAI({ project: project, location: location });
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const weight = styleAnalysis.visualWeight || 10;
        const isBold = weight > 12;
        const manifest = styleAnalysis.styleManifest || "";

        let styleInstruction = "";
        if (manifest) {
            styleInstruction = `
    CRITICAL STYLE SOURCE (THE DNA):
    "${manifest}"
    
    INSTRUCTIONS:
    1. Read the "Stroke Architecture" and "Grid System" from the DNA above.
    2. Apply those EXACT constraints to the "${userSubject}".
    3. If the DNA says "Squared Terminals", explicitly demand "Butt Caps" in the prompt.
    4. If the DNA says "2px Radius", explicitly demand "Small rounded corners".
            `;
        } else {
            // Fallback to V10 "Ink First" logic if no manifest
            styleInstruction = `
    STYLE DEFINITION:
    1. TYPE: "Black and White Vector Line Art".
    2. WEIGHT: ${isBold ? "Thick, bold, heavy marker strokes" : "Uniform medium strokes"}.
    3. FILL: "Hollow Interior". "No Fill". "White Negative Space".
    4. CONSTRUCTION: "Geometric". "Technical". "Icon".
            `;
        }

        const systemInstruction = `
    Act as a Technical Illustrator.
    
    TASK: Write a prompt for Imagen 3.
    
    CRITICAL RULE: You must describe the STYLE first, then the SUBJECT.
    
    TARGET: "${userSubject}"
    
    ${styleInstruction}
    
    AVOID:
    - "Basketball" (Alone) -> Generates Orange Ball.
    - "Silhouette" -> Generates Solid Ball.
    
    OUTPUT FORMAT:
    Return ONLY the raw prompt. Start with "Black and white line art..."
        `;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
        });

        const prompt = result.response.candidates?.[0].content.parts[0].text?.trim() || "";
        console.log('[AI Icon Service] 🤖 Generated V11 Prompt:', prompt);
        return prompt;

    } catch (error) {
        return `black and white line art icon of ${userSubject}, thick stroke, white background, no fill`;
    }
}

export async function generateIconVariants(
    prompt: string,
    styleReferences: Buffer[],
    styleSummary?: StyleSummary,
    styleStrictness: number = 50,
    libraryHint?: string,
    guidanceScale: number = 50,
    useMetaPrompt: boolean = true
) {
    console.log("!!! 🟢 CLONER LOGIC V10 - INK FIRST LOADED 🟢 !!!");

    try {
        const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
        if (!project) throw new Error("GOOGLE_CLOUD_PROJECT_ID not set.");

        let styleAnalysis = {
            fillStrategy: "OUTLINED",
            visualWeight: 10,
            targetFillRatio: 0.85,
            targetGrid: 24
        } as any;

        if (styleReferences && styleReferences.length > 0) {
            styleAnalysis = await analyzeStyleReferences(styleReferences, libraryHint);
        }
        styleAnalysis.fillStrategy = "OUTLINED";

        let finalPrompt: string;
        if (useMetaPrompt) {
            finalPrompt = await askGeminiToWriteImagenPrompt(prompt, styleAnalysis);
        } else {
            finalPrompt = `black and white line art of ${prompt}, thick outline`;
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 FULL IMAGEN 3 PROMPT:', finalPrompt);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${STANDARD_MODEL}:predict`;

        const requestBody = {
            instances: [{ prompt: finalPrompt }],
            parameters: {
                sampleCount: 4,
                personGeneration: "dont_allow",
                negativePrompt: NEGATIVE_PROMPT,
                aspectRatio: "1:1",
                guidanceScale: guidanceScale
            }
        };

        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        // Helper to run a single batch
        const generateBatch = async (): Promise<Buffer[]> => {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AI Service] Batch generation failed: ${errorText}`);
                throw new Error(errorText);
            }
            const result = await response.json();

            const images: Buffer[] = [];
            if (result.predictions) {
                for (const prediction of result.predictions) {
                    if (prediction.bytesBase64Encoded) {
                        images.push(Buffer.from(prediction.bytesBase64Encoded, 'base64'));
                    }
                }
            }
            return images;
        };

        // Sprint 04: Pipelined Parallelism & Jury
        // Launch 2 batches (Total 8 images) and evaluate in parallel
        const jury = new StyleJuryService();

        // Convert SVG seeds to PNG for the Jury (Gemini Vision needs raster)
        const seeds = styleReferences || [];
        const pngSeeds = await Promise.all(seeds.map(async (svgBuffer) => {
            try {
                return await convertSvgToPng(svgBuffer.toString('utf-8'));
            } catch (e) {
                console.warn("[AI Service] Failed to convert seed SVG to PNG for Jury:", e);
                return null;
            }
        }));
        const validSeeds = pngSeeds.filter(s => s !== null) as Buffer[];

        console.log("[AI Service] 🚀 Launching Parallel Generation Batches...");

        // Pipeline: Generate -> Jury
        const runPipeline = async () => {
            const images = await generateBatch();
            return validSeeds.length > 0
                ? jury.evaluateCandidates(images, validSeeds)
                : images.map((buf, i) => ({ buffer: buf, score: 10, reasoning: "No Seeds", index: i }));
        };

        const results = await Promise.allSettled([runPipeline(), runPipeline()]);

        const allScored = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => (r as PromiseFulfilledResult<any[]>).value);

        if (allScored.length === 0) {
            // If both failed, throw the error from the first one
            const firstError = results.find(r => r.status === 'rejected');
            throw new Error((firstError as PromiseRejectedResult).reason);
        }

        // Sort by score
        const sorted = allScored.sort((a, b) => b.score - a.score);
        const survivors = sorted.map(s => s.buffer);

        return {
            images: survivors, // Return ranked survivors
            strategy: "OUTLINED",
            visualWeight: (styleAnalysis as any).visualWeight || 10,
            targetFillRatio: 0.85,
            targetGrid: 24
        };

    } catch (error) {
        console.error('Generation error:', error);
        throw error;
    }
}
