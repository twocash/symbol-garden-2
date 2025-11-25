import { describe, it, expect } from 'vitest';
import {
    buildWrapperPrompt,
    validatePromptConfig,
    previewPrompt,
    type PromptConfig,
} from '../prompt-builder';
import type { StyleSummary } from '../style-analysis';

const mockStyleSummary: StyleSummary = {
    avgStrokeWidth: 2.0,
    strokeStyle: 'outline',
    strokeCap: 'round',
    strokeJoin: 'round',
    avgCornerRadius: 3.0,
    fillUsage: 'none',
    dominantShapes: 'circles and rounded rectangles',
    detailLevel: 'low',
    confidenceScore: 0.85,
};

describe('buildWrapperPrompt', () => {
    it('should interpolate StyleSummary values into template', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: 'rocket ship',
            styleStrictness: 50,
        });

        expect(prompt).toContain('weight (approx');
        expect(prompt).toContain('round caps');
        expect(prompt).toContain('round joins');
        expect(prompt).toContain('circles and rounded rectangles');
        expect(prompt).toContain('rocket ship');
    });

    it('should format stroke style correctly', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: 'test',
            styleStrictness: 50,
        });

        expect(prompt).toContain('Line Art style');
    });

    it('should include strictness modifier for low strictness (0-33%)', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: 'test',
            styleStrictness: 20,
        });

        expect(prompt).toContain('CREATIVE FLEXIBILITY');
    });

    it('should include strictness modifier for medium strictness (34-66%)', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: 'test',
            styleStrictness: 50,
        });

        expect(prompt).toContain('STYLE CONSISTENCY');
    });

    it('should include strictness modifier for high strictness (67-100%)', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: 'test',
            styleStrictness: 80,
        });

        expect(prompt).toContain('STRICT MATCHING');
    });

    it('should throw error if StyleSummary is missing', () => {
        expect(() => {
            buildWrapperPrompt({
                styleSummary: null as any,
                userPrompt: 'test',
                styleStrictness: 50,
            });
        }).toThrow('StyleSummary is required');
    });

    it('should throw error if user prompt is empty', () => {
        expect(() => {
            buildWrapperPrompt({
                styleSummary: mockStyleSummary,
                userPrompt: '',
                styleStrictness: 50,
            });
        }).toThrow('User prompt cannot be empty');
    });

    // it('should throw error if strictness is out of range', () => {
    //     expect(() => {
    //         buildWrapperPrompt({
    //             styleSummary: mockStyleSummary,
    //             userPrompt: 'test',
    //             styleStrictness: 150,
    //         });
    //     }).toThrow('Style strictness must be between 0 and 100');
    // });

    it('should trim user prompt whitespace', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: '  rocket ship  ',
            styleStrictness: 50,
        });

        expect(prompt).toContain('rocket ship');
        expect(prompt).not.toContain('  rocket ship  ');
    });

    it('should handle filled stroke style', () => {
        const filledSummary: StyleSummary = {
            ...mockStyleSummary,
            strokeStyle: 'filled',
        };

        const prompt = buildWrapperPrompt({
            styleSummary: filledSummary,
            userPrompt: 'test',
            styleStrictness: 50,
        });

        expect(prompt).toContain('SOLID FILLED shapes');
    });

    it('should handle mixed stroke style', () => {
        const mixedSummary: StyleSummary = {
            ...mockStyleSummary,
            strokeStyle: 'mixed',
        };

        const prompt = buildWrapperPrompt({
            styleSummary: mixedSummary,
            userPrompt: 'test',
            styleStrictness: 50,
        });

        expect(prompt).toContain('Hybrid/Duotone');
    });

    it('should include all required prompt sections', () => {
        const prompt = buildWrapperPrompt({
            styleSummary: mockStyleSummary,
            userPrompt: 'battery',
            styleStrictness: 50,
        });

        expect(prompt).toContain('Style DNA');
        expect(prompt).toContain('User Subject');
        expect(prompt).toContain('STRICT RULES');
        expect(prompt).toContain('GENERATION INSTRUCTION');
    });
});

describe('validatePromptConfig', () => {
    it('should validate a correct PromptConfig', () => {
        const config: PromptConfig = {
            styleSummary: mockStyleSummary,
            userPrompt: 'test',
            styleStrictness: 50,
        };

        expect(validatePromptConfig(config)).toBe(true);
    });

    it('should reject null or undefined', () => {
        expect(validatePromptConfig(null)).toBe(false);
        expect(validatePromptConfig(undefined)).toBe(false);
    });

    it('should reject non-object values', () => {
        expect(validatePromptConfig('string')).toBe(false);
        expect(validatePromptConfig(123)).toBe(false);
    });

    it('should reject missing styleSummary', () => {
        const config = {
            userPrompt: 'test',
            styleStrictness: 50,
        };

        expect(validatePromptConfig(config)).toBe(false);
    });

    it('should reject invalid strictness values', () => {
        const config = {
            styleSummary: mockStyleSummary,
            userPrompt: 'test',
            styleStrictness: -10,
        };

        expect(validatePromptConfig(config)).toBe(false);
    });
});

describe('previewPrompt', () => {
    it('should generate a preview with sample data', () => {
        const preview = previewPrompt('coffee cup');

        expect(preview).toContain('coffee cup');
        expect(preview).toContain('weight (approx');
    });

    it('should use default strictness of 50', () => {
        const preview = previewPrompt('test');

        expect(preview).toContain('STYLE CONSISTENCY');
    });

    it('should accept custom strictness', () => {
        const preview = previewPrompt('test', 90);

        expect(preview).toContain('STRICT MATCHING');
    });
});
