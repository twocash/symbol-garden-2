import { VertexAI } from '@google-cloud/vertexai';
import sharp from 'sharp';
import { promisify } from 'util';
// @ts-ignore
const potrace = require('potrace');
import { optimizeSvg } from './svg-optimizer';
import { convertSvgToPng } from './image-converter';
import { StyleSummary } from './style-analysis';

const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = 'us-central1';
const STANDARD_MODEL = 'imagen-3.0-generate-001';

// V9 NEGATIVE PROMPT: Banning "Artistic Flair"
const NEGATIVE_PROMPT = "calligraphy, variable stroke, tapered lines, brush strokes, decorative flourishes, artistic, ornamental, sketch, pencil, texture, noise, shading, gradient, color, photorealistic, 3d, thin, hairline, complex, detailed, filled shape, solid mass, silhouette";

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
        console.log(`Vectorizing V9 (Weight: ${targetVisualWeight.toFixed(1)}%, Grid: ${targetGridSize})...`);

        // 1. PREPROCESS: The "Contrast King" Pipeline (V8 Logic Preserved)
        const isBold = targetVisualWeight > 12;
        const processRes = isBold ? 512 : 1024;

        const cleanBuffer = await sharp(imageBuffer)
            .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .flatten({ background: { r: 255, g: 255, b: 255 } })
            .grayscale()
            .normalize()
            .resize(processRes, processRes, { fit: 'contain' }) // Downsample to thicken
            .gamma(2.2) // Darken mid-tones to solid black (Fixed from 0.5 to 2.2 for sharp range)
            .threshold(128)
            .resize(1024, 1024, { fit: 'contain', kernel: 'nearest' })
            .blur(0.5)
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
            alphaMax: 1.0,
            turdSize: 100,
            optTolerance: 0.2,
            blackOnWhite: true
        };

        const rawSvg = await trace(processedBuffer, params);

        // 5. OPTIMIZE
        try {
            return await optimizeSvg(rawSvg, targetGridSize);
        } catch (optError) {
            console.error("Optimization failed, using fallback:", optError);

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
async function askGeminiToWriteImagenPrompt(
    userSubject: string,
    styleAnalysis: any
): Promise<string> {
    try {
        const vertex_ai = new VertexAI({ project: project, location: location });
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const weight = styleAnalysis.visualWeight || 10;
        const isBold = weight > 12;

        const systemInstruction = `
    Act as a Technical Icon Designer.
    
    TASK: Write a prompt for Imagen 3 for: "${userSubject}".
    
    STRICT CONSTRAINTS (NO FLOURISHES):
    1. TOOL: "Fixed-Width Round Tip Marker". (Use a single brush size for the entire image).
    2. STROKE: ${isBold ? "Constant 20px width" : "Constant 10px width"}. NO Tapering. NO Variable Pressure.
    3. STYLE: "Technical Line Art". Minimalist geometry.
    4. FILLS: NONE. Hollow interior. White negative space.
    5. COLOR: Pure Black ink on White background.
    
    FORBIDDEN:
    - "Calligraphy" (Variable width)
    - "Sketch" (Rough edges)
    - "Hand-drawn" (Imperfect lines)
    - "Silhouette" (Filled shapes)
    
    OUTPUT FORMAT:
    Return ONLY the raw prompt.
        `;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: systemInstruction }] }],
        });

        const prompt = result.response.candidates?.[0].content.parts[0].text?.trim() || "";
        console.log('[AI Icon Service] 🤖 Generated V9 Prompt:', prompt);
        return prompt;

    } catch (error) {
        return `icon of ${userSubject}, fixed width thick black outline, white background, no fill, geometric`;
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
    console.log("!!! 🟢 CLONER LOGIC V9 - FIXED WIDTH MARKER LOADED 🟢 !!!");

    try {
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
            finalPrompt = `icon of ${prompt}, thick fixed width black outline, white background`;
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
                guidanceScale: 60
            }
        };

        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) throw new Error(await response.text());
        const result = await response.json();

        const generatedImages: Buffer[] = [];
        if (result.predictions) {
            for (const prediction of result.predictions) {
                if (prediction.bytesBase64Encoded) {
                    generatedImages.push(Buffer.from(prediction.bytesBase64Encoded, 'base64'));
                }
            }
        }

        if (generatedImages.length === 0) throw new Error('No images generated');

        return {
            images: generatedImages,
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
