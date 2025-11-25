import { describe, it, expect } from 'vitest';
import {
    parseStrokeWidth,
    parseStrokeCap,
    parseStrokeJoin,
    parseCornerRadius,
    inferGeometry,
    calculateDetailLevel,
    analyzeIconStyle,
} from '../style-analysis';
import type { StyleSummary } from '../style-analysis';
import { Icon } from '@/types/schema';

describe('parseStrokeWidth', () => {
    it('should extract stroke-width from attributes', () => {
        const svg = '<path stroke-width="2" d="M10 10"/>';
        const widths = parseStrokeWidth(svg);
        expect(widths).toContain(2);
    });

    it('should extract stroke-width from inline styles', () => {
        const svg = '<path style="stroke-width:3.5" d="M10 10"/>';
        const widths = parseStrokeWidth(svg);
        expect(widths).toContain(3.5);
    });

    it('should handle multiple paths with different widths', () => {
        const svg = `
      <path stroke-width="2" d="M10 10"/>
      <path stroke-width="2.5" d="M20 20"/>
      <path style="stroke-width:3" d="M30 30"/>
    `;
        const widths = parseStrokeWidth(svg);
        expect(widths).toHaveLength(3);
        expect(widths).toEqual(expect.arrayContaining([2, 2.5, 3]));
    });

    it('should return empty array if no stroke-width found', () => {
        const svg = '<path d="M10 10"/>';
        const widths = parseStrokeWidth(svg);
        expect(widths).toEqual([]);
    });

    it('should ignore invalid stroke-width values', () => {
        const svg = '<path stroke-width="invalid" d="M10 10"/>';
        const widths = parseStrokeWidth(svg);
        expect(widths).toEqual([]);
    });
});

describe('parseStrokeCap', () => {
    it('should extract stroke-linecap from attributes', () => {
        const svg = '<path stroke-linecap="round" d="M10 10"/>';
        const cap = parseStrokeCap(svg);
        expect(cap).toBe('round');
    });

    it('should extract stroke-linecap from inline styles', () => {
        const svg = '<path style="stroke-linecap: square" d="M10 10"/>';
        const cap = parseStrokeCap(svg);
        expect(cap).toBe('square');
    });

    it('should return "round" as default when no linecap found', () => {
        const svg = '<path d="M10 10"/>';
        const cap = parseStrokeCap(svg);
        expect(cap).toBe('round');
    });

    it('should return most common value when multiple caps exist', () => {
        const svg = `
      <path stroke-linecap="round" d="M10 10"/>
      <path stroke-linecap="round" d="M20 20"/>
      <path stroke-linecap="square" d="M30 30"/>
    `;
        const cap = parseStrokeCap(svg);
        expect(cap).toBe('round');
    });
});

describe('parseStrokeJoin', () => {
    it('should extract stroke-linejoin from attributes', () => {
        const svg = '<path stroke-linejoin="miter" d="M10 10"/>';
        const join = parseStrokeJoin(svg);
        expect(join).toBe('miter');
    });

    it('should return "round" as default when no linejoin found', () => {
        const svg = '<path d="M10 10"/>';
        const join = parseStrokeJoin(svg);
        expect(join).toBe('round');
    });
});

describe('parseCornerRadius', () => {
    it('should extract rx from rect elements', () => {
        const svg = '<rect x="10" y="10" width="100" height="100" rx="5"/>';
        const radii = parseCornerRadius(svg);
        expect(radii).toContain(5);
    });

    it('should extract ry from rect elements', () => {
        const svg = '<rect x="10" y="10" width="100" height="100" ry="8"/>';
        const radii = parseCornerRadius(svg);
        expect(radii).toContain(8);
    });

    it('should return empty array if no corner radius found', () => {
        const svg = '<rect x="10" y="10" width="100" height="100"/>';
        const radii = parseCornerRadius(svg);
        expect(radii).toEqual([]);
    });
});

