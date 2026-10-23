import sql from "../configs/db.js";
import { getAuth } from "@clerk/express";
import { getCachedPublishedCreations, invalidateCommunityFeedCache } from "../services/userService.js";

function getUserId(req) {
    const authData = getAuth(req);
    return authData?.userId || (typeof req.auth === 'function' ? req.auth()?.userId : req.auth?.userId);
}

export const getUserCreations = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }

        const creations = await sql`SELECT * FROM creations WHERE user_id = ${userId} ORDER BY created_at DESC`;
        res.json({ success: true, creations });

    } catch (error) {
        console.error("getUserCreations error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getPublishedCreations = async (req, res) => {
    try {
        const { creations } = await getCachedPublishedCreations(async () => {
            return await sql`SELECT * FROM creations WHERE publish = true ORDER BY created_at DESC`;
        });
        res.json({ success: true, creations });

    } catch (error) {
        console.error("getPublishedCreations error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const toggleLikeCreation = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }

        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ success: false, message: "Creation ID is required" });
        }

        const [creation] = await sql`SELECT * FROM creations WHERE id = ${id}`;
        
        if (!creation) {
            return res.status(404).json({ success: false, message: "Creation not found" });
        }

        const currentLikes = Array.isArray(creation.likes) ? creation.likes : [];
        const userIdStr = String(userId);
        let updatedLikes;
        let message;

        if (currentLikes.includes(userIdStr)) {
            updatedLikes = currentLikes.filter((user) => user !== userIdStr);
            message = 'Creation Unliked';
        } else {
            updatedLikes = [...currentLikes, userIdStr];
            message = 'Creation Liked';
        }

        const formattedArray = `{${updatedLikes.map(uid => `"${String(uid).replace(/"/g, '')}"`).join(',')}}`;

        await sql`UPDATE creations SET likes = ${formattedArray}::text[], updated_at = NOW() WHERE id = ${id}`;

        // Invalidate cached community feed since like count changed
        await invalidateCommunityFeedCache();

        res.json({ success: true, message, likes: updatedLikes });

    } catch (error) {
        console.error("toggleLikeCreation error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};