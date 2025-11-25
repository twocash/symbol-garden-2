
import { VertexAI } from '@google-cloud/vertexai';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = 'us-central1';
const MODEL_NAME = 'imagen-3.0-capability-001'; // Capability model for customization

async function main() {
    if (!PROJECT_ID) {
        console.error('Error: GOOGLE_CLOUD_PROJECT_ID is not set.');
        process.exit(1);
    }

    // Initialize Vertex AI
    const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });
    const generativeModel = vertexAI.getGenerativeModel({ model: MODEL_NAME });

    console.log(`Initialized Vertex AI with project ${PROJECT_ID} and model ${MODEL_NAME}`);

    // 1. Prepare a real reference image from artifacts
    const imagePath = "C:/Users/jim/.gemini/antigravity/brain/92cd0b34-1e53-4028-a9af-fee47c04515c/uploaded_image_0_1763829655893.png";
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // 2. Construct the payload
    // Based on research: instances array with prompt and referenceImages
    const prompt = "A simple vector icon of a star, matching the style of the reference image [1]";

    const instance = {
        prompt: prompt,
        referenceImages: [
            {
                referenceId: 1,
                referenceType: "REFERENCE_TYPE_RAW",
                referenceImage: {
                    bytesBase64Encoded: base64Image
                },
                subjectDescription: "A simple red square style reference"
            }
        ]
    };

    const parameters = {
        sampleCount: 1,
        // aspectRatio: "1:1", // Try removing this
        // personGeneration: "dont_allow" // Try removing this
    };

    console.log('Sending request to Imagen 3...');
    console.log('Prompt:', prompt);
    console.log('Parameters:', JSON.stringify(parameters, null, 2));

    try {
        // Let's try to use the raw prediction API for maximum control in this spike.
        const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_NAME}:predict`;

        // We need an access token. 
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                instances: [instance],
                parameters: parameters
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Response received!');

        if (data.predictions && data.predictions.length > 0) {
            console.log(`Success! Received ${data.predictions.length} prediction(s).`);
            // Log the first few chars of the base64 to confirm
            const firstImage = data.predictions[0].bytesBase64Encoded;
            console.log('First image base64 start:', firstImage?.substring(0, 50));
        } else {
            console.log('No predictions found in response:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('Spike failed:', error);
    }
}

main();
