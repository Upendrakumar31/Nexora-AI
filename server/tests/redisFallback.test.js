import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cacheGet, cacheSet, cacheDel, isRedisReady, getRedisClient } from '../configs/redis.js';

describe('Redis Cloud Client Fallback & Safety', () => {
    it('handles cacheGet gracefully when Redis is unconfigured or offline', async () => {
        const val = await cacheGet('test_non_existent_key');
        assert.strictEqual(val, null, 'Expected null when key not found or Redis offline');
    });

    it('handles cacheSet gracefully when Redis is unconfigured or offline without throwing', async () => {
        const result = await cacheSet('test_key', { sample: 123 }, 60);
        // Either false (bypassed) or true (if local redis running)
        assert.ok(typeof result === 'boolean');
    });

    it('handles cacheDel gracefully without throwing', async () => {
        const result = await cacheDel('test_key');
        assert.ok(typeof result === 'boolean');
    });

    it('returns boolean status for isRedisReady()', () => {
        const ready = isRedisReady();
        assert.ok(typeof ready === 'boolean');
    });
});
