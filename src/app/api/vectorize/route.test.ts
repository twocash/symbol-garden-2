import { describe, it, expect, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Mock the ai-icon-service
vi.mock('@/lib/ai-icon-service', () => ({
    vectorizeImage: vi.fn().mockResolvedValue('<svg>mocked</svg>'),
}));

describe('Vectorize API', () => {
    it('should vectorize an uploaded image', async () => {
        // 1. Prepare test image
        const imagePath = path.join(process.cwd(), 'debug', 'test-input.png');
        // Create dummy file if it doesn't exist, just for the test object
        const file = new File(['dummy content'], 'test-input.png', { type: 'image/png' });
        // Mock arrayBuffer since jsdom/node File might not have it or it might fail in this context
        Object.defineProperty(file, 'arrayBuffer', {
            value: async () => Buffer.from('dummy content')
        });

        // 2. Create FormData
        const formData = new FormData();
        formData.append('image', file);

        // 3. Create Mock Request
        const req = {
            formData: async () => {
                const map = new Map();
                map.append = (key: string, value: any) => map.set(key, value);
                map.get = (key: string) => {
                    if (key === 'image') return file;
                    return null;
                };
                return map;
            },
        } as unknown as NextRequest;

        // 4. Call API
        const response = await POST(req);
        const data = await response.json();

        // 5. Assertions
        expect(response.status).toBe(200);
        expect(data).toHaveProperty('svg');
        expect(data.svg).toBe('<svg>mocked</svg>');
    });

    it('should return 400 if no image provided', async () => {
        const req = {
            formData: async () => {
                const map = new Map();
                map.get = () => null;
                return map;
            }
        } as unknown as NextRequest;

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data).toHaveProperty('error');
    });
});
