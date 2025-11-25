import sharp from 'sharp';
import path from 'path';

async function createTestImage() {
    const outputPath = path.join(process.cwd(), 'debug', 'test-input.png');

    // Create a 512x512 white background with a black circle in the center
    await sharp({
        create: {
            width: 512,
            height: 512,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    })
        .composite([{
            input: Buffer.from(
                `<svg width="512" height="512">
                <circle cx="256" cy="256" r="100" fill="black" />
            </svg>`
            ),
            top: 0,
            left: 0
        }])
        .png()
        .toFile(outputPath);

    console.log(`Created test image at ${outputPath}`);
}

createTestImage();
