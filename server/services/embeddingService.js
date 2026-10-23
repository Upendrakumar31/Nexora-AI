import { GoogleGenAI } from '@google/genai';

/**
 * Embedding service using Google Gemini gemini-embedding-001.
 *
 * Model: gemini-embedding-001
 * Dimensions: 768
 * Provider: Google AI (Gemini)
 * Required env var: GEMINI_API_KEY
 *
 * This model is used for both resume chunk embeddings and query embeddings
 * to ensure consistency in the vector space.
 */

let genaiClient = null;

function getClient() {
    if (!genaiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required for embeddings');
        }
        genaiClient = new GoogleGenAI({ apiKey });
    }
    return genaiClient;
}

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate an embedding vector for a single text input.
 * @param {string} text - The text to embed.
 * @returns {Promise<number[]>} - The embedding vector (768 dimensions).
 */
export async function generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Cannot generate embedding for empty text');
    }

    const client = getClient();

    const result = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
            outputDimensionality: EMBEDDING_DIMENSIONS,
        },
    });

    const embedding = result.embedding?.values || result.embeddings?.[0]?.values;
    if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Failed to extract embedding values from Gemini API response');
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
            `Unexpected embedding dimensions: got ${embedding.length}, expected ${EMBEDDING_DIMENSIONS}`
        );
    }

    return embedding;
}

/**
 * Generate embeddings for multiple texts in batch.
 * Processes sequentially to respect rate limits.
 * @param {string[]} texts - Array of texts to embed.
 * @returns {Promise<number[][]>} - Array of embedding vectors.
 */
export async function generateEmbeddings(texts) {
    const embeddings = [];
    for (const text of texts) {
        const embedding = await generateEmbedding(text);
        embeddings.push(embedding);
    }
    return embeddings;
}
