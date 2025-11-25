import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    logGeneration,
    updateSelection,
    updateRating,
    getGenerationHistory,
    getAverageRating,
    getWorkspaceStats,
    clearWorkspaceTelemetry,
    clearAllTelemetry,
} from '../icon-telemetry';
import type { GenerationEvent } from '../icon-telemetry';
import { StyleSummary } from '../style-analysis';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index: number) => {
            const keys = Object.keys(store);
            return keys[index] || null;
        },
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

const mockStyleSummary: StyleSummary = {
    avgStrokeWidth: 2.0,
    strokeStyle: 'outline',
    strokeCap: 'round',
    strokeJoin: 'round',
    avgCornerRadius: 3.0,
    fillUsage: 'none',
    dominantShapes: 'circles',
    detailLevel: 'low',
    confidenceScore: 0.85,
};

describe('icon-telemetry', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    describe('logGeneration', () => {
        it('should create a new generation event with ID and timestamp', () => {
            const eventId = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'rocket ship',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            expect(eventId).toBeTruthy();
            expect(typeof eventId).toBe('string');
        });

        it('should store event in localStorage', () => {
            const eventId = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'battery',
                styleSummary: mockStyleSummary,
                styleStrictness: 70,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            const history = getGenerationHistory('workspace-1');
            expect(history).toHaveLength(1);
            expect(history[0].id).toBe(eventId);
            expect(history[0].userPrompt).toBe('battery');
        });

        it('should enforce FIFO limit of 100 events', () => {
            // Create 105 events
            for (let i = 0; i < 105; i++) {
                logGeneration({
                    workspaceId: 'workspace-1',
                    userPrompt: `icon-${i}`,
                    styleSummary: mockStyleSummary,
                    styleStrictness: 50,
                    generatedVariants: 4,
                    selectedVariantIndex: null,
                    savedIconId: null,
                    rating: null,
                });
            }

            const history = getGenerationHistory('workspace-1');
            expect(history).toHaveLength(100);

            // Verify oldest events were removed
            expect(history.some(e => e.userPrompt === 'icon-0')).toBe(false);
            expect(history.some(e => e.userPrompt === 'icon-104')).toBe(true);
        });
    });

    describe('updateSelection', () => {
        it('should update selected variant and saved icon ID', () => {
            const eventId = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            updateSelection(eventId, 2, 'icon-abc-123');

            const history = getGenerationHistory('workspace-1');
            expect(history[0].selectedVariantIndex).toBe(2);
            expect(history[0].savedIconId).toBe('icon-abc-123');
        });

        it('should handle non-existent event ID gracefully', () => {
            updateSelection('non-existent-id', 0, 'icon-123');
            // Should not throw, just log warning
        });
    });

    describe('updateRating', () => {
        it('should update event rating', () => {
            const eventId = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            updateRating(eventId, 5);

            const history = getGenerationHistory('workspace-1');
            expect(history[0].rating).toBe(5);
        });

        it('should reject invalid ratings', () => {
            const eventId = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            updateRating(eventId, 10); // Invalid rating

            const history = getGenerationHistory('workspace-1');
            expect(history[0].rating).toBeNull(); // Should remain null
        });
    });

    describe('getGenerationHistory', () => {
        it('should return events sorted by timestamp (newest first)', () => {
            vi.useFakeTimers();

            // First event at t=0
            vi.setSystemTime(new Date(2023, 1, 1, 10, 0, 0));
            const id1 = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'first',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            // Second event at t=1000
            vi.setSystemTime(new Date(2023, 1, 1, 10, 0, 1));
            const id2 = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'second',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            const history = getGenerationHistory('workspace-1');
            expect(history[0].userPrompt).toBe('second'); // Newest first
            expect(history[1].userPrompt).toBe('first');

            vi.useRealTimers();
        });

        it('should respect limit parameter', () => {
            for (let i = 0; i < 10; i++) {
                logGeneration({
                    workspaceId: 'workspace-1',
                    userPrompt: `icon-${i}`,
                    styleSummary: mockStyleSummary,
                    styleStrictness: 50,
                    generatedVariants: 4,
                    selectedVariantIndex: null,
                    savedIconId: null,
                    rating: null,
                });
            }

            const history = getGenerationHistory('workspace-1', 5);
            expect(history).toHaveLength(5);
        });
    });

    describe('getAverageRating', () => {
        it('should calculate average of rated events', () => {
            const id1 = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test1',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            const id2 = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test2',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            updateRating(id1, 5);
            updateRating(id2, 3);

            const avgRating = getAverageRating('workspace-1');
            expect(avgRating).toBe(4); // (5 + 3) / 2
        });

        it('should return 0 if no ratings exist', () => {
            logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            const avgRating = getAverageRating('workspace-1');
            expect(avgRating).toBe(0);
        });
    });

    describe('getWorkspaceStats', () => {
        it('should return comprehensive workspace statistics', () => {
            const id1 = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'battery',
                styleSummary: mockStyleSummary,
                styleStrictness: 60,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            const id2 = logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'rocket',
                styleSummary: mockStyleSummary,
                styleStrictness: 80,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            updateRating(id1, 4);

            const stats = getWorkspaceStats('workspace-1');
            expect(stats.totalGenerations).toBe(2);
            expect(stats.totalRated).toBe(1);
            expect(stats.averageRating).toBe(4);
            expect(stats.averageStrictness).toBe(70); // (60 + 80) / 2
            expect(stats.mostCommonPrompts).toContain('battery');
            expect(stats.mostCommonPrompts).toContain('rocket');
        });
    });

    describe('clearWorkspaceTelemetry', () => {
        it('should remove all events for a workspace', () => {
            logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            clearWorkspaceTelemetry('workspace-1');

            const history = getGenerationHistory('workspace-1');
            expect(history).toHaveLength(0);
        });
    });

    describe('clearAllTelemetry', () => {
        it('should remove events from all workspaces', () => {
            logGeneration({
                workspaceId: 'workspace-1',
                userPrompt: 'test1',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            logGeneration({
                workspaceId: 'workspace-2',
                userPrompt: 'test2',
                styleSummary: mockStyleSummary,
                styleStrictness: 50,
                generatedVariants: 4,
                selectedVariantIndex: null,
                savedIconId: null,
                rating: null,
            });

            clearAllTelemetry();

            expect(getGenerationHistory('workspace-1')).toHaveLength(0);
            expect(getGenerationHistory('workspace-2')).toHaveLength(0);
        });
    });
});
