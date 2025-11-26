import { config } from 'dotenv';
config({ path: '.env.local' });
import { generateLibraryManifest } from '../src/lib/style-analysis';
import { askGeminiToWriteImagenPrompt } from '../src/lib/ai-icon-service';
import { Icon } from '../src/types/schema';

console.log("DEBUG: Project ID:", process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log("DEBUG: Creds:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

// Mock Icons
const mockIcons: Icon[] = [
    {
        id: 'test-1',
        name: 'circle',
        path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
        viewBox: '0 0 24 24',
        library: 'test-lib',
        tags: [],
        categories: []
    },
    {
        id: 'test-2',
        name: 'rect',
        path: 'M3 3h18v18H3z',
        viewBox: '0 0 24 24',
        library: 'test-lib',
        tags: [],
        categories: []
    }
];

async function runTest() {
    console.log("🧪 Starting Sprint 05 Verification...");

    try {
        // 1. Test Manifest Generation
        console.log("\n1. Generating Manifest...");
        const manifest = await generateLibraryManifest(mockIcons);
        console.log("✅ Manifest Generated:\n", manifest);

        if (!manifest) throw new Error("Manifest generation failed (empty string)");

        // 2. Test Prompt Injection
        console.log("\n2. Testing Prompt Injection...");
        const styleAnalysis = {
            visualWeight: 10,
            styleManifest: manifest
        };

        // @ts-ignore - Accessing internal function for testing
        const prompt = await askGeminiToWriteImagenPrompt("Basketball", styleAnalysis);
        console.log("✅ Generated Prompt:\n", prompt);

        if (!prompt.toLowerCase().includes("black and white")) {
            console.warn("⚠️ Prompt might be missing key style keywords.");
        }

        console.log("\n🎉 Sprint 05 Verification Complete!");

    } catch (error) {
        console.error("\n❌ Test Failed:", error);
        process.exit(1);
    }
}

runTest();
