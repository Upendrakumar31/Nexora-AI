import { getAuth } from "@clerk/express";
import { getUserMetadata } from "../services/userService.js";

export const auth = async (req, res, next) => {
    try {
        let authData = null;
        try {
            authData = getAuth(req);
        } catch {
            // getAuth throws if clerkMiddleware was not registered on req beforehand (e.g. in tests)
        }
        const userId = authData?.userId || (typeof req.auth === 'function' ? req.auth()?.userId : req.auth?.userId) || req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: No userId found" });
        }

        let meta = null;
        let plan = 'free';
        let free_usage = 0;
        try {
            meta = await getUserMetadata(userId);
            plan = meta?.plan || 'free';
            free_usage = Number(meta?.free_usage) || 0;
        } catch (metaError) {
            console.warn(`⚠️ [Auth Middleware] Metadata lookup failed for user ${userId}, defaulting to free plan:`, metaError.message);
        }

        req.userId = userId;
        req.plan = plan;
        req.free_usage = free_usage;
        req.subscription = meta?.subscription || null;

        console.log(`[Diagnostic:Auth] operation=auth_middleware userId=${userId} subscriptionStatus=${req.subscription?.status || 'none'} matchedPlan=${req.subscription?.planSlug || 'none'} normalizedPlan=${plan} freeUsage=${free_usage}`);

        next();
    } catch (error) {
        console.error("🚨 Auth Middleware Error:", error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};
