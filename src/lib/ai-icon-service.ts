const potrace = require('potrace');
import sharp from 'sharp';
import { VertexAI } from '@google-cloud/vertexai';
import { promisify } from 'util';

// Initialize Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
const location = 'us-central1';
const vertex_ai = new VertexAI({ project: project || 'test-project', location });

// Instantiate Imagen 3 model for image generation
const model = 'imagen-3.0-generate-001';

const trace = promisify(potrace.trace) as (buffer: Buffer, options?: any) => Promise<string>;

/**
 * Converts a PNG buffer to a true SVG vector path using Potrace.
 * @param imageBuffer The PNG image buffer.
 * @returns A Promise that resolves to the SVG string.
 */
export async function vectorizeImage(imageBuffer: Buffer): Promise<string> {
    try {
        console.log('Vectorizing image with Potrace...');
        console.log('Input buffer size:', imageBuffer.length);

        // 1. Preprocess with Sharp
        // We need a high-contrast, monochrome image for Potrace to work best.
        // Goal: Black shape (0) on White background (255)
        console.log('Starting Sharp preprocessing...');
        const processedBuffer = await sharp(imageBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
            .grayscale()
            .threshold(128)
            .toFormat('png')
            .toBuffer();
        console.log('Sharp preprocessing complete. Buffer size:', processedBuffer.length);

        // 2. Vectorize with Potrace
        const params = {
            threshold: 128,
            optCurve: true,
            optTolerance: 0.2,
            turdSize: 2,
        };

        console.log('Starting Potrace trace...');
        const svg = await trace(processedBuffer, params);

        console.log('Vectorization complete, SVG length:', svg.length);
        return svg;

    } catch (error) {
        console.error('Vectorization error:', error);
        throw error;
    }
}

/**
 * Generates icon variants using Imagen 3.
 * @param prompt The user's text prompt.
 * @param styleReferences Array of PNG buffers to use as style seeds (currently not used by Imagen 3 directly).
 * @returns A Promise that resolves to an array of generated PNG buffers.
 */
export async function generateIconVariants(prompt: string, styleReferences: Buffer[]): Promise<Buffer[]> {
    try {
        // Create enhanced prompt that incorporates style matching
        const enhancedPrompt = `Create a minimalist vector-style icon of: ${prompt}

Style requirements:
- Match the visual style of flat, simple UI icons
- Single solid color (monochrome black or dark gray)
- Clean lines, simple geometric shapes  
- Centered composition on white/transparent background
- No gradients, shadows, or 3D effects
- Minimal details, suitable for UI/interface use at small sizes (24x24 to 48x48 pixels)
- Similar to Material Design or SF Symbols aesthetic`;

        // Use Imagen 3 via Vertex AI predict endpoint
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`;

        const requestBody = {
            instances: [{
                prompt: enhancedPrompt,
            }],
            parameters: {
                sampleCount: 4,
                aspectRatio: "1:1",
                negativePrompt: "gradient, shadow, 3d, realistic, photograph, complex details, multiple colors, colorful, textured",
                addWatermark: false,
            }
        };

        // Get access token for authentication
        const { GoogleAuth } = await import('google-auth-library');
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to get access token');
        }

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

        return generatedImages;

    } catch (error) {
        console.error('Generation error:', error);
        throw error;
    }
}
