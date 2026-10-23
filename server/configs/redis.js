import Redis from 'ioredis';
import 'dotenv/config';

/**
 * Nexora AI Redis Cloud Client & Caching Layer
 * Provides failover and cache-bypass when Redis is unreachable or unconfigured.
 */

let redisClient = null;
let isConnected = false;
let hasLoggedWarning = false;

function initRedis() {
    if (redisClient) {
        return redisClient;
    }

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl && !process.env.REDIS_HOST) {
        if (!hasLoggedWarning) {
            console.warn('⚠️  [Redis] No REDIS_URL or REDIS_HOST provided. Running in cache-bypass mode.');
            hasLoggedWarning = true;
        }
        return null;
    }

    try {
        const options = {
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
            lazyConnect: true,
            enableOfflineQueue: false,
            retryStrategy(times) {
                if (times > 3) {
                    return null; // Stop retrying after 3 attempts
                }
                return Math.min(times * 200, 1000);
            },
        };

        if (redisUrl) {
            redisClient = new Redis(redisUrl, options);
        } else {
            redisClient = new Redis({
                host: process.env.REDIS_HOST,
                port: Number(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                ...options,
            });
        }

        redisClient.on('connect', () => {
            isConnected = true;
            console.log('⚡ [Redis] Successfully connected to Redis Cloud.');
        });

        redisClient.on('error', (err) => {
            isConnected = false;
            console.warn(`⚠️  [Redis Warning] Redis connection issue: ${err.message}. Operating in bypass mode.`);
        });

        redisClient.on('close', () => {
            isConnected = false;
        });

        // Trigger connection attempt asynchronously
        redisClient.connect().catch((err) => {
            isConnected = false;
            console.warn(`⚠️  [Redis] Initial connection could not be established: ${err.message}. Cache bypass active.`);
        });

        return redisClient;
    } catch (err) {
        console.warn(`⚠️  [Redis Init Error] ${err.message}. Running in cache-bypass mode.`);
        return null;
    }
}

export function getRedisClient() {
    return initRedis();
}

export function isRedisReady() {
    return isConnected && redisClient !== null && redisClient.status === 'ready';
}

/**
 * Retrieve and parse JSON from Redis cache.
 * Returns null if key does not exist or Redis is offline.
 */
export async function cacheGet(key) {
    const client = initRedis();
    if (!client || !isConnected) return null;

    try {
        const raw = await client.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`[Redis cacheGet error on ${key}]:`, err.message);
        return null;
    }
}

/**
 * Store serialized JSON in Redis cache with TTL in seconds.
 * Fails silently to prevent blocking core operations if Redis is down.
 */
export async function cacheSet(key, value, ttlSeconds = 300) {
    const client = initRedis();
    if (!client || !isConnected) return false;

    try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds && ttlSeconds > 0) {
            await client.set(key, serialized, 'EX', ttlSeconds);
        } else {
            await client.set(key, serialized);
        }
        return true;
    } catch (err) {
        console.warn(`[Redis cacheSet error on ${key}]:`, err.message);
        return false;
    }
}

/**
 * Delete a specific key or list of keys from Redis.
 */
export async function cacheDel(keys) {
    const client = initRedis();
    if (!client || !isConnected) return false;

    try {
        const keyList = Array.isArray(keys) ? keys : [keys];
        if (keyList.length === 0) return true;
        await client.del(...keyList);
        return true;
    } catch (err) {
        console.warn(`[Redis cacheDel error]:`, err.message);
        return false;
    }
}

/**
 * Invalidate all keys matching a given prefix.
 */
export async function cacheInvalidatePrefix(prefix) {
    const client = initRedis();
    if (!client || !isConnected) return false;

    try {
        const keys = await client.keys(`${prefix}*`);
        if (keys.length > 0) {
            await client.del(...keys);
        }
        return true;
    } catch (err) {
        console.warn(`[Redis cacheInvalidatePrefix error on ${prefix}]:`, err.message);
        return false;
    }
}

export default {
    getRedisClient,
    isRedisReady,
    cacheGet,
    cacheSet,
    cacheDel,
    cacheInvalidatePrefix,
};
