/**
 * Smart Sample Selection for SVG-Native Icon Generation
 *
 * Selects representative icons from a library based on semantic category,
 * geometric complexity, and specific traits. Different configurations
 * are used for the Generator (stylistic examples) vs Critic (edge cases).
 */

import { Icon, SemanticCategory, GeometricTrait } from "@/types/schema";

// Configuration for sample selection
export interface SampleSelectionConfig {
    // Total samples to select
    count: number;

    // Semantic category weights (should sum to ~1.0)
    categoryWeights: {
        object: number;    // Real-world things (cup, headphones, rocket)
        action: number;    // Verbs/operations (download, upload, refresh)
        ui: number;        // Navigation/interface elements (arrow, chevron, menu)
        abstract: number;  // Symbols/concepts (warning, info, heart)
    };

    // Complexity distribution (should sum to ~1.0)
    complexityWeights: {
        simple: number;    // complexity 1-2
        medium: number;    // complexity 3
        complex: number;   // complexity 4-5
    };

    // Prioritize icons with these geometric traits
    prioritizeTraits?: GeometricTrait[];

    // Avoid icons with these traits (for generator)
    avoidTraits?: GeometricTrait[];
}

/**
 * Configuration for Generator samples
 * - Balanced semantic representation with emphasis on objects
 * - Slightly simpler icons to avoid confusing the model
 * - Prioritize symmetry (clean, representative examples)
 */
export const GENERATOR_CONFIG: SampleSelectionConfig = {
    count: 10,
    categoryWeights: {
        object: 0.50,    // Most business concepts are objects
        action: 0.20,
        ui: 0.15,
        abstract: 0.15,
    },
    complexityWeights: {
        simple: 0.30,
        medium: 0.50,   // Sweet spot - not too simple, not too complex
        complex: 0.20,
    },
    prioritizeTraits: ['symmetry'],
    // Don't show tricky edge cases to the generator
    avoidTraits: ['intersection', 'fine-detail'],
};

/**
 * Configuration for Critic samples
 * - More edge cases to teach what "correct" looks like
 * - Heavier on complex icons
 * - Prioritize problematic geometric traits
 */
export const CRITIC_CONFIG: SampleSelectionConfig = {
    count: 8,
    categoryWeights: {
        object: 0.40,
        action: 0.20,
        ui: 0.20,
        abstract: 0.20,
    },
    complexityWeights: {
        simple: 0.15,
        medium: 0.35,
        complex: 0.50,   // Critic needs to see complex cases handled correctly
    },
    // These are exactly the traits that cause problems
    prioritizeTraits: ['containment', 'intersection', 'nested', 'fine-detail'],
};

/**
 * Group icons by a key function
 */
function groupBy<T, K extends string | number>(
    items: T[],
    keyFn: (item: T) => K
): Record<K, T[]> {
    return items.reduce((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(item);
        return acc;
    }, {} as Record<K, T[]>);
}

/**
 * Score an icon for selection priority
 */
function scoreIcon(icon: Icon, config: SampleSelectionConfig): number {
    const meta = icon.aiMetadata;
    if (!meta) return 0;

    let score = 10; // Base score for having metadata

    // Boost for prioritized traits
    const prioritized = config.prioritizeTraits || [];
    for (const trait of meta.geometricTraits) {
        if (prioritized.includes(trait)) {
            score += 15;
        }
    }

    // Penalty for avoided traits
    const avoided = config.avoidTraits || [];
    for (const trait of meta.geometricTraits) {
        if (avoided.includes(trait)) {
            score -= 10;
        }
    }

    // Boost for matching complexity distribution
    const complexity = meta.complexity;
    if (complexity <= 2 && config.complexityWeights.simple > 0.25) {
        score += 5;
    } else if (complexity === 3 && config.complexityWeights.medium > 0.35) {
        score += 5;
    } else if (complexity >= 4 && config.complexityWeights.complex > 0.25) {
        score += 5;
    }

    // Small boost for higher confidence
    score += meta.confidence * 5;

    return score;
}

/**
 * Get complexity bucket for an icon
 */
function getComplexityBucket(complexity: number): 'simple' | 'medium' | 'complex' {
    if (complexity <= 2) return 'simple';
    if (complexity === 3) return 'medium';
    return 'complex';
}

/**
 * Select samples from a library based on configuration
 *
 * @param icons - All icons in the library
 * @param config - Selection configuration
 * @returns Selected icons
 */
