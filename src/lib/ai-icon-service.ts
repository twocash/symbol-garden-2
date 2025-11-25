const potrace = require('potrace');
import sharp from 'sharp';
import { VertexAI } from '@google-cloud/vertexai';
import { promisify } from 'util';
import { StyleSummary } from './style-analysis';
import { convertSvgToPng } from './image-converter';
import { optimizeSvg } from './svg-optimizer';

// Initialize Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = 'us-central1';

// Instantiate Imagen 3 model for image generation
const STANDARD_MODEL = 'imagen-3.0-generate-001';
// const CAPABILITY_MODEL = 'imagen-3.0-capability-001'; // Not used in this text-based pipeline

const NEGATIVE_PROMPT = "color, colored, colorful, blue, red, green, yellow, orange, purple, pink, brown, gradient, multi-color, white on black, inverted colors, dark mode, dark background, photorealistic, 3d, three-dimensional, shading, shadow, depth, perspective, blur, noisy, textured, texture, pattern, grain, grunge, sketch, pencil, hand-drawn, watercolor, painting, complex detail, realistic detail, internal detail, segmentation lines, internal lines, text, watermark, frame, border, background shape, container, button, badge, signage, outline stroke, thin lines, fine lines";

const trace = promisify(potrace.trace) as (buffer: Buffer, options?: any) => Promise<string>;

/**
 * Converts a PNG buffer to a true SVG vector path using Potrace.
 * @param imageBuffer The PNG image buffer.
 * @returns A Promise that resolves to the SVG string.
 */
export async function vectorizeImage(
    imageBuffer: Buffer,
    fillStrategy: 'FILLED' | 'OUTLINED' = 'FILLED'
): Promise<string> {
    try {
        console.log(`Vectorizing image with Potrace (Strategy: ${fillStrategy})...`);
        // 1. Preprocess with Sharp
        // We need a high-contrast, monochrome image for Potrace to work best.
        // Upscaling helps Potrace capture finer details.
        console.log('Starting Sharp preprocessing...');
        const processedBuffer = await sharp(imageBuffer)
            .resize(2048, 2048, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }) // 4x upscale
            .flatten({ background: { r: 255, g: 255, b: 255 } }) // Ensure no transparency
            .grayscale()
            .threshold(128) // Higher threshold (128) to ensure thin gray lines become black
            .toFormat('png')
            .toBuffer();
        console.log('Sharp preprocessing complete. Buffer size:', processedBuffer.length);

        // 2. Vectorize with Potrace
        // Dynamic configuration based on fill strategy
        const params = {
            threshold: 128,
            optCurve: true,
            alphaMax: 1,
            // Dynamic params
            turdSize: fillStrategy === 'OUTLINED' ? 2 : 100,       // Very small turdSize for outlines to preserve details
            optTolerance: fillStrategy === 'OUTLINED' ? 0.2 : 0.4, // High precision for outlines
            turnPolicy: 'minority',                                // Default policy is safest
        };

        console.log('Starting Potrace trace with params:', JSON.stringify(params));
        const rawSvg = await trace(processedBuffer, params);
        console.log('Potrace complete. Raw SVG length:', rawSvg.length);

        // 3. Optimize SVG
        console.log('Optimizing SVG with SVGO...');
        const optimizedSvg = optimizeSvg(rawSvg);
        console.log('Optimization complete. Final SVG length:', optimizedSvg.length);

        return optimizedSvg;

    } catch (error) {
        console.error('Vectorization error:', error);
        throw error;
    }
}

/**
 * Analyzes style reference images using Gemini 1.5 Flash.
 * Returns a style profile and consistency instructions.
 */
