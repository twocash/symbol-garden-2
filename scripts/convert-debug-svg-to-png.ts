import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

async function convertSvgToPng() {
    const svgPath = path.join(process.cwd(), 'debug', 'vectorized-1764083830794.svg');
    const pngPath = path.join('C:/Users/jim/.gemini/antigravity/brain/2aa6f79a-1538-4808-ba95-c3f0c7560f74', 'vectorized-preview.png');

    if (!fs.existsSync(svgPath)) {
        console.error('SVG file not found:', svgPath);
        return;
    }

    await sharp(svgPath)
        .resize(512, 512)
        .png()
        .toFile(pngPath);

    console.log(`Created PNG preview at ${pngPath}`);
}

convertSvgToPng();
