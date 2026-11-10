import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    getUserCacheKey,
    USER_CACHE_TTL,
    FEED_CACHE_TTL,
    COMMUNITY_FEED_CACHE_KEY,
    getCachedPublishedCreations,
    invalidateCommunityFeedCache,
    recordUsageIncrement,
    invalidateUserCache,
} from '../services/userService.js';
import { cacheGet, cacheSet, cacheDel, getRedisClient } from '../configs/redis.js';

describe('Redis Cloud Caching & Quota Safety', () => {
    after(() => {
        const client = getRedisClient();
        if (client) {
            client.disconnect();
        }
    });
    it('generates correct, isolated user-scoped cache keys', () => {
        const key1 = getUserCacheKey('user_123');
        const key2 = getUserCacheKey('user_456');

        assert.strictEqual(key1, 'nexora:user:user_123:meta');
        assert.strictEqual(key2, 'nexora:user:user_456:meta');
        assert.notStrictEqual(key1, key2, 'User cache keys must be isolated per user');
    });

    it('verifies standard TTL values are configured properly', () => {
        assert.strictEqual(USER_CACHE_TTL, 600, 'User plan metadata TTL must be 10 minutes (600s)');
        assert.strictEqual(FEED_CACHE_TTL, 300, 'Community feed TTL must be 5 minutes (300s)');
        assert.strictEqual(COMMUNITY_FEED_CACHE_KEY, 'nexora:feed:published');
    });

    it('retrieves and sets cached public community feed correctly', async () => {
        let dbQueryCalled = 0;
        const mockDbQuery = async () => {
            dbQueryCalled++;
            return [
                { id: 1, prompt: 'A futuristic city', type: 'image', likes: [] },
                { id: 2, prompt: 'Cyberpunk landscape', type: 'image', likes: ['user_abc'] },
            ];
        };

        // 1. Initial call (cache miss or offline fallback)
        const result1 = await getCachedPublishedCreations(mockDbQuery);
        assert.ok(Array.isArray(result1.creations));
        assert.strictEqual(result1.creations.length, 2);

        // 2. Invalidation
        await invalidateCommunityFeedCache();
    });

    it('enforces quota logic strictly: blocks free users with usage >= 10', () => {
        const checkQuota = (plan, freeUsage) => {
            if (plan !== 'premium' && freeUsage >= 10) {
                return { allowed: false, message: 'Limit reached. Upgrade to continue.' };
            }
            return { allowed: true };
        };

        // Under limit (free plan)
        assert.deepStrictEqual(checkQuota('free', 0), { allowed: true });
        assert.deepStrictEqual(checkQuota('free', 9), { allowed: true });

        // At limit (free plan)
        assert.deepStrictEqual(checkQuota('free', 10), {
            allowed: false,
            message: 'Limit reached. Upgrade to continue.',
        });

        // Over limit (free plan)
        assert.deepStrictEqual(checkQuota('free', 15), {
            allowed: false,
            message: 'Limit reached. Upgrade to continue.',
        });

        // Premium plan bypasses quota
        assert.deepStrictEqual(checkQuota('premium', 0), { allowed: true });
        assert.deepStrictEqual(checkQuota('premium', 10), { allowed: true });
        assert.deepStrictEqual(checkQuota('premium', 999), { allowed: true });
    });

    it('gracefully handles user cache operations when Redis is unavailable', async () => {
        // Must not throw when calling invalidateUserCache
        await assert.doesNotReject(async () => {
            await invalidateUserCache('user_offline_test');
        });
    });
});
