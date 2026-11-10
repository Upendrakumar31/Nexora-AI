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
export const NEXORA_PRO_PLAN_KEY = 'nexora_pro';
export const NEXORA_PRO_PLAN_ID = 'cplan_3LEHfnRMblcgbk48T6cVd3QLW5H';

export async function getUserMetadata(userId) {
    if (!userId) {
        throw new Error('User ID is required to fetch metadata');
    }

    const cacheKey = getUserCacheKey(userId);

    // 1. Try to read from Redis cache
    const cached = await cacheGet(cacheKey);
    if (cached && typeof cached === 'object' && cached.plan) {
        console.log(`[Diagnostic:Subscription] operation=getUserMetadata userId=${userId} fromCache=true subscriptionStatus=${cached.subscription?.status || 'none'} matchedPlan=${cached.subscription?.planSlug || 'none'} normalizedPlan=${cached.plan}`);
        return {
            plan: cached.plan,
            free_usage: Number(cached.free_usage) || 0,
            fromCache: true,
            subscription: cached.subscription || null,
        };
    }

    // 2. Cache miss or Redis offline: Query Clerk API directly
    const user = await clerkClient.users.getUser(userId);

    // Verify active Clerk Billing subscription
    let isSubscribedToPro = false;
    let subscriptionData = null;

    try {
        if (clerkClient.billing?.getUserBillingSubscription) {
            const sub = await clerkClient.billing.getUserBillingSubscription(userId);
            if (sub && sub.status === 'active') {
                const items = Array.isArray(sub.subscriptionItems)
                    ? sub.subscriptionItems
                    : Array.isArray(sub.subscription_items)
                    ? sub.subscription_items
                    : [];

                const activeProItem = items.find(item => {
                    const itemActive = item.status === 'active';
                    const planSlug = (item.plan?.slug || item.plan?.key || '').toLowerCase();
                    const planId = item.planId || item.plan?.id || '';
                    const planName = (item.plan?.name || '').toLowerCase();

                    const matchesPlan =
                        planSlug === NEXORA_PRO_PLAN_KEY ||
                        planSlug.includes('pro') ||
                        planId === NEXORA_PRO_PLAN_ID ||
                        planName.includes('nexora pro') ||
                        planName.includes('pro');

                    return itemActive && matchesPlan;
                });

                if (activeProItem) {
                    isSubscribedToPro = true;
                    subscriptionData = {
                        id: sub.id,
                        status: sub.status,
                        planPeriod: activeProItem.planPeriod || activeProItem.plan_period,
                        planName: activeProItem.plan?.name || 'Nexora Pro',
                        planSlug: activeProItem.plan?.slug || NEXORA_PRO_PLAN_KEY,
                    };
                }
            }
        }
    } catch (billingErr) {
        // Safe failover: Clerk Billing API may 404 if user has no subscription records or billing is in bypass
        console.warn(`[userService] Billing lookup failed for ${userId}:`, billingErr.message);
    }

    // Canonical enforcement: strictly require verified active Clerk subscription.
    // Do not trust arbitrary metadata or client-side claims alone as proof of paid subscription.
    const hasPremiumPlan = Boolean(isSubscribedToPro);
    let free_usage = 0;

    if (!hasPremiumPlan && user.privateMetadata?.free_usage !== undefined) {
        free_usage = Number(user.privateMetadata.free_usage) || 0;
    } else if (!hasPremiumPlan) {
        try {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: { free_usage: 0 },
            });
        } catch {
            // Ignore metadata update error if read-only
        }
        free_usage = 0;
    }

    const metadata = {
        plan: hasPremiumPlan ? 'premium' : 'free',
        free_usage,
        subscription: subscriptionData,
    };

    // 3. Cache the metadata in Redis (short TTL for free users to pick up upgrades quickly, 10 min for verified pro)
    const cacheTtl = hasPremiumPlan ? USER_CACHE_TTL : 30;
    await cacheSet(cacheKey, metadata, cacheTtl);

    console.log(`[Diagnostic:Subscription] operation=getUserMetadata userId=${userId} fromCache=false subscriptionStatus=${subscriptionData?.status || 'none'} matchedPlan=${subscriptionData?.planSlug || 'none'} normalizedPlan=${metadata.plan}`);

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