export function selectSamples(
    icons: Icon[],
    config: SampleSelectionConfig
): Icon[] {
    // 1. Filter to icons with aiMetadata
    const enriched = icons.filter(i => i.aiMetadata);

    if (enriched.length === 0) {
        // Fallback: return evenly-spaced samples if no metadata
        console.warn('No icons with aiMetadata found, using fallback selection');
        return selectFallbackSamples(icons, config.count);
    }

    // 2. Group by semantic category
    const byCategory = groupBy(
        enriched,
        i => i.aiMetadata!.semanticCategory
    );

    // 3. Calculate target counts per category
    const categories: SemanticCategory[] = ['object', 'action', 'ui', 'abstract'];
    const targets: Record<SemanticCategory, number> = {
        object: Math.round(config.count * config.categoryWeights.object),
        action: Math.round(config.count * config.categoryWeights.action),
        ui: Math.round(config.count * config.categoryWeights.ui),
        abstract: Math.round(config.count * config.categoryWeights.abstract),
    };

    // 4. Select from each category
    const selected: Icon[] = [];

    for (const category of categories) {
        const target = targets[category];
        const candidates = byCategory[category] || [];

        if (candidates.length === 0) continue;

        // Score and sort candidates
        const scored = candidates.map(icon => ({
            icon,
            score: scoreIcon(icon, config),
        }));
        scored.sort((a, b) => b.score - a.score);

        // Take top N, but try to diversify complexity
        const categorySelected = selectWithComplexityDiversity(
            scored.map(s => s.icon),
            target,
            config.complexityWeights
        );

        selected.push(...categorySelected);
    }

    // 5. If we didn't get enough, fill from any category
    if (selected.length < config.count) {
        const remaining = enriched.filter(i => !selected.includes(i));
        const scored = remaining.map(icon => ({
            icon,
            score: scoreIcon(icon, config),
        }));
        scored.sort((a, b) => b.score - a.score);

        const needed = config.count - selected.length;
        selected.push(...scored.slice(0, needed).map(s => s.icon));
    }

    return selected;
}

/**
 * Select icons while trying to maintain complexity distribution
 */
function selectWithComplexityDiversity(
    icons: Icon[],
    count: number,
    weights: SampleSelectionConfig['complexityWeights']
): Icon[] {
    if (icons.length <= count) return icons;

    // Group by complexity bucket
    const byComplexity = groupBy(
        icons,
        i => getComplexityBucket(i.aiMetadata!.complexity)
    );

    const targets = {
        simple: Math.max(1, Math.round(count * weights.simple)),
        medium: Math.max(1, Math.round(count * weights.medium)),
        complex: Math.max(1, Math.round(count * weights.complex)),
    };

    const selected: Icon[] = [];

    for (const bucket of ['simple', 'medium', 'complex'] as const) {
        const available = byComplexity[bucket] || [];
        const target = Math.min(targets[bucket], available.length);
        selected.push(...available.slice(0, target));
    }

    // Fill remaining slots from any bucket
    if (selected.length < count) {
        const remaining = icons.filter(i => !selected.includes(i));
        selected.push(...remaining.slice(0, count - selected.length));
    }

    return selected.slice(0, count);
}

/**
 * Fallback: select evenly-spaced samples when no metadata available
 */
function selectFallbackSamples(icons: Icon[], count: number): Icon[] {
    if (icons.length <= count) return icons;

    const step = Math.floor(icons.length / count);
    const samples: Icon[] = [];

    for (let i = 0; i < icons.length && samples.length < count; i += step) {
        samples.push(icons[i]);
    }

    return samples;
}

/**
 * Build full SVG string from an Icon
 */
export function buildFullSvg(icon: Icon): string {
    const viewBox = icon.viewBox || "0 0 24 24";
    const renderStyle = icon.renderStyle || "stroke";

    if (renderStyle === "stroke") {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${icon.path}"/></svg>`;
    } else {
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="currentColor"><path d="${icon.path}" ${icon.fillRule ? `fill-rule="${icon.fillRule}"` : ''} ${icon.clipRule ? `clip-rule="${icon.clipRule}"` : ''}/></svg>`;
    }
}

/**
 * Format samples for inclusion in a prompt
 */
export function formatSamplesForPrompt(
    icons: Icon[],
    includeTraits: boolean = false
): string {
    return icons.map(icon => {
        const svg = buildFullSvg(icon);
        if (includeTraits && icon.aiMetadata) {
            const traits = icon.aiMetadata.geometricTraits.join(', ') || 'none';
            return `<example name="${icon.name}" category="${icon.aiMetadata.semanticCategory}" complexity="${icon.aiMetadata.complexity}" traits="${traits}">\n${svg}\n</example>`;
        }
        return `<example name="${icon.name}">\n${svg}\n</example>`;
    }).join('\n\n');
}

/**
 * Get statistics about sample selection
 */
export function getSampleStats(icons: Icon[]): {
    total: number;
    withMetadata: number;
    byCategory: Record<SemanticCategory, number>;
    byComplexity: Record<string, number>;
    traitCounts: Record<GeometricTrait, number>;
} {
    const enriched = icons.filter(i => i.aiMetadata);

    const byCategory: Record<SemanticCategory, number> = {
        object: 0, action: 0, ui: 0, abstract: 0
    };
    const byComplexity: Record<string, number> = {
        '1': 0, '2': 0, '3': 0, '4': 0, '5': 0
    };
    const traitCounts: Record<GeometricTrait, number> = {
        containment: 0, intersection: 0, nested: 0, 'fine-detail': 0,
        symmetry: 0, 'open-path': 0, compound: 0
    };

    for (const icon of enriched) {
        const meta = icon.aiMetadata!;
        byCategory[meta.semanticCategory]++;
        byComplexity[String(meta.complexity)]++;
        for (const trait of meta.geometricTraits) {
            traitCounts[trait]++;
        }
    }

    return {
        total: icons.length,
        withMetadata: enriched.length,
        byCategory,
        byComplexity,
        traitCounts,
    };
}
