import { clerkClient, getAuth } from "@clerk/express";

export const auth = async (req, res, next) => {
    try {
        // FIX: Use getAuth(req) to safely extract user ID
        const authData = getAuth(req);
        const userId = authData?.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: No userId found" });
        }

        const user = await clerkClient.users.getUser(userId);

        const currentPlan = user.publicMetadata.plan || 'free';
        const hasPremiumPlan = currentPlan === 'premium';

        if (!hasPremiumPlan && user.privateMetadata.free_usage !== undefined) {
            req.free_usage = user.privateMetadata.free_usage;
        } else if (!hasPremiumPlan) {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: { free_usage: 0 }
            });
            req.free_usage = 0;
        }

        req.plan = hasPremiumPlan ? 'premium' : 'free';
        next();
    } catch (error) {
        console.error("🚨 Auth Middleware Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}