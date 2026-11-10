import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import sql from '../configs/db.js';
import axios from 'axios';
import {
    getUserMetadata,
    getUserCacheKey,
    NEXORA_PRO_PLAN_KEY,
    NEXORA_PRO_PLAN_ID,
} from '../services/userService.js';
import { cacheDel, getRedisClient } from '../configs/redis.js';
import { clerkClient } from '@clerk/express';
import {
    generateImage,
    removeImageBackground,
    resumeReview,
} from '../controllers/aiController.js';
import { auth } from '../middlewares/auth.js';
import connectCloudinary from '../configs/cloudinary.js';
import { isSubscriptionEntitlementError } from '../../client/src/utils/subscriptionUtils.js';

describe('Clerk Billing User Subscription Plan Verification & Gating', () => {
    after(() => {
        const client = getRedisClient();
        if (client) {
            client.disconnect();
        }
    });

    it('identifies Nexora Pro plan keys and constants correctly', () => {
        assert.strictEqual(NEXORA_PRO_PLAN_KEY, 'nexora_pro');
        assert.strictEqual(NEXORA_PRO_PLAN_ID, 'cplan_3LEHfnRMblcgbk48T6cVd3QLW5H');
    });

    it('resolves plan to "free" when user has standard free subscription and no active pro item', async () => {
        const testUserId = 'test_user_free_billing_' + Date.now();

        const originalGetUser = clerkClient.users.getUser;
        const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

        clerkClient.users.getUser = async () => ({
            id: testUserId,
            publicMetadata: {},
            privateMetadata: { free_usage: 3 },
        });

        if (!clerkClient.billing) clerkClient.billing = {};
        clerkClient.billing.getUserBillingSubscription = async () => ({
            id: 'csub_free_test',
            status: 'active',
            subscriptionItems: [
                {
                    id: 'csub_item_free',
                    status: 'active',
                    plan: { slug: 'free_user', name: 'Free' },
                    planId: 'cplan_free_test',
                    planPeriod: 'month',
                },
            ],
        });

        try {
            await cacheDel(getUserCacheKey(testUserId));
            const meta = await getUserMetadata(testUserId);

            assert.strictEqual(meta.plan, 'free');
            assert.strictEqual(meta.free_usage, 3);
            assert.strictEqual(meta.subscription, null);
            assert.strictEqual(meta.fromCache, false);
        } finally {
            clerkClient.users.getUser = originalGetUser;
            if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
            await cacheDel(getUserCacheKey(testUserId));
        }
    });

    it('resolves plan to "premium" when user has a genuinely active Nexora Pro Clerk Billing subscription', async () => {
        const testUserId = 'test_user_pro_billing_' + Date.now();

        const originalGetUser = clerkClient.users.getUser;
        const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

        clerkClient.users.getUser = async () => ({
            id: testUserId,
            publicMetadata: {},
            privateMetadata: { free_usage: 10 },
        });

        if (!clerkClient.billing) clerkClient.billing = {};
        clerkClient.billing.getUserBillingSubscription = async () => ({
            id: 'csub_pro_123',
            status: 'active',
            subscriptionItems: [
                {
                    id: 'csub_item_pro_123',
                    status: 'active',
                    plan: { slug: NEXORA_PRO_PLAN_KEY, name: 'Nexora Pro' },
                    planId: NEXORA_PRO_PLAN_ID,
                    planPeriod: 'annual',
                },
            ],
        });

        try {
            await cacheDel(getUserCacheKey(testUserId));
            const meta = await getUserMetadata(testUserId);

            assert.strictEqual(meta.plan, 'premium');
            assert.ok(meta.subscription, 'Subscription object should be returned');
            assert.strictEqual(meta.subscription.id, 'csub_pro_123');
            assert.strictEqual(meta.subscription.planSlug, NEXORA_PRO_PLAN_KEY);
            assert.strictEqual(meta.subscription.planPeriod, 'annual');
        } finally {
            clerkClient.users.getUser = originalGetUser;
            if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
            await cacheDel(getUserCacheKey(testUserId));
        }
    });

    it('falls back to "free" and blocks user when subscription is canceled', async () => {
        const testUserId = 'test_user_canceled_' + Date.now();

        const originalGetUser = clerkClient.users.getUser;
        const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

        clerkClient.users.getUser = async () => ({
            id: testUserId,
            publicMetadata: {},
            privateMetadata: { free_usage: 2 },
        });

        if (!clerkClient.billing) clerkClient.billing = {};
        clerkClient.billing.getUserBillingSubscription = async () => ({
            id: 'csub_canceled',
            status: 'canceled',
            subscriptionItems: [
                {
                    id: 'csub_item_canceled',
                    status: 'canceled',
                    plan: { slug: NEXORA_PRO_PLAN_KEY, name: 'Nexora Pro' },
                    planId: NEXORA_PRO_PLAN_ID,
                    planPeriod: 'month',
                },
            ],
        });

        try {
            await cacheDel(getUserCacheKey(testUserId));
            const meta = await getUserMetadata(testUserId);

            assert.strictEqual(meta.plan, 'free');
            assert.strictEqual(meta.subscription, null);
        } finally {
            clerkClient.users.getUser = originalGetUser;
            if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
            await cacheDel(getUserCacheKey(testUserId));
        }
    });

    it('falls back to "free" when subscription status is past_due or incomplete', async () => {
        const testUserId = 'test_user_past_due_' + Date.now();

        const originalGetUser = clerkClient.users.getUser;
        const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

        clerkClient.users.getUser = async () => ({
            id: testUserId,
            publicMetadata: {},
            privateMetadata: { free_usage: 1 },
        });

        if (!clerkClient.billing) clerkClient.billing = {};
        clerkClient.billing.getUserBillingSubscription = async () => ({
            id: 'csub_past_due',
            status: 'past_due',
            subscriptionItems: [
                {
                    id: 'csub_item_past_due',
                    status: 'past_due',
                    plan: { slug: NEXORA_PRO_PLAN_KEY, name: 'Nexora Pro' },
                    planId: NEXORA_PRO_PLAN_ID,
                    planPeriod: 'month',
                },
            ],
        });

        try {
            await cacheDel(getUserCacheKey(testUserId));
            const meta = await getUserMetadata(testUserId);

            assert.strictEqual(meta.plan, 'free');
            assert.strictEqual(meta.subscription, null);
        } finally {
            clerkClient.users.getUser = originalGetUser;
            if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
            await cacheDel(getUserCacheKey(testUserId));
        }
    });

    it('does NOT trust arbitrary publicMetadata alone: blocks users without a verified active Clerk Pro subscription', async () => {
        const testUserId = 'test_user_fake_meta_' + Date.now();

        const originalGetUser = clerkClient.users.getUser;
        const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

        // User claims to be premium in publicMetadata, but has no active paid subscription
        clerkClient.users.getUser = async () => ({
            id: testUserId,
            publicMetadata: { plan: 'premium' },
            privateMetadata: {},
        });

        if (!clerkClient.billing) clerkClient.billing = {};
        clerkClient.billing.getUserBillingSubscription = async () => ({
            id: 'csub_free',
            status: 'active',
            subscriptionItems: [
                {
                    id: 'csub_item_free',
                    status: 'active',
                    plan: { slug: 'free_user', name: 'Free' },
                    planId: 'cplan_free_test',
                    planPeriod: 'month',
                },
            ],
        });

        try {
            await cacheDel(getUserCacheKey(testUserId));
            const meta = await getUserMetadata(testUserId);

            // Must NOT trust arbitrary metadata; must resolve to 'free'
            assert.strictEqual(meta.plan, 'free');
            assert.strictEqual(meta.subscription, null);
        } finally {
            clerkClient.users.getUser = originalGetUser;
            if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
            await cacheDel(getUserCacheKey(testUserId));
        }
    });

    it('enforces backend premium gating: generateImage strictly returns HTTP 403 for non-premium users', async () => {
        const req = {
            userId: 'user_free_tester',
            plan: 'free',
            body: { prompt: 'A futuristic city in cyberpunk aesthetic' },
        };

        let responsePayload = null;
        let responseStatusCode = null;
        const res = {
            json(data) {
                responsePayload = data;
                return this;
            },
            status(code) {
                responseStatusCode = code;
                return this;
            },
        };

        await generateImage(req, res);

        assert.strictEqual(responseStatusCode, 403, 'generateImage must return HTTP 403 for free users');
        assert.ok(responsePayload, 'Expected response payload from generateImage');
        assert.strictEqual(responsePayload.success, false);
        assert.ok(
            responsePayload.message.includes('premium subscriptions') ||
            responsePayload.message.includes('only available for premium'),
            `Expected premium rejection message, got: ${responsePayload.message}`
        );
    });

    it('enforces backend premium gating: generateImage strictly returns HTTP 403 for canceled subscribers', async () => {
        const req = {
            userId: 'user_canceled_tester',
            plan: 'free', // Canceled subscription resolves to 'free'
            body: { prompt: 'A mystical forest in autumn' },
        };

        let responsePayload = null;
        let responseStatusCode = null;
        const res = {
            json(data) {
                responsePayload = data;
                return this;
            },
            status(code) {
                responseStatusCode = code;
                return this;
            },
        };

        await generateImage(req, res);

        assert.strictEqual(responseStatusCode, 403);
        assert.strictEqual(responsePayload.success, false);
    });

    it('enforces backend premium gating: removeImageBackground strictly returns HTTP 403 for non-premium users', async () => {
        const req = {
            userId: 'user_free_tester',
            plan: 'free',
            file: { path: '/tmp/fake.png' },
        };

        let responsePayload = null;
        let responseStatusCode = null;
        const res = {
            json(data) {
                responsePayload = data;
                return this;
            },
            status(code) {
                responseStatusCode = code;
                return this;
            },
        };

        await removeImageBackground(req, res);

        assert.strictEqual(responseStatusCode, 403);
        assert.strictEqual(responsePayload.success, false);
        assert.ok(responsePayload.message.includes('premium subscriptions'));
    });

    it('enforces backend premium gating: removeImageBackground strictly returns HTTP 403 for canceled subscribers', async () => {
        const req = {
            userId: 'user_canceled_tester',
            plan: 'free', // Canceled subscription resolves to 'free'
            file: { path: '/tmp/fake.png' },
        };

        let responsePayload = null;
        let responseStatusCode = null;
        const res = {
            json(data) {
                responsePayload = data;
                return this;
            },
            status(code) {
                responseStatusCode = code;
                return this;
            },
        };

        await removeImageBackground(req, res);

        assert.strictEqual(responseStatusCode, 403);
        assert.strictEqual(responsePayload.success, false);
        assert.ok(responsePayload.message.includes('premium subscriptions'));
    });

    it('enforces backend premium gating: resumeReview strictly returns HTTP 403 for non-premium users', async () => {
        const req = {
            userId: 'user_free_tester',
            plan: 'free',
            file: { path: '/tmp/fake.pdf' },
        };

        let responsePayload = null;
        let responseStatusCode = null;
        const res = {
            json(data) {
                responsePayload = data;
                return this;
            },
            status(code) {
                responseStatusCode = code;
                return this;
            },
        };

        await resumeReview(req, res);

        assert.strictEqual(responseStatusCode, 403);
        assert.strictEqual(responsePayload.success, false);
        assert.ok(responsePayload.message.includes('premium subscriptions'));
    });

    describe('auth middleware verification', () => {
        it('returns 401 when request has no userId', async () => {
            const req = { auth: null };
            let statusCode = null;
            let responseBody = null;
            const res = {
                status(code) {
                    statusCode = code;
                    return this;
                },
                json(data) {
                    responseBody = data;
                    return this;
                },
            };
            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await auth(req, res, next);

            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseBody?.success, false);
            assert.strictEqual(nextCalled, false);
        });

        it('populates req.userId, req.plan, req.subscription, and req.free_usage without ReferenceError', async () => {
            const testUserId = 'test_user_auth_mw_' + Date.now();
            const req = {
                auth: { userId: testUserId },
            };

            const originalGetUser = clerkClient.users.getUser;
            const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

            clerkClient.users.getUser = async () => ({
                id: testUserId,
                publicMetadata: {},
                privateMetadata: { free_usage: 4 },
            });

            if (!clerkClient.billing) clerkClient.billing = {};
            clerkClient.billing.getUserBillingSubscription = async () => ({
                id: 'csub_auth_pro',
                status: 'active',
                subscriptionItems: [
                    {
                        id: 'item_pro',
                        status: 'active',
                        plan: { slug: NEXORA_PRO_PLAN_KEY, name: 'Nexora Pro' },
                        planId: NEXORA_PRO_PLAN_ID,
                        planPeriod: 'month',
                    },
                ],
            });

            let nextCalled = false;
            const next = () => { nextCalled = true; };
            const res = {
                status() { return this; },
                json() { return this; },
            };

            try {
                await cacheDel(getUserCacheKey(testUserId));
                await auth(req, res, next);

                assert.strictEqual(nextCalled, true, 'next() must be called');
                assert.strictEqual(req.userId, testUserId);
                assert.strictEqual(req.plan, 'premium');
                assert.strictEqual(req.free_usage, 0);
                assert.ok(req.subscription, 'req.subscription must be populated');
                assert.strictEqual(req.subscription.planSlug, NEXORA_PRO_PLAN_KEY);
            } finally {
                clerkClient.users.getUser = originalGetUser;
                if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
                await cacheDel(getUserCacheKey(testUserId));
            }
        });

        it('gracefully handles metadata failure, defaulting to free plan without throwing meta is not defined', async () => {
            const testUserId = 'test_user_fail_meta_' + Date.now();
            const req = {
                auth: { userId: testUserId },
            };

            const originalGetUser = clerkClient.users.getUser;
            clerkClient.users.getUser = async () => {
                throw new Error('Simulated Clerk API Network Timeout');
            };

            let nextCalled = false;
            const next = () => { nextCalled = true; };
            const res = {
                status() { return this; },
                json() { return this; },
            };

            try {
                await cacheDel(getUserCacheKey(testUserId));
                await auth(req, res, next);

                assert.strictEqual(nextCalled, true, 'next() should be called despite metadata error');
                assert.strictEqual(req.userId, testUserId);
                assert.strictEqual(req.plan, 'free');
                assert.strictEqual(req.free_usage, 0);
                assert.strictEqual(req.subscription, null);
            } finally {
                clerkClient.users.getUser = originalGetUser;
                await cacheDel(getUserCacheKey(testUserId));
            }
        });
    });

    describe('Cloudinary HTTP 403 Fallback & Safe Diagnostic Logs', () => {
        it('gracefully handles Cloudinary HTTP 403 upload failure for active Pro subscribers by falling back to base64 data URI', async () => {
            const testUserId = 'test_user_pro_cloud403_' + Date.now();
            const testPrompt = 'A majestic neon tiger in a rainforest';

            const originalUpload = cloudinary.uploader.upload;
            const originalAxiosPost = axios.post;

            const fakeBuffer = Buffer.from('mock_tiger_image_data');
            axios.post = async (url) => {
                if (url.includes('clipdrop')) {
                    return {
                        status: 200,
                        data: fakeBuffer,
                        headers: { 'content-type': 'image/png' },
                    };
                }
                return originalAxiosPost.apply(axios, arguments);
            };

            // Simulate Cloudinary 403 Forbidden due to missing "create" action permission
            cloudinary.uploader.upload = async () => {
                const err = new Error('Server returned unexpected status code - 403');
                err.http_code = 403;
                throw err;
            };

            const req = {
                userId: testUserId,
                plan: 'premium', // Verified active Pro user
                body: { prompt: testPrompt, publish: false },
            };

            let responsePayload = null;
            let responseStatusCode = 200;
            const res = {
                status(code) {
                    responseStatusCode = code;
                    return this;
                },
                json(data) {
                    responsePayload = data;
                    return this;
                },
            };

            try {
                await generateImage(req, res);

                assert.strictEqual(responseStatusCode, 200);
                assert.strictEqual(responsePayload.success, true);
                assert.ok(responsePayload.content.startsWith('data:image/png;base64,'));
                assert.strictEqual(
                    responsePayload.content,
                    `data:image/png;base64,${fakeBuffer.toString('base64')}`
                );
            } finally {
                cloudinary.uploader.upload = originalUpload;
                axios.post = originalAxiosPost;
                try {
                    await sql`DELETE FROM creations WHERE user_id = ${testUserId}`;
                } catch {}
            }
        });

        it('gracefully handles Cloudinary HTTP 403 background removal failure for active Pro subscribers by falling back to Clipdrop remove-background', async () => {
            const testUserId = 'test_user_pro_bg403_' + Date.now();
            const tmpFile = path.join(os.tmpdir(), `test_bg_${Date.now()}.png`);
            fs.writeFileSync(tmpFile, Buffer.from('fake_original_image'));

            const originalUpload = cloudinary.uploader.upload;
            const originalAxiosPost = axios.post;

            const fakeBgBuffer = Buffer.from('mock_nobg_image_data');
            axios.post = async (url) => {
                if (url.includes('remove-background')) {
                    return {
                        status: 200,
                        data: fakeBgBuffer,
                        headers: { 'content-type': 'image/png' },
                    };
                }
                return originalAxiosPost.apply(axios, arguments);
            };

            cloudinary.uploader.upload = async () => {
                const err = new Error('Server returned unexpected status code - 403');
                err.http_code = 403;
                throw err;
            };

            const req = {
                userId: testUserId,
                plan: 'premium',
                file: { path: tmpFile },
            };

            let responsePayload = null;
            let responseStatusCode = 200;
            const res = {
                status(code) {
                    responseStatusCode = code;
                    return this;
                },
                json(data) {
                    responsePayload = data;
                    return this;
                },
            };

            try {
                await removeImageBackground(req, res);

                assert.strictEqual(responseStatusCode, 200);
                assert.strictEqual(responsePayload.success, true);
                assert.ok(responsePayload.content.startsWith('data:image/png;base64,'));
                assert.strictEqual(
                    responsePayload.content,
                    `data:image/png;base64,${fakeBgBuffer.toString('base64')}`
                );
            } finally {
                cloudinary.uploader.upload = originalUpload;
                axios.post = originalAxiosPost;
                if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
                try {
                    await sql`DELETE FROM creations WHERE user_id = ${testUserId}`;
                } catch {}
            }
        });

        it('emits safe diagnostic logs with operation and plan details without leaking secrets', async () => {
            const logs = [];
            const originalLog = console.log;
            const originalWarn = console.warn;
            const originalError = console.error;

            const intercept = (...args) => {
                logs.push(args.join(' '));
            };
            console.log = intercept;
            console.warn = intercept;
            console.error = intercept;

            const testUserId = 'test_user_diag_' + Date.now();
            const req = {
                auth: { userId: testUserId },
            };

            const originalGetUser = clerkClient.users.getUser;
            const originalGetSub = clerkClient.billing?.getUserBillingSubscription;

            clerkClient.users.getUser = async () => ({
                id: testUserId,
                publicMetadata: {},
                privateMetadata: { free_usage: 1 },
            });

            if (!clerkClient.billing) clerkClient.billing = {};
            clerkClient.billing.getUserBillingSubscription = async () => ({
                id: 'csub_diag_test',
                status: 'active',
                subscriptionItems: [
                    {
                        id: 'item_diag',
                        status: 'active',
                        plan: { slug: NEXORA_PRO_PLAN_KEY, name: 'Nexora Pro' },
                        planId: NEXORA_PRO_PLAN_ID,
                        planPeriod: 'month',
                    },
                ],
            });

            let nextCalled = false;
            const res = {
                status() { return this; },
                json() { return this; },
            };

            try {
                await cacheDel(getUserCacheKey(testUserId));
                await auth(req, res, () => { nextCalled = true; });

                assert.strictEqual(nextCalled, true);
                assert.strictEqual(req.plan, 'premium');

                const allLogs = logs.join('\n');
                assert.ok(allLogs.includes('[Diagnostic:Auth]'));
                assert.ok(allLogs.includes('operation=auth_middleware'));
                assert.ok(allLogs.includes(`userId=${testUserId}`));
                assert.ok(allLogs.includes('normalizedPlan=premium'));
                assert.ok(allLogs.includes('subscriptionStatus=active'));
                assert.ok(allLogs.includes(`matchedPlan=${NEXORA_PRO_PLAN_KEY}`));

                // Verify no secrets or sensitive keys appear in logs
                assert.ok(!allLogs.includes('sk_test_'), 'No secret keys allowed in logs');
                assert.ok(!allLogs.includes('Bearer '), 'No tokens allowed in logs');
                assert.ok(!allLogs.includes('eyJh'), 'No JWT headers allowed in logs');
            } finally {
                console.log = originalLog;
                console.warn = originalWarn;
                console.error = originalError;
                clerkClient.users.getUser = originalGetUser;
                if (clerkClient.billing) clerkClient.billing.getUserBillingSubscription = originalGetSub;
                await cacheDel(getUserCacheKey(testUserId));
            }
        });

        it('connectCloudinary prioritizes CLOUDINARY_URL and does not clobber it with undefined properties', async () => {
            const savedUrl = process.env.CLOUDINARY_URL;
            const savedName = process.env.CLOUDINARY_CLOUD_NAME;
            const savedKey = process.env.CLOUDINARY_API_KEY;
            const savedSecret = process.env.CLOUDINARY_API_SECRET;

            try {
                process.env.CLOUDINARY_URL = 'cloudinary://urlkey999:urlsec999@urlcloud999';
                delete process.env.CLOUDINARY_CLOUD_NAME;
                delete process.env.CLOUDINARY_API_KEY;
                delete process.env.CLOUDINARY_API_SECRET;

                await connectCloudinary();
                const cfg = cloudinary.config();
                assert.strictEqual(cfg.cloud_name, 'urlcloud999');
                assert.strictEqual(cfg.api_key, 'urlkey999');
            } finally {
                if (savedUrl !== undefined) process.env.CLOUDINARY_URL = savedUrl; else delete process.env.CLOUDINARY_URL;
                if (savedName !== undefined) process.env.CLOUDINARY_CLOUD_NAME = savedName; else delete process.env.CLOUDINARY_CLOUD_NAME;
                if (savedKey !== undefined) process.env.CLOUDINARY_API_KEY = savedKey; else delete process.env.CLOUDINARY_API_KEY;
                if (savedSecret !== undefined) process.env.CLOUDINARY_API_SECRET = savedSecret; else delete process.env.CLOUDINARY_API_SECRET;
                await connectCloudinary();
            }
        });

        it('isSubscriptionEntitlementError distinguishes genuine plan gating from Cloudinary 403 and upstream 502 errors', () => {
            // Upstream storage and technical errors must NEVER trigger checkout
            assert.strictEqual(isSubscriptionEntitlementError({ response: { status: 502, data: { message: 'Image processing service unavailable (upstream storage error).' } } }), false);
            assert.strictEqual(isSubscriptionEntitlementError({ response: { status: 403, data: { message: 'Server returned unexpected status code - 403' } } }), false);
            assert.strictEqual(isSubscriptionEntitlementError({ response: { status: 403, data: { message: '[prodenv:9ee] Request forbidden due to missing permissions (actions=["create"])' } } }), false);
            assert.strictEqual(isSubscriptionEntitlementError('Cloudinary upload rejected: forbidden'), false);
            assert.strictEqual(isSubscriptionEntitlementError({ response: { status: 500, data: { message: 'Internal Server Error' } } }), false);
            assert.strictEqual(isSubscriptionEntitlementError(null), false);

            // Genuine subscription gating errors MUST trigger checkout
            assert.strictEqual(isSubscriptionEntitlementError({ response: { status: 403, data: { message: 'This feature is only available for premium subscriptions' } } }), true);
            assert.strictEqual(isSubscriptionEntitlementError('Free tier limit reached. Please upgrade to Nexora Pro.'), true);
            assert.strictEqual(isSubscriptionEntitlementError({ response: { status: 403, data: { message: 'Upgrade to Nexora Pro' } } }), true);
        });
    });
});
