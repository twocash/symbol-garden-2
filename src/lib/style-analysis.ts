import { Icon } from '../types/schema';

/**
 * StyleSummary represents the computed visual characteristics of a set of icons.
 * Used to generate style-matched AI icons that fit the existing library aesthetic.
 */
export interface StyleSummary {
    avgStrokeWidth: number;
    strokeStyle: 'outline' | 'filled' | 'mixed';
    strokeCap: 'round' | 'square' | 'butt';
    strokeJoin: 'round' | 'miter' | 'bevel';
    avgCornerRadius: number;
    fillUsage: 'none' | 'solid' | 'partial';
    dominantShapes: string;  // e.g., "circles and rounded rectangles"
    detailLevel: 'low' | 'medium' | 'high';
    visualWeight?: number; // 0-100 (Density percentage)
    targetFillRatio?: number; // 0-1 (Content/Canvas ratio)
    targetGrid?: number; // e.g., 24, 16, 512
    confidenceScore: number; // 0-1, how reliable the analysis is
}

/**
 * Parses SVG string to extract stroke-width values from paths.
 * Handles both attribute and inline style declarations.
 */
export function parseStrokeWidth(svg: string): number[] {
    const widths: number[] = [];

    // Match stroke-width in attributes: stroke-width="2"
    const attrMatches = svg.matchAll(/stroke-width=["']([^"']+)["']/g);
    for (const match of attrMatches) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
            widths.push(value);
        }
    }

    // Match stroke-width in inline styles: style="stroke-width:2"
    const styleMatches = svg.matchAll(/stroke-width:\s*([^;]+)/g);
    for (const match of styleMatches) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
            widths.push(value);
        }
    }

    return widths;
}

/**
 * Parses SVG to determine stroke-linecap style.
 * Returns most common value or 'round' as default.
 */
