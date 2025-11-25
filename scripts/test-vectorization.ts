import fs from 'fs';
import path from 'path';
import { vectorizeImage } from '../src/lib/ai-icon-service';
import { StyleSummary } from '../src/lib/style-analysis';

// Mock StyleSummary
const mockStyleSummary: StyleSummary = {
    avgStrokeWidth: 2.0,
    strokeStyle: 'outline',
    strokeCap: 'round',
    strokeJoin: 'round',
    avgCornerRadius: 3.0,
    fillUsage: 'none',
    dominantShapes: 'circles',
    detailLevel: 'low',
    confidenceScore: 0.9,
};

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: npx tsx scripts/test-vectorization.ts <input-png-path> [strategy]');
        process.exit(1);
    }

    const inputPath = args[0];
    const strategy = (args[1] || 'OUTLINED') as 'FILLED' | 'OUTLINED';

    console.log(`Vectorizing ${inputPath} with strategy: ${strategy}`);

    try {
        const buffer = fs.readFileSync(inputPath);

        // Call vectorizeImage with the correct signature
        const svg = await vectorizeImage(buffer, strategy);

        const outputPath = path.join(process.cwd(), 'debug', `vectorized-${Date.now()}.svg`);

        // Ensure debug dir exists
        if (!fs.existsSync(path.dirname(outputPath))) {
            fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        }

        fs.writeFileSync(outputPath, svg);
        console.log(`✅ SVG saved to: ${outputPath}`);

    } catch (error) {
        console.error('❌ Vectorization failed:', error);
    }
}

main();
