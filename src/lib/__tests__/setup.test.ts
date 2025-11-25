import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
    it('should pass a basic test', () => {
        expect(1 + 1).toBe(2);
    });

    it('should have access to environment variables', () => {
        // We expect NODE_ENV to be 'test' during testing
        expect(process.env.NODE_ENV).toBe('test');
    });
});