export function parseStrokeCap(svg: string): 'round' | 'square' | 'butt' {
    const caps: string[] = [];

    // Match stroke-linecap in attributes
    const attrMatches = svg.matchAll(/stroke-linecap=["']([^"']+)["']/g);
    for (const match of attrMatches) {
        caps.push(match[1]);
    }

    // Match stroke-linecap in inline styles
    const styleMatches = svg.matchAll(/stroke-linecap:\s*([^;]+)/g);
    for (const match of styleMatches) {
        caps.push(match[1].trim());
    }

    if (caps.length === 0) return 'round'; // Default assumption for icons

    // Return most common value
    const counts = caps.reduce((acc, cap) => {
        acc[cap] = (acc[cap] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return (mostCommon === 'square' || mostCommon === 'butt') ? mostCommon : 'round';
}

/**
 * Parses SVG to determine stroke-linejoin style.
 * Returns most common value or 'round' as default.
 */
export function parseStrokeJoin(svg: string): 'round' | 'miter' | 'bevel' {
    const joins: string[] = [];

    // Match stroke-linejoin in attributes
    const attrMatches = svg.matchAll(/stroke-linejoin=["']([^"']+)["']/g);
    for (const match of attrMatches) {
        joins.push(match[1]);
    }

    // Match stroke-linejoin in inline styles
    const styleMatches = svg.matchAll(/stroke-linejoin:\s*([^;]+)/g);
    for (const match of styleMatches) {
        joins.push(match[1].trim());
    }

    if (joins.length === 0) return 'round'; // Default assumption for icons

    // Return most common value
    const counts = joins.reduce((acc, join) => {
        acc[join] = (acc[join] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return (mostCommon === 'miter' || mostCommon === 'bevel') ? mostCommon : 'round';
}

/**
 * Parses SVG to extract corner radius values from rect/rounded elements.
 * Looks for rx attributes and border-radius styles.
 */
export function parseCornerRadius(svg: string): number[] {
    const radii: number[] = [];

    // Match rx attribute in rect elements
    const rxMatches = svg.matchAll(/rx=["']([^"']+)["']/g);
    for (const match of rxMatches) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
            radii.push(value);
        }
    }

    // Match ry attribute (same as rx for uniform corners)
    const ryMatches = svg.matchAll(/ry=["']([^"']+)["']/g);
    for (const match of ryMatches) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
            radii.push(value);
        }
    }

    // Match border-radius in styles
    const styleMatches = svg.matchAll(/border-radius:\s*([^;]+)/g);
    for (const match of styleMatches) {
        const value = parseFloat(match[1]);
        if (!isNaN(value) && value > 0) {
            radii.push(value);
        }
    }

    return radii;
}

/**
 * Infers dominant geometric shapes from SVG structure.
 * Analyzes path commands and element types.
 */
export function inferGeometry(svg: string): string {
    const hasCircle = /<circle/i.test(svg);
    const hasEllipse = /<ellipse/i.test(svg);
    const hasRect = /<rect/i.test(svg);
    const hasRoundedRect = /<rect[^>]*rx=/i.test(svg);
    const hasPath = /<path/i.test(svg);

    // Analyze path commands for curves
    const pathData = svg.match(/d=["']([^"']+)["']/)?.[1] || '';
    const hasCurves = /[CcSsQqTtAa]/.test(pathData);
    const hasLines = /[LlHhVv]/.test(pathData);

    const shapes: string[] = [];

    if (hasCircle || hasEllipse) shapes.push('circles');
    if (hasRoundedRect) shapes.push('rounded rectangles');
    else if (hasRect) shapes.push('rectangles');

    if (hasCurves && hasPath) shapes.push('curves');
    if (hasLines && hasPath) shapes.push('straight lines');

    if (shapes.length === 0) return 'mixed geometric shapes';
    if (shapes.length === 1) return shapes[0];

    return shapes.slice(0, 2).join(' and ');
}

/**
 * Calculates detail level based on path complexity.
 * Counts number of path elements and command density.
 */
export function calculateDetailLevel(svg: string): 'low' | 'medium' | 'high' {
    // Count path elements
    const pathCount = (svg.match(/<path/g) || []).length;

    // Count all path commands (M, L, C, etc.)
    const pathData = svg.match(/d=["']([^"']+)["']/)?.[1] || '';
    const commandCount = (pathData.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;

    // Count other shape elements
    const shapeCount = (svg.match(/<(circle|ellipse|rect|polygon|polyline|line)/g) || []).length;

    const totalElements = pathCount + shapeCount;
    const avgCommandsPerPath = pathCount > 0 ? commandCount / pathCount : 0;

    // Heuristic thresholds
    if (totalElements <= 2 && avgCommandsPerPath <= 10) return 'low';
    if (totalElements <= 5 && avgCommandsPerPath <= 20) return 'medium';
    return 'high';
}

/**
 * Calculates a raw complexity score for an SVG path.
 * Used for sorting icons to find the simplest visual references.
 * Lower score = simpler geometry.
 */
export function calculatePathComplexity(svg: string): number {
    // Count path elements
    const pathCount = (svg.match(/<path/g) || []).length;

    // Count all path commands (M, L, C, etc.)
    const pathData = svg.match(/d=["']([^"']+)["']/)?.[1] || '';
    const commandCount = (pathData.match(/[MLHVCSQTAZmlhvcsqtaz]/g) || []).length;

    // Count other shape elements
    const shapeCount = (svg.match(/<(circle|ellipse|rect|polygon|polyline|line)/g) || []).length;

    // Simple heuristic: total commands + (shapes * 2)
    return commandCount + (shapeCount * 2);
}

/**
 * Computes median value from an array of numbers.
 * More robust than mean for handling outliers.
 */
function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

/**
 * Main function: Analyzes a set of icons to compute their visual style profile.
 * Returns a StyleSummary with confidence score.
 */
export async function analyzeIconStyle(icons: Icon[]): Promise<StyleSummary> {
    if (icons.length === 0) {
        throw new Error('Cannot analyze style of empty icon set');
    }

    // Build SVG strings from icons
    const svgs = icons.map(icon => {
        return `<svg viewBox="${icon.viewBox}" xmlns="http://www.w3.org/2000/svg">
      <path d="${icon.path}" fill="${icon.renderStyle === 'fill' ? 'currentColor' : 'none'}" stroke="${icon.renderStyle === 'stroke' ? 'currentColor' : 'none'}" />
    </svg>`;
    });

    // Determine stroke style from icon metadata if available, otherwise fallback to SVG analysis
    const renderStyles = icons.map(i => i.renderStyle || 'stroke');
    const fillCount = renderStyles.filter(s => s === 'fill').length;
    const strokeCount = renderStyles.filter(s => s === 'stroke').length;

    let metaStrokeStyle: 'outline' | 'filled' | 'mixed' | undefined;
    if (fillCount === 0) metaStrokeStyle = 'outline';
    else if (strokeCount === 0) metaStrokeStyle = 'filled';
    else metaStrokeStyle = 'mixed';

    return analyzeSvgStyle(svgs, metaStrokeStyle);
}

/**
 * Analyzes a set of raw SVG strings to compute their visual style profile.
 */
export async function analyzeSvgStyle(svgs: string[], overrideStrokeStyle?: 'outline' | 'filled' | 'mixed'): Promise<StyleSummary> {
    if (svgs.length === 0) {
        throw new Error('Cannot analyze style of empty SVG set');
    }

    // Aggregate stroke widths
    const allWidths = svgs.flatMap(parseStrokeWidth);
    const avgStrokeWidth = allWidths.length > 0 ? median(allWidths) : 2.0; // Default to 2px

    // Aggregate corner radii
    const allRadii = svgs.flatMap(parseCornerRadius);
    const avgCornerRadius = allRadii.length > 0 ? median(allRadii) : 3.0; // Default to 3px

    // Determine stroke style
    let strokeStyle: 'outline' | 'filled' | 'mixed';

    if (overrideStrokeStyle) {
        strokeStyle = overrideStrokeStyle;
    } else {
        // Simple heuristic based on fill/stroke attributes in the SVG string
        const hasFill = svgs.some(s => /fill="[^n]/.test(s) && !/fill="none"/.test(s));
        const hasStroke = svgs.some(s => /stroke="[^n]/.test(s) && !/stroke="none"/.test(s));

        if (hasFill && !hasStroke) strokeStyle = 'filled';
        else if (!hasFill && hasStroke) strokeStyle = 'outline';
        else if (!hasFill && !hasStroke) strokeStyle = 'filled'; // Default to filled if nothing specified (SVG default)
        else strokeStyle = 'mixed';
    }

    // Aggregate stroke caps and joins
    const strokeCap = parseStrokeCap(svgs.join('\n'));
    const strokeJoin = parseStrokeJoin(svgs.join('\n'));

    // Infer geometry
    const geometries = svgs.map(inferGeometry);
    const dominantShapes = mode(geometries) || 'geometric shapes';

    // Calculate detail level
    const detailLevels = svgs.map(calculateDetailLevel);
    const detailLevel = mode(detailLevels) || 'medium';

    // Determine fill usage
    let fillUsage: 'none' | 'solid' | 'partial';
    if (strokeStyle === 'outline') fillUsage = 'none';
    else if (strokeStyle === 'filled') fillUsage = 'solid';
    else fillUsage = 'partial';

    // Calculate confidence score
    const confidenceScore = calculateConfidence({
        strokeStyleVariance: 1.0, // Simplified for raw SVGs
        widthDataPoints: allWidths.length,
        totalIcons: svgs.length,
    });

    // Detect target grid (mode of all grids)
    const grids = svgs.map(detectGridSize);
    const targetGrid = mode(grids) || 24;

    return {
        avgStrokeWidth,
        strokeStyle,
        strokeCap,
        strokeJoin,
        avgCornerRadius,
        fillUsage,
        dominantShapes,
        detailLevel,
        confidenceScore,
        targetGrid
    };
}

/**
 * Finds the most common element in an array (mode).
 */
function mode<T>(values: T[]): T | null {
    if (values.length === 0) return null;

    const counts = values.reduce((acc, val) => {
        const key = String(val);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const mostCommonKey = sorted[0][0];

    return values.find(v => String(v) === mostCommonKey) || null;
}

/**
 * Calculate confidence score (0-1) based on data quality.
 */
function calculateConfidence(params: {
    strokeStyleVariance: number;
    widthDataPoints: number;
    totalIcons: number;
}): number {
    const { strokeStyleVariance, widthDataPoints, totalIcons } = params;

    // Start with perfect confidence
    let confidence = 1.0;

    // Penalize mixed stroke styles
    confidence *= strokeStyleVariance;

    // Penalize low data points
    if (widthDataPoints < totalIcons * 0.5) {
        confidence *= 0.7;
    }

    // Penalize small sample sizes
    if (totalIcons < 5) {
        confidence *= 0.8;
    }

    return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculates the "Visual Weight" of an image (percentage of black pixels).
 * Used to determine if an icon style is Light, Regular, or Bold.
 * @param buffer Image buffer (PNG/JPEG)
 * @returns Density percentage (0-100)
 */
export async function calculateVisualWeight(buffer: Buffer): Promise<number> {
    const sharp = require('sharp');

    // 1. Convert to raw pixel data (grayscale)
    const { data, info } = await sharp(buffer)
        .resize(100, 100, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }) // Normalize size
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // 2. Count "ink" pixels (pixels darker than threshold)
    let inkPixels = 0;
    const threshold = 128; // Mid-gray

    for (let i = 0; i < data.length; i++) {
        // In grayscale, 0 is black, 255 is white.
        // We count pixels that are closer to black.
        if (data[i] < threshold) {
            inkPixels++;
        }
    }

    // 3. Calculate percentage
    const totalPixels = info.width * info.height;
    const density = (inkPixels / totalPixels) * 100;

    return Math.round(density * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculates the "Fill Ratio" of an image (Content Size / Canvas Size).
 * Used to normalize the scale of generated icons.
 * @param buffer Image buffer (PNG/JPEG)
 * @returns Ratio (0-1), e.g., 0.85
 */
export async function calculateFillRatio(buffer: Buffer): Promise<number> {
    const sharp = require('sharp');

    // 1. Get image metadata
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    // 2. Trim whitespace to find bounding box
    // We use a threshold to detect "empty" pixels (white/transparent)
    const { info } = await image
        .trim({ threshold: 10 }) // Tolerance for compression noise
        .toBuffer({ resolveWithObject: true });

    // 3. Calculate ratio
    // We care about the largest dimension (fitting within the square)
    const contentSize = Math.max(info.width, info.height);
    const canvasSize = Math.max(width, height);

    const ratio = contentSize / canvasSize;
    return Math.round(ratio * 100) / 100; // Round to 2 decimal places
}

/**
 * Detects the grid size from an SVG viewBox.
 * Defaults to 24 if not found or invalid.
 */
export function detectGridSize(svg: string): number {
    const viewBoxMatch = svg.match(/viewBox=["']\s*0\s+0\s+(\d+)\s+(\d+)\s*["']/);
    if (viewBoxMatch) {
        const width = parseFloat(viewBoxMatch[1]);
        const height = parseFloat(viewBoxMatch[2]);
        // Return the larger dimension as the grid size
        return Math.max(width, height);
    }
    return 24; // Default standard grid
}
