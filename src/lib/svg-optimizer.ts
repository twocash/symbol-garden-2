import { optimize } from 'svgo';

/**
 * Optimizes an SVG string using SVGO.
 * Removes useless groups, collapses paths, and ensures cleaner markup.
 */
export function optimizeSvg(svgString: string): string {
    try {
        const result = optimize(svgString, {
            multipass: true, // Run multiple passes for better optimization
            plugins: [
                {
                    name: 'preset-default',
                    params: {
                        overrides: {
                            // Customize default plugins here if needed
                        },
                    },
                },
                'removeDimensions', // Remove width/height attributes, rely on viewBox
                'convertStyleToAttrs', // Convert inline styles to attributes
                'sortAttrs', // Sort attributes for consistency
                {
                    name: 'addAttributesToSVGElement',
                    params: {
                        attributes: [
                            { fill: 'currentColor' }, // Ensure fill is currentColor for easy styling
                        ],
                    },
                },
            ],
        });

        if ('data' in result) {
            return result.data;
        } else {
            console.warn('SVGO optimization failed:', result);
            return svgString; // Return original if optimization fails
        }
    } catch (error) {
        console.error('Error optimizing SVG:', error);
        return svgString;
    }
}
