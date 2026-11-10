
import OpenAI from "openai";
import { getAuth } from "@clerk/express";
import sql from "../configs/db.js";
import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import fs from "fs";
import { resumeReviewSchema, parseReviewResponse, reviewToMarkdown } from "../schemas/resumeReview.js";
import { recordUsageIncrement, invalidateCommunityFeedCache } from "../services/userService.js";
import { generateImageBuffer, removeBackgroundBuffer } from "../services/imageService.js";
import { createGroqChatCompletion, extractCompletionText, DEFAULT_GROQ_MODEL, AI } from "../services/groqService.js";

const GROQ_MODEL = DEFAULT_GROQ_MODEL;

function getUserId(req) {
    if (req.userId) return req.userId;
    try {
        const authData = getAuth(req);
        return authData?.userId || (typeof req.auth === 'function' ? req.auth()?.userId : req.auth?.userId);
    } catch {
        return typeof req.auth === 'function' ? req.auth()?.userId : req.auth?.userId;
    }
}

export const generateArticle = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }

        const { prompt, length } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "Limit reached. Upgrade to continue.",
            });
        }

        const response = await createGroqChatCompletion({
            model: GROQ_MODEL,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: parseInt(length) || 500,
        });

        const content = extractCompletionText(response);

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'article')
        `;

        if (plan !== "premium") {
            await recordUsageIncrement(userId, free_usage);
        }

        res.json({ success: true, content });
    } catch (error) {
        if (error.status === 429) {
            return res.status(429).json({
                success: false,
                message: "Rate limit reached. Please wait 30 seconds.",
            });
        }

        console.error("Article Generation Error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const generateBlogTitle = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }

        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "Limit reached. Upgrade to continue.",
            });
        }

        const response = await createGroqChatCompletion({
            model: GROQ_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are an expert SEO copywriter. Generate exactly 5 distinct, catchy, high-converting blog titles. Return only the 5 titles as a numbered list (1 to 5), without introductory or concluding conversational text."
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 500,
        });

        const content = extractCompletionText(response);

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
        `;

        if (plan !== "premium") {
            await recordUsageIncrement(userId, free_usage);
        }

        res.json({ success: true, content });
    } catch (error) {
        if (error.status === 429) {
            return res.status(429).json({
                success: false,
                message: "Rate limit reached. Please wait 30 seconds.",
            });
        }

        console.error("Blog Title Generation Error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const generateImage = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }

        const { prompt, publish } = req.body;
        const plan = req.plan;

        console.log(`[Diagnostic:Access] operation=generate_image userId=${userId} normalizedPlan=${plan} allowed=${plan === 'premium'}`);

        if (plan !== "premium") {
            console.warn(`[Diagnostic:Access] operation=generate_image userId=${userId} normalizedPlan=${plan} HTTP_STATUS=403 message="This feature is only available for premium subscriptions"`);
            return res.status(403).json({
                success: false,
                message: "This feature is only available for premium subscriptions",
            });
        }

        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return res.status(400).json({
                success: false,
                message: "A prompt is required for image generation.",
            });
        }

        const { buffer, mimeType } = await generateImageBuffer(prompt);

        const base64Image = `data:${mimeType};base64,${buffer.toString("base64")}`;

        let finalImageUrl = base64Image;

        // Attempt Cloudinary upload; gracefully fallback to base64 data URI if Cloudinary upload fails (e.g. HTTP 403 missing permissions)
        try {
            const uploadResult = await cloudinary.uploader.upload(base64Image);
            if (uploadResult?.secure_url) {
                finalImageUrl = uploadResult.secure_url;
            }
        } catch (uploadError) {
            const uploadHttpCode = uploadError.http_code || uploadError.status || uploadError.statusCode || 403;
            console.warn(`[Diagnostic:Cloudinary] operation=generate_image_upload HTTP_STATUS=${uploadHttpCode} warning="Cloudinary upload rejected (${uploadError.message}), falling back to base64 data URI"`);
            finalImageUrl = base64Image;
        }

        await sql`
            INSERT INTO creations (user_id, prompt, content, type, publish)
            VALUES (${userId}, ${prompt}, ${finalImageUrl}, 'image', ${publish ?? false})
        `;

        if (publish) {
            await invalidateCommunityFeedCache();
        }

        res.json({ success: true, content: finalImageUrl });
    } catch (error) {
        const externalStatus = error.http_code || error.response?.status || error.status || error.statusCode || null;

        // Log the external service's response for diagnosis.
        let externalResponse = null;

        if (error.response?.data) {
            const responseData = error.response.data;

            try {
                if (Buffer.isBuffer(responseData)) {
                    externalResponse = responseData.toString("utf8");
                } else if (responseData instanceof ArrayBuffer) {
                    externalResponse = Buffer.from(responseData).toString("utf8");
                } else if (typeof responseData === "string") {
                    externalResponse = responseData;
                } else {
                    externalResponse = JSON.stringify(responseData);
                }
            } catch {
                externalResponse = "[Could not decode external response]";
            }
        }

        console.error("[Diagnostic:AIController] operation=generate_image error:", {
            message: error.message,
            status: externalStatus,
            response: externalResponse,
        });

        if (externalStatus === 429 || error.status === 429) {
            return res.status(429).json({
                success: false,
                message: error.message || "Rate limit reached. Please wait 30 seconds.",
            });
        }

        const statusCode = (externalStatus >= 400 && externalStatus < 600) ? externalStatus : 500;

        // Return a safe diagnostic message without exposing API credentials.
        res.status(statusCode).json({
            success: false,
            message: error.message || "Image generation failed.",
        });
    }
};

export const removeImageBackground = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }

        const image = req.file;
        const plan = req.plan;

        console.log(`[Diagnostic:Access] operation=remove_image_background userId=${userId} normalizedPlan=${plan} allowed=${plan === 'premium'}`);

        if (plan !== "premium") {
            if (image?.path && fs.existsSync(image.path)) {
                fs.unlinkSync(image.path);
            }
            console.warn(`[Diagnostic:Access] operation=remove_image_background userId=${userId} normalizedPlan=${plan} HTTP_STATUS=403 message="This feature is only available for premium subscriptions"`);
            return res.status(403).json({
                success: false,
                message: "This feature is only available for premium subscriptions",
            });
        }

        if (!image) {
            return res.status(400).json({
                success: false,
                message: "No image file was uploaded.",
            });
        }

        let resultUrl = null;

        // Try Cloudinary background removal; fall back to Clipdrop remove-background if Cloudinary fails (e.g. HTTP 403 create forbidden)
        try {
            const uploadResult = await cloudinary.uploader.upload(image.path, {
                transformation: [
                    {
                        effect: "background_removal",
                        background_removal: "cloudinary_ai",
                    },
                ],
            });
            resultUrl = uploadResult.secure_url;
        } catch (cloudinaryError) {
            const cloudStatus = cloudinaryError.http_code || cloudinaryError.status || cloudinaryError.statusCode || 403;
            console.warn(`[Diagnostic:Cloudinary] operation=remove_image_background HTTP_STATUS=${cloudStatus} warning="Cloudinary background removal rejected (${cloudinaryError.message}), falling back to Clipdrop background removal"`);

            const { buffer: bgRemovedBuffer, mimeType } = await removeBackgroundBuffer(image.path);
            resultUrl = `data:${mimeType};base64,${bgRemovedBuffer.toString("base64")}`;
        }

        if (image.path && fs.existsSync(image.path)) {
            fs.unlinkSync(image.path);
        }

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, 'Remove background from image', ${resultUrl}, 'image')
        `;

        res.json({ success: true, content: resultUrl });
    } catch (error) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        const externalStatus = error.http_code || error.response?.status || error.status || error.statusCode || null;
        console.error("[Diagnostic:AIController] operation=remove_image_background error:", {
            message: error.message,
            status: externalStatus,
        });

        const statusCode = (externalStatus >= 400 && externalStatus < 600) ? externalStatus : 500;
        res.status(statusCode).json({
            success: false,
            message: error.message || "Background removal failed.",
        });
    }
};

export const resumeReview = async (req, res) => {
    let parser = null;

    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User ID not found" });
        }
        const resume = req.file;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.status(403).json({
                success: false,
                message: "This feature is only available for premium subscriptions",
            });
        }

        if (!resume) {
            return res.json({
                success: false,
                message: "No resume file was received by the server.",
            });
        }

        if (resume.size > 5 * 1024 * 1024) {
            return res.json({
                success: false,
                message: "Resume file exceeds allowed size (5MB).",
            });
        }

        if (!resume.path || !fs.existsSync(resume.path)) {
            throw new Error(`File not found at path: ${resume.path}`);
        }

        const dataBuffer = fs.readFileSync(resume.path);

        const pdfModule = await import("pdf-parse");
        const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse;

        parser = new PDFParse({ data: dataBuffer });
        const pdfData = await parser.getText();

        if (!pdfData.text || pdfData.text.trim() === "") {
            throw new Error(
                "Could not extract any text. The PDF might be scanned or image-based."
            );
        }

        const extractedText = pdfData.text.trim();

        // --- Request structured JSON review from Groq ---
        const structuredPrompt = `Act as an expert technical recruiter. Review the following resume and provide highly constructive feedback.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text) with exactly this structure:
{
  "overallImpression": "A brief 2-3 sentence summary of the resume's quality",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2"]
}

Requirements:
- overallImpression must be at least 10 characters
- Include at least 1 strength, 1 weakness, and 1 suggestion
- Each item must be at least 5 characters
- Respond with ONLY the JSON object, nothing else

Resume content:
${extractedText}`;

        let validatedReview = null;
        let lastError = null;

        // Attempt up to 2 tries for valid structured JSON
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await createGroqChatCompletion({
                    model: GROQ_MODEL,
                    messages: [{ role: "user", content: structuredPrompt }],
                    temperature: attempt === 0 ? 0.5 : 0.3,
                    max_tokens: 1500,
                });

                const rawContent = extractCompletionText(response);
                const parsed = parseReviewResponse(rawContent);

                if (!parsed) {
                    lastError = new Error('Could not parse AI response as JSON');
                    continue;
                }

                validatedReview = resumeReviewSchema.parse(parsed);
                break; // Success
            } catch (err) {
                lastError = err;
                continue;
            }
        }

        if (!validatedReview) {
            throw new Error(
                `Failed to generate a valid structured review after retries: ${lastError?.message || 'Unknown error'}`
            );
        }

        // Convert validated review to Markdown for frontend compatibility
        const content = reviewToMarkdown(validatedReview);

        // --- Create resume record ---
        const [resumeRecord] = await sql`
            INSERT INTO resumes (user_id, filename, extracted_text, review_content, ingestion_status)
            VALUES (${userId}, ${resume.originalname || 'resume.pdf'}, ${extractedText}, ${JSON.stringify(validatedReview)}, 'processing')
            RETURNING id
        `;

        const resumeId = resumeRecord.id;

        // --- Chunk text and generate embeddings ---
        let ingestionStatus = 'completed';
        try {
            const { processAndStoreChunks } = await import('../services/ragService.js');
            await processAndStoreChunks(resumeId, userId, extractedText);
        } catch (chunkError) {
            console.error(
                `Resume RAG ingestion failed for resume ${resumeId} (user: ${userId}): ${chunkError.message}`,
                chunkError.stack || chunkError
            );
            ingestionStatus = 'failed';
        }

        // Update ingestion status (ensures resume is marked 'failed' on embedding failure)
        await sql`
            UPDATE resumes SET ingestion_status = ${ingestionStatus}, updated_at = NOW()
            WHERE id = ${resumeId}
        `;

        // --- Preserve existing creations history ---
        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')
        `;

        if (parser) {
            await parser.destroy();
        }

        if (resume.path && fs.existsSync(resume.path)) {
            fs.unlinkSync(resume.path);
        }

        res.json({
            success: true,
            content,
            resume_id: resumeId,
            ingestion_status: ingestionStatus,
        });
    } catch (error) {
        if (parser) {
            try {
                await parser.destroy();
            } catch {
                // Ignore parser cleanup errors.
            }
        }

        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        if (error.status === 429) {
            return res.status(429).json({
                success: false,
                message: "Rate limit reached. Please wait 30 seconds.",
            });
        }

        console.error("Backend Resume Review Error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to parse PDF.",
        });
    }
};