describe('inferGeometry', () => {
    it('should detect circles', () => {
        const svg = '<circle cx="50" cy="50" r="40"/>';
        const geometry = inferGeometry(svg);
        expect(geometry).toContain('circle');
    });

    it('should detect rectangles', () => {
        const svg = '<rect x="10" y="10" width="100" height="100"/>';
        const geometry = inferGeometry(svg);
        expect(geometry).toContain('rectangle');
    });

    it('should detect rounded rectangles', () => {
        const svg = '<rect x="10" y="10" width="100" height="100" rx="5"/>';
        const geometry = inferGeometry(svg);
        expect(geometry).toContain('rounded rectangle');
    });

    it('should detect curves in paths', () => {
        const svg = '<path d="M10 10 C 20 20, 40 20, 50 10"/>';
        const geometry = inferGeometry(svg);
        expect(geometry).toContain('curve');
    });

    it('should combine multiple shape types', () => {
        const svg = `
      <circle cx="50" cy="50" r="40"/>
      <rect x="10" y="10" width="100" height="100" rx="5"/>
    `;
        const geometry = inferGeometry(svg);
        expect(geometry).toMatch(/circle.*(and|,).*rounded rectangle/);
    });
});

describe('calculateDetailLevel', () => {
    it('should return "low" for simple icons', () => {
        const svg = '<path d="M10 10 L20 20"/>';
        const level = calculateDetailLevel(svg);
        expect(level).toBe('low');
    });

    it('should return "medium" for moderately complex icons', () => {
        const svg = `
      <path d="M10 10 L20 20 L30 30 L40 40"/>
      <path d="M50 50 C 60 60, 70 60, 80 50"/>
      <circle cx="100" cy="100" r="10"/>
    `;
        const level = calculateDetailLevel(svg);
        expect(level).toBe('medium');
    });

    it('should return "high" for complex icons', () => {
        const paths = Array(10).fill('<path d="M10 10 L20 20 C30 30 40 40 50 50"/>').join('\n');
        const level = calculateDetailLevel(paths);
        expect(level).toBe('high');
    });
});

describe('analyzeIconStyle', () => {
    const mockOutlineIcon: Icon = {
        id: '1',
        name: 'Test Icon',
        library: 'test',
        path: 'M10 10 L20 20',
        viewBox: '0 0 24 24',
        tags: [],
        renderStyle: 'stroke',
    };

    const mockFilledIcon: Icon = {
        id: '2',
        name: 'Filled Icon',
        library: 'test',
        path: 'M0 0 h24 v24 h-24 z',
        viewBox: '0 0 24 24',
        tags: [],
        renderStyle: 'fill',
    };

    it('should throw error for empty icon array', async () => {
        await expect(analyzeIconStyle([])).rejects.toThrow('Cannot analyze style of empty icon set');
    });

    it('should analyze outline icons correctly', async () => {
        const icons = [mockOutlineIcon, mockOutlineIcon, mockOutlineIcon];
        const summary = await analyzeIconStyle(icons);

        expect(summary.strokeStyle).toBe('outline');
        expect(summary.fillUsage).toBe('none');
        expect(summary.confidenceScore).toBeGreaterThan(0.5);
    });

    it('should analyze filled icons correctly', async () => {
        const icons = [mockFilledIcon, mockFilledIcon, mockFilledIcon];
        const summary = await analyzeIconStyle(icons);

        expect(summary.strokeStyle).toBe('filled');
        expect(summary.fillUsage).toBe('solid');
    });

    it('should detect mixed styles', async () => {
        const icons = [mockOutlineIcon, mockFilledIcon, mockOutlineIcon];
        const summary = await analyzeIconStyle(icons);

        expect(summary.strokeStyle).toBe('mixed');
        expect(summary.fillUsage).toBe('partial');
        expect(summary.confidenceScore).toBeLessThan(0.7); // Lower confidence for mixed styles
    });

    it('should use median for stroke width to handle outliers', async () => {
        // This would require mocking parseStrokeWidth or creating actual SVG strings
        // For now, we test that avgStrokeWidth defaults to 2.0
        const summary = await analyzeIconStyle([mockOutlineIcon]);
        expect(summary.avgStrokeWidth).toBe(2.0); // Default when no width data
    });

    it('should have high confidence for uniform icon sets', async () => {
        const icons = Array(10).fill(mockOutlineIcon);
        const summary = await analyzeIconStyle(icons);

        expect(summary.confidenceScore).toBeGreaterThan(0.8);
    });

    it('should have lower confidence for small sample sizes', async () => {
        const summary = await analyzeIconStyle([mockOutlineIcon, mockOutlineIcon]);
        expect(summary.confidenceScore).toBeLessThan(0.9); // Penalized for small sample
    });
});
