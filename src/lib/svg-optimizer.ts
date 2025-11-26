import { optimize } from 'svgo';

export async function optimizeSvg(
    svgString: string,
    targetGridSize: number = 24,
    floatPrecision: number = 1
): Promise<string> {
    try {
        const result = optimize(svgString, {
            multipass: true,
            floatPrecision: floatPrecision, // Use the passed precision (default 1)
            plugins: [
                {
                    name: 'preset-default',
                    params: {
                        overrides: {
                            removeViewBox: false, // Keep the viewBox!
                        },
                    },
                } as any,
                {
                    name: 'convertPathData',
                    params: {
                        floatPrecision: floatPrecision, // Rounds coordinates to 1 decimal place (Grid Snap effect)
                        transformPrecision: floatPrecision,
                        makeArcs: undefined,
                        noSpaceAfterFlags: undefined,
                    }
                },
                {
                    name: 'addAttributesToSVGElement',
                    params: {
                        attributes: [
                            { viewBox: `0 0 ${targetGridSize} ${targetGridSize}` },
                            { width: "256" },
                            { height: "256" }
                        ]
                    }
                }
            ],
        });

        if ('data' in result) {
            return result.data;
        }
        return svgString; // Fallback to original if optimization fails
    } catch (error) {
        console.error('[SVG Optimizer] Warning:', error);
        return svgString;
    }
}
