import { optimize } from 'svgo';

export async function optimizeSvg(svgString: string, targetGridSize: number = 24): Promise<string> {
    try {
        const result = optimize(svgString, {
            multipass: true,
            floatPrecision: 2,
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
                        floatPrecision: 1, // Rounds coordinates to 1 decimal place (Grid Snap effect)
                        transformPrecision: 1,
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
