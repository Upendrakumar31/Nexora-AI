import OpenAI from "openai";

const AI = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || 'placeholder_for_offline_init',
    baseURL: "https://api.groq.com/openai/v1",
});

const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const FALLBACK_MODELS = [
    DEFAULT_GROQ_MODEL,
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
];

/**
 * Creates a Groq chat completion with automatic fallback to supported models
 * if the requested or configured model is unavailable (e.g. 404 / model_not_found).
 */
export async function createGroqChatCompletion(options, client = AI) {
    const candidateModels = [
        options.model,
        ...FALLBACK_MODELS,
    ].filter(Boolean);

    const modelsToTry = [...new Set(candidateModels)];
    let lastError = null;

    for (const model of modelsToTry) {
        try {
            const response = await client.chat.completions.create({
                ...options,
                model,
            });
            return response;
        } catch (err) {
            lastError = err;
            const isModelUnavailable =
                err.status === 404 ||
                err.code === "model_not_found" ||
                (typeof err.message === "string" &&
                    (err.message.includes("does not exist") ||
                     err.message.includes("not have access")));

            if (isModelUnavailable) {
                console.warn(`[Groq Service] Model "${model}" unavailable (${err.message}). Trying fallback...`);
                continue;
            }
            throw err;
        }
    }

    throw lastError;
}

/**
 * Helper to safely extract response text, falling back to reasoning if content is empty.
 */
export function extractCompletionText(response) {
    if (!response || !response.choices || !response.choices[0]) {
        return "";
    }
    const message = response.choices[0].message;
    if (!message) return "";
    return message.content || message.reasoning || "";
}

export { AI, DEFAULT_GROQ_MODEL };