async function analyzeStyleReferences(
    styleReferences: Buffer[],
    libraryHint?: string
): Promise<{
    styleProfile: string,
    consistencyInstructions: string,
    closestLibraryMatch: string,
    fillStrategy: "FILLED" | "OUTLINED"
}> {
    try {
        if (!project) {
            throw new Error("GOOGLE_CLOUD_PROJECT_ID environment variable is not set.");
        }

        console.log(`[AI Icon Service] Analyzing ${styleReferences.length} style references with Gemini 2.0 Flash...`);

        const vertex_ai = new VertexAI({ project: project, location: location });
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        // Convert SVG buffers to PNG before sending to Gemini
        const pngBuffers: Buffer[] = [];
        for (const buffer of styleReferences) {
            try {
                // Check if it's an SVG (starts with < or <?xml)
                const bufferStr = buffer.toString('utf-8', 0, 100);
                if (bufferStr.trim().startsWith('<')) {
                    // It's an SVG, convert to PNG
                    const pngBuffer = await convertSvgToPng(buffer.toString('utf-8'));
                    pngBuffers.push(pngBuffer);
                } else {
                    // Already PNG, use as-is
                    pngBuffers.push(buffer);
                }
            } catch (e) {
                console.warn('[AI Icon Service] Failed to convert image, using original:', e);
                pngBuffers.push(buffer);
            }
        }

        // Convert buffers to inline data parts
        const imageParts = pngBuffers.map(buffer => ({
            inlineData: {
                data: buffer.toString('base64'),
                mimeType: 'image/png'
            }
        }));

        const prompt = `
    You are a Design System Expert. 
    
    CONTEXT: The user indicates these icons might come from the library: "${libraryHint || 'Unknown'}".
    
    TASK: Analyze the images and extract the STRICT construction rules.
    
    Return a JSON object with these fields:
    
    1. closestLibraryMatch: 
       - If the style matches the hint "${libraryHint}", return the FAMOUS canonical name (e.g. "Font Awesome 6 Solid").
       - If unknown, identify the closest visual twin.

    2. fillStrategy: 
       - STRICTLY return either "FILLED" (solid shapes) or "OUTLINED" (strokes). 
       - Look at the dominant mass. If it's solid ink, it is FILLED.

    3. styleProfile: 
       - A technical list of traits.
       - CRITICAL: If fillStrategy is "FILLED", DO NOT mention stroke weights or line thickness. Focus on "Visual Weight", "Corner Radius", and "Geometric Primitives".
       - If fillStrategy is "OUTLINED", specify the stroke weight (e.g. "2px uniform stroke").

    4. consistencyInstructions: 3 negative constraints (e.g. "No thin lines. No gradients.").
    `;

        const request = {
            contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
        };

        const result = await model.generateContent(request);
        const response = await result.response;
        const text = response.candidates?.[0].content.parts[0].text;

        if (!text) {
            throw new Error("Gemini returned empty response");
        }

        // Clean up markdown code blocks if present
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(jsonString);

        console.log('[AI Icon Service] Style Analysis complete:', analysis);

        // Apply library-specific overrides (fix analyzer mistakes)
        let finalFillStrategy = analysis.fillStrategy || "FILLED";
        let finalStyleProfile = analysis.styleProfile || "Standard solid fill style";

        // Known outline-based libraries that analyzer often misidentifies
        const outlineLibraries = ['lineicons', 'feather', 'lucide', 'heroicons outline', 'ionicons outline'];
        const matchedLibrary = analysis.closestLibraryMatch?.toLowerCase() || '';

        if (outlineLibraries.some(lib => matchedLibrary.includes(lib))) {
            console.log(`[AI Icon Service] 🔧 Override: ${matchedLibrary} is outline-based, forcing OUTLINED strategy`);
            finalFillStrategy = "OUTLINED";
            finalStyleProfile = "Uniform stroke weight, rounded line caps, clean outlines, no fills";
        }

        return {
            styleProfile: finalStyleProfile,
            consistencyInstructions: analysis.consistencyInstructions || "Maintain clear silhouettes.",
            closestLibraryMatch: analysis.closestLibraryMatch || "Google Material Symbols",
            fillStrategy: finalFillStrategy as "FILLED" | "OUTLINED"
        };

    } catch (error) {
        console.error('[AI Icon Service] Style Analysis failed:', error);
        // Fallback
        return {
            styleProfile: "Standard solid fill style",
            consistencyInstructions: "Maintain clear silhouettes.",
            closestLibraryMatch: "Google Material Symbols",
            fillStrategy: "FILLED"
        };
    }
}

/**
 * Uses Gemini 2.0 Flash to write the perfect Imagen 3 prompt.
 * Meta-prompting strategy to bypass template conflicts.
 */
