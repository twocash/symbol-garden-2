
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { vectorizeImage } from '../src/lib/ai-icon-service';

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) {
        console.error('Usage: npx tsx scripts/test-blur-pipeline.ts <path-to-image>');
        process.exit(1);
    }

    const imageBuffer = fs.readFileSync(inputPath);
    const debugDir = path.join(process.cwd(), 'debug');
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir);
    }

    console.log('--- TEST 1: Regular Weight (Default) ---');
    const svgRegular = await vectorizeImage(imageBuffer, 'OUTLINED', 10);
    fs.writeFileSync(path.join(debugDir, 'output-regular.svg'), svgRegular);
    console.log('Saved output-regular.svg');

    console.log('\n--- TEST 2: Bold Weight (Target > 15) ---');
    const svgBold = await vectorizeImage(imageBuffer, 'OUTLINED', 20);
    fs.writeFileSync(path.join(debugDir, 'output-bold.svg'), svgBold);
    console.log('Saved output-bold.svg');

    console.log('\n--- Verification ---');
    console.log('Please inspect the two SVGs in the debug/ folder.');
    console.log('output-bold.svg should have noticeably thicker lines than output-regular.svg.');
}

main().catch(console.error);
