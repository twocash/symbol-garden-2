import sharp from 'sharp';

/**
 * Converts an SVG string to a PNG buffer.
 * Forces a white background to ensure transparency doesn't result in invisible icons.
 * Resizes to the specified dimension (default 512x512).
 */
export async function convertSvgToPng(svgString: string, size: number = 512): Promise<Buffer> {
    // Ensure the SVG has a viewBox or width/height to prevent Sharp errors
    // If missing, we might need to inject one, but usually our icons have viewBox.

    return sharp(Buffer.from(svgString))
        .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // Critical: flatten transparency to white
        .png()
        .toBuffer();
}
