import { clerkClient } from '@clerk/express';
import { cacheGet, cacheSet, cacheDel } from '../configs/redis.js';

export const USER_CACHE_TTL = 600; // 10 minutes in seconds
export const FEED_CACHE_TTL = 300; // 5 minutes in seconds
export const COMMUNITY_FEED_CACHE_KEY = 'nexora:feed:published';

export function getUserCacheKey(userId) {
    return `nexora:user:${userId}:meta`;
}

/**
 * Retrieve user plan and quota usage.
 * Checks Redis cache first (10 min TTL). If cache miss or Redis is unavailable,
 * retrieves directly from Clerk and populates the cache.
 */
export async function getUserMetadata(userId) {
    if (!userId) {
        throw new Error('User ID is required to fetch metadata');
    }

    const cacheKey = getUserCacheKey(userId);

    // 1. Try to read from Redis cache
    const cached = await cacheGet(cacheKey);
    if (cached && typeof cached === 'object' && cached.plan) {
        return {
            plan: cached.plan,
            free_usage: Number(cached.free_usage) || 0,
            fromCache: true,
        };
    }

    // 2. Cache miss or Redis offline: Query Clerk API directly
    const user = await clerkClient.users.getUser(userId);

    const currentPlan = user.publicMetadata?.plan || 'free';
    const hasPremiumPlan = currentPlan === 'premium';
    let free_usage = 0;

    if (!hasPremiumPlan && user.privateMetadata?.free_usage !== undefined) {
        free_usage = Number(user.privateMetadata.free_usage) || 0;
    } else if (!hasPremiumPlan) {
        await clerkClient.users.updateUserMetadata(userId, {
            privateMetadata: { free_usage: 0 },
        });
        free_usage = 0;
    }

    const metadata = {
        plan: hasPremiumPlan ? 'premium' : 'free',
        free_usage,
    };

    // 3. Cache the metadata in Redis (safe even if Redis fails)
    await cacheSet(cacheKey, metadata, USER_CACHE_TTL);

    return {
        ...metadata,
        fromCache: false,
    };
}

/**
 * Increment user free quota usage in Clerk and immediately update the cache.
 * Guarantees that users cannot bypass the 10-generation limit via stale cache.
 */
export async function recordUsageIncrement(userId, currentUsage = 0) {
    if (!userId) return;

    const newUsage = (Number(currentUsage) || 0) + 1;

    // Update Clerk primary source of truth
    await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
            free_usage: newUsage,
        },
    });

    // Immediately update Redis cache with new count to enforce quota on next call
    const cacheKey = getUserCacheKey(userId);
    await cacheSet(cacheKey, { plan: 'free', free_usage: newUsage }, USER_CACHE_TTL);

    return newUsage;
}

/**
 * Invalidate user metadata cache (e.g. on upgrade or explicit reset).
 */
export async function invalidateUserCache(userId) {
    if (!userId) return;
    const cacheKey = getUserCacheKey(userId);
    await cacheDel(cacheKey);
}

/**
 * Retrieve cached public community feed or query DB if miss.
 */
export async function getCachedPublishedCreations(fetchFromDb) {
    // 1. Check Redis cache
    const cached = await cacheGet(COMMUNITY_FEED_CACHE_KEY);
    if (cached && Array.isArray(cached)) {
        return { creations: cached, fromCache: true };
    }

    // 2. Fetch fresh from Neon database
    const creations = await fetchFromDb();

    // 3. Populate Redis cache
    if (Array.isArray(creations)) {
        await cacheSet(COMMUNITY_FEED_CACHE_KEY, creations, FEED_CACHE_TTL);
    }

    return { creations, fromCache: false };
}

/**
 * Invalidate the public community feed cache.
 * Must be called whenever a creation is published or likes are updated.
 */
export async function invalidateCommunityFeedCache() {
    await cacheDel(COMMUNITY_FEED_CACHE_KEY);
}

export default {
    getUserMetadata,
    recordUsageIncrement,
    invalidateUserCache,
    getCachedPublishedCreations,
    invalidateCommunityFeedCache,
};