async function askGeminiToWriteImagenPrompt(
    userSubject: string,
    styleAnalysis: {
        styleProfile: string | string[],
        consistencyInstructions: string | string[],
        closestLibraryMatch: string,
        fillStrategy: "FILLED" | "OUTLINED"
    }
): Promise<string> {
    try {
        if (!project) {
            throw new Error("GOOGLE_CLOUD_PROJECT_ID environment variable is not set.");
        }

        const vertex_ai = new VertexAI({ project: project, location: location });
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const metaPrompt = `You are a prompt engineer for Imagen 3 image generation.

Your task: Write the PERFECT prompt to generate a clean, simple icon.

SUBJECT: ${userSubject}

CRITICAL LIBRARY CONTEXT:
- The style MUST match: ${styleAnalysis.closestLibraryMatch}
- This is the EXACT library from the seed icons provided
- Do NOT deviate from this library's visual language

FILL STRATEGY (CRITICAL):
- Strategy: ${styleAnalysis.fillStrategy}
${styleAnalysis.fillStrategy === "OUTLINED" ?
                `- This means: OUTLINE ONLY with uniform stroke weight, NO solid fills, NO filled shapes
- CRITICAL FOR OUTLINES: The outline must be a SIMPLE CONTINUOUS LINE forming the shape's perimeter
- Absolutely NO texture, NO pattern, NO internal detail, NO segmentation inside the outline
- Think: a single pen stroke drawing the shape's edge, nothing more` :
                "- This means: SOLID BLACK MASSES only, NO outlines, NO strokes, NO hollow shapes"}
- This is non-negotiable - enforce this strictly

VISUAL TRAITS FROM SEEDS:
- ${Array.isArray(styleAnalysis.styleProfile) ? styleAnalysis.styleProfile.join('\n- ') : styleAnalysis.styleProfile}

CONSTRAINTS TO AVOID:
- ${Array.isArray(styleAnalysis.consistencyInstructions) ? styleAnalysis.consistencyInstructions.join('\n- ') : styleAnalysis.consistencyInstructions}

CORE REQUIREMENTS (ABSOLUTE):
${styleAnalysis.fillStrategy === "OUTLINED" ?
                `1. Pure, single continuous line art (hollow outline)
2. NO filled shapes, NO solid masses, NO internal details, NO shadows
3. CRITICAL: Rendered as a hollow outline with a single uniform stroke
4. Absolute black stroke on absolute white background` :
                `1. Pure, single silhouette shape
2. NO internal lines, NO segmentation, NO fine details, NO shadows
3. CRITICAL: Rendered as a pure, single silhouette shape with no internal lines, shadows, segmentation, or details
4. Absolute black (#000000) on absolute white (#FFFFFF)`}
5. Flat 2D, NOT realistic or 3D
6. Think: ${styleAnalysis.fillStrategy === "OUTLINED" ? "wireframe, technical drawing, icon font" : "rubber stamp, cookie cutter, stencil"}

Write a concise, powerful prompt (max 150 words) for Imagen 3.
ONLY output the prompt text - no preamble or explanation.`;

        const request = {
            contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
        };

        const result = await model.generateContent(request);
        const response = await result.response;
        const generatedPrompt = response.candidates?.[0].content.parts[0].text?.trim();

        if (!generatedPrompt) {
            throw new Error("Gemini returned empty prompt");
        }

        console.log('[AI Icon Service] 🤖 Gemini Meta-Prompt:', generatedPrompt);
        return generatedPrompt;

    } catch (error) {
        console.error('[AI Icon Service] Meta-prompting failed:', error);
        // Fallback to basic prompt
        return `Create a simple, flat ${styleAnalysis.fillStrategy.toLowerCase()} icon of: ${userSubject}. Pure black silhouette on white background. No internal details.`;
    }
}

/**
 * Generates icon variants using Imagen 3.
 * @param prompt The user's text prompt.
 * @param styleReferences Array of PNG buffers to use as style seeds.
 * @param styleSummary Optional computed style profile (legacy/unused in this new pipeline).
 * @param styleStrictness Optional strictness level (0-100).
 * @returns A Promise that resolves to an array of generated PNG buffers.
 */
export async function generateIconVariants(
    prompt: string,
    styleReferences: Buffer[],
    styleSummary?: StyleSummary,
    styleStrictness: number = 50,
    libraryHint?: string,
    guidanceScale: number = 50,
    useMetaPrompt: boolean = false
): Promise<{ images: Buffer[], strategy: "FILLED" | "OUTLINED" }> {
    // TRACER BULLET: Check your console for this specific line
    console.log("!!! 🟢 CLONER LOGIC IS ACTIVE - SPRINT v2 LOADED 🟢 !!!");

    try {
        if (!project) {
            throw new Error("GOOGLE_CLOUD_PROJECT_ID environment variable is not set.");
        }

        // 1. Analyze Style References (if present)
        let styleAnalysis = {
            styleProfile: "Standard solid fill style",
            consistencyInstructions: "Maintain clear silhouettes.",
            closestLibraryMatch: "Google Material Symbols",
            fillStrategy: "FILLED" as "FILLED" | "OUTLINED"
        };

        if (styleReferences && styleReferences.length > 0) {
            styleAnalysis = await analyzeStyleReferences(styleReferences, libraryHint);
        } else {
            console.log('[AI Icon Service] No style references provided, using default style.');
        }

        // 2. Construct the System Prompt
        let finalPrompt: string;

        if (useMetaPrompt) {
            console.log('[AI Icon Service] 🤖 Using Gemini Meta-Prompting...');
            finalPrompt = await askGeminiToWriteImagenPrompt(prompt, styleAnalysis);
        } else {
            console.log('[AI Icon Service] 📝 Using Template Prompt...');
            // EXISTING: Template-based prompt (Phase 1 Strategies)
            finalPrompt = `
Design a LOGO STAMP for: simple ${prompt}

REQUIREMENTS:
- Create a RUBBER STAMP impression: solid black ink on white paper
- NO internal lines, NO segmentation, NO fine details
- Pure silhouette - imagine cutting this shape from solid black paper
- Flat 2D vector logo (NOT an illustration or realistic image)
- CRITICAL: Rendered as a pure, single silhouette shape with no internal lines, segmentation, or details

STYLE GUIDE:
- Match ${styleAnalysis.closestLibraryMatch} visual language
- Fill Strategy: ${styleAnalysis.fillStrategy === "FILLED" ? "SOLID BLACK MASS - no outlines, no strokes" : "OUTLINE ONLY - uniform stroke weight"}
- Visual Traits: ${styleAnalysis.styleProfile}
- Avoid: ${styleAnalysis.consistencyInstructions}

FINAL OUTPUT:
- Single solid shape with NO internal complexity
- Absolute black (#000000) on absolute white (#FFFFFF)
- Think: cookie cutter, stencil, printing block
`;
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 FULL IMAGEN 3 PROMPT:');
        console.log(finalPrompt);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // 3. Call Imagen 3 (Text-to-Image)
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${STANDARD_MODEL}:predict`;

        const instance = {
            prompt: finalPrompt,
        };

        const requestBody = {
            instances: [instance],
            parameters: {
                sampleCount: 4,
                personGeneration: "dont_allow",
                negativePrompt: NEGATIVE_PROMPT,
                aspectRatio: "1:1",
                guidanceScale: guidanceScale  // Tunable parameter (default ~15, max 100)
            }
        };

        console.log(`[AI Icon Service] Using guidanceScale: ${guidanceScale}`);

        // Get access token for authentication
        const { GoogleAuth } = await import('google-auth-library');

        const authOptions: {
            scopes: string[];
            credentials?: any;
        } = {
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        };

        const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
        if (credsJson) {
            try {
                authOptions.credentials = JSON.parse(credsJson);
                console.log('Using credentials from GOOGLE_APPLICATION_CREDENTIALS_JSON');
            } catch (e) {
                throw new Error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON: ' + (e instanceof Error ? e.message : 'Unknown'));
            }
        }

        const auth = new GoogleAuth(authOptions);
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to get access token');
        }

        console.log(`Calling Vertex AI endpoint: ${endpoint}`);
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
            console.error(`Imagen 3 API Error: ${response.status}`, errorText);
            throw new Error(`Imagen 3 API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Extract generated images from response
        const generatedImages: Buffer[] = [];

        if (result.predictions && result.predictions.length > 0) {
            for (const prediction of result.predictions) {
                if (prediction.bytesBase64Encoded) {
                    generatedImages.push(Buffer.from(prediction.bytesBase64Encoded, 'base64'));
                }
            }
        }

        if (generatedImages.length === 0) {
            throw new Error('No images generated from Imagen 3');
        }

        return {
            images: generatedImages,
            strategy: styleAnalysis.fillStrategy
        };

    } catch (error) {
        console.error('Generation error:', error);
        throw error;
    }
}
