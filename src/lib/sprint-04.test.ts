// Set env var BEFORE import
process.env.GOOGLE_CLOUD_PROJECT_ID = 'test-project';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for Imagen
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { generateIconVariants } from './ai-icon-service';
import { StyleJuryService } from './style-jury-service';

// Mock dependencies
vi.mock('google-auth-library', () => {
    return {
        GoogleAuth: class {
            constructor() { }
            async getClient() {
                return {
                    getAccessToken: async () => ({ token: 'mock-token' })
                };
            }
        }
    };
});

vi.mock('@google-cloud/vertexai', () => {
    return {
        VertexAI: class {
            constructor() { }
            getGenerativeModel() {
                return {
                    generateContent: async () => ({
                        response: {
                            candidates: [{
                                content: {
                                    parts: [{
                                        text: JSON.stringify([
                                            { index: 0, score: 9, reasoning: "Perfect match" },
                                            { index: 1, score: 8, reasoning: "Good match" },
                                            { index: 2, score: 7, reasoning: "Okay" },
                                            { index: 3, score: 6, reasoning: "Passable" }
                                        ])
                                    }]
                                }
                            }]
                        }
                    })
                };
            }
        }
    };
});

describe('Sprint 04 Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // cleanup
    });

    it('should run parallel batches and filter with Jury', async () => {
        // Mock Imagen response (4 images per batch)
        const mockImagenResponse = {
            predictions: [
                { bytesBase64Encoded: Buffer.from('img1').toString('base64') },
                { bytesBase64Encoded: Buffer.from('img2').toString('base64') },
                { bytesBase64Encoded: Buffer.from('img3').toString('base64') },
                { bytesBase64Encoded: Buffer.from('img4').toString('base64') }
            ]
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockImagenResponse,
            text: async () => ""
        });

        const result = await generateIconVariants(
            "test prompt",
            [Buffer.from("seed")], // Provide seed to trigger Jury
            undefined,
            50,
            "Lineicons",
            50,
            false // disable meta prompt to simplify
        );

        // Verify 2 batches were called (2 fetch calls to Imagen)
        const imagenCalls = mockFetch.mock.calls.filter(call =>
            (call[0] as string).includes('publishers/google/models/imagen-3.0-generate-001:predict')
        );
        expect(imagenCalls.length).toBe(2);

        // Verify result
        expect(result.images.length).toBeGreaterThan(0);
        expect(result.strategy).toBe("OUTLINED");
    });

    it('should enforce floatPrecision: 1 in SVG optimization', async () => {
        // Placeholder for unit test
    });
});
