import { getAuth } from "@clerk/express";
import { getUserMetadata } from "../services/userService.js";

export const auth = async (req, res, next) => {
    try {
        const authData = getAuth(req);
        const userId = authData?.userId || (typeof req.auth === 'function' ? req.auth()?.userId : req.auth?.userId);

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: No userId found" });
        }

        const { plan, free_usage } = await getUserMetadata(userId);

        req.userId = userId;
        req.plan = plan;
        req.free_usage = free_usage;

        next();
    } catch (error) {
        console.error("🚨 Auth Middleware Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};