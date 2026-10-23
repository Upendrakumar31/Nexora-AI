
import OpenAI from "openai";
import { clerkClient, getAuth } from "@clerk/express";
import sql from "../configs/db.js";
import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import fs from "fs";
import { resumeReviewSchema, parseReviewResponse, reviewToMarkdown } from "../schemas/resumeReview.js";

// Initialize OpenAI SDK pointed to Groq's endpoint
const AI = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

export const generateArticle = async (req, res) => {
    try {
        const { userId } = getAuth(req);
        const { prompt, length } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "Limit reached. Upgrade to continue.",
            });
        }

        const response = await AI.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: parseInt(length) || 500,
        });

        const content = response.choices[0].message.content;

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'article')
        `;

        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: (Number(free_usage) || 0) + 1,
                },
            });
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
        const { userId } = getAuth(req);
        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if (plan !== "premium" && free_usage >= 10) {
            return res.json({
                success: false,
                message: "Limit reached. Upgrade to continue.",
            });
        }

        const response = await AI.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 100,
        });

        const content = response.choices[0].message.content;

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
        `;

        if (plan !== "premium") {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: (Number(free_usage) || 0) + 1,
                },
            });
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
        const { userId } = getAuth(req);
        const { prompt, publish } = req.body;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.json({
                success: false,
                message: "This feature is only available for premium subscriptions",
            });
        }

        if (!process.env.CLIPDROP_API_KEY) {
            throw new Error(
                "CLIPDROP_API_KEY is missing from the server environment."
            );
        }

        const formData = new FormData();
        formData.append("prompt", prompt);

        const { data } = await axios.post(
            "https://clipdrop-api.co/text-to-image/v1",
            formData,
            {
                headers: {
                    "x-api-key": process.env.CLIPDROP_API_KEY,
                },
                responseType: "arraybuffer",
            }
        );

        const base64Image = `data:image/png;base64,${Buffer.from(
            data
        ).toString("base64")}`;

        const { secure_url } = await cloudinary.uploader.upload(base64Image);

        await sql`
            INSERT INTO creations (user_id, prompt, content, type, publish)
            VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
        `;

        res.json({ success: true, content: secure_url });
    } catch (error) {
        const externalStatus = error.response?.status;

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

        console.error("Image Generation Error:", {
            message: error.message,
            status: externalStatus ?? error.status ?? null,
            response: externalResponse,
        });

        if (externalStatus === 429 || error.status === 429) {
            return res.status(429).json({
                success: false,
                message: "Rate limit reached. Please wait 30 seconds.",
            });
        }

        // Return a safe diagnostic message without exposing API credentials.
        res.status(500).json({
            success: false,
            message: externalStatus
                ? `External image API returned status ${externalStatus}. Check the backend terminal for details.`
                : error.message || "Image generation failed.",
        });
    }
};

export const removeImageBackground = async (req, res) => {
    try {
        const { userId } = getAuth(req);
        const image = req.file;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.json({
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

        const { secure_url } = await cloudinary.uploader.upload(image.path, {
            transformation: [
                {
                    effect: "background_removal",
                    background_removal: "cloudinary_ai",
                },
            ],
        });

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')
        `;

        res.json({ success: true, content: secure_url });
    } catch (error) {
        console.error("Background Removal Error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const removeImageObject = async (req, res) => {
    try {
        const { userId } = getAuth(req);
        const { object } = req.body;
        const image = req.file;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.json({
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

        const { public_id } = await cloudinary.uploader.upload(image.path);

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{ effect: `gen_remove:${object}` }],
            resource_type: "image",
        });

        const promptMessage = `Remove ${object} from image`;

        await sql`
            INSERT INTO creations (user_id, prompt, content, type)
            VALUES (${userId}, ${promptMessage}, ${imageUrl}, 'image')
        `;

        res.json({ success: true, content: imageUrl });
    } catch (error) {
        console.error("Object Removal Error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

export const resumeReview = async (req, res) => {
    let parser = null;

    try {
        const { userId } = getAuth(req);
        const resume = req.file;
        const plan = req.plan;

        if (plan !== "premium") {
            return res.json({
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
                const response = await AI.chat.completions.create({
                    model: "openai/gpt-oss-120b",
                    messages: [{ role: "user", content: structuredPrompt }],
                    temperature: attempt === 0 ? 0.5 : 0.3,
                    max_tokens: 1500,
                });

                const rawContent = response.choices[0].message.content;
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
