import sql from '../configs/db.js';
import { generateEmbedding, generateEmbeddings, EMBEDDING_DIMENSIONS } from './embeddingService.js';
import { chunkText } from './chunkingService.js';

/**
 * Process a resume: chunk the text, generate embeddings, and store in the database.
 * Deletes any existing chunks for the resume first (safe for re-processing).
 *
 * @param {string} resumeId - UUID of the resume record.
 * @param {string} userId - Clerk user ID.
 * @param {string} extractedText - Full extracted resume text.
 * @returns {Promise<number>} - Number of chunks stored.
 */
export async function processAndStoreChunks(resumeId, userId, extractedText) {
    // 1. Chunk the text
    const chunks = chunkText(extractedText);

    if (chunks.length === 0) {
        throw new Error('No usable text chunks produced from resume');
    }

    // 2. Generate embeddings for all chunks
    const chunkTexts = chunks.map(c => c.chunkText);
    const embeddings = await generateEmbeddings(chunkTexts);

    // Validate chunk embeddings count and dimensions before saving
    if (embeddings.length !== chunks.length) {
        throw new Error(`Embedding count mismatch: generated ${embeddings.length} embeddings for ${chunks.length} chunks`);
    }

    for (let i = 0; i < embeddings.length; i++) {
        if (!Array.isArray(embeddings[i]) || embeddings[i].length !== EMBEDDING_DIMENSIONS) {
            throw new Error(
                `Embedding dimension mismatch for chunk ${i}: expected ${EMBEDDING_DIMENSIONS}, got ${embeddings[i]?.length}`
            );
        }
    }

    // 3. Delete any existing chunks for this resume (idempotent re-processing)
    await sql`DELETE FROM resume_chunks WHERE resume_id = ${resumeId}`;

    // 4. Insert all chunks with embeddings
    for (let i = 0; i < chunks.length; i++) {
        const embeddingStr = `[${embeddings[i].join(',')}]`;
        await sql`
            INSERT INTO resume_chunks (resume_id, user_id, chunk_index, chunk_text, embedding)
            VALUES (${resumeId}, ${userId}, ${chunks[i].chunkIndex}, ${chunks[i].chunkText}, ${embeddingStr}::vector)
        `;
    }

    return chunks.length;
}

/** Default number of relevant chunks to retrieve */
export const DEFAULT_TOP_K = 5;

/** Default minimum cosine similarity for retrieved chunks */
export const DEFAULT_MIN_SIMILARITY = 0.40;

/**
 * Validate and resolve the minimum similarity threshold.
 * Reads from custom parameter or RAG_MIN_SIMILARITY environment variable.
 * Falls back to DEFAULT_MIN_SIMILARITY (0.40) if invalid or unconfigured.
 *
 * @param {number|undefined|null} customThreshold
 * @returns {number}
 */
export function getMinSimilarityThreshold(customThreshold) {
    if (customThreshold !== undefined && customThreshold !== null) {
        const parsed = Number(customThreshold);
        if (Number.isFinite(parsed) && parsed >= -1.0 && parsed <= 1.0) {
            return parsed;
        }
        console.warn(
            `[RAG] Invalid custom minSimilarity '${customThreshold}'. Falling back to default ${DEFAULT_MIN_SIMILARITY}.`
        );
        return DEFAULT_MIN_SIMILARITY;
    }

    const envVal = process.env.RAG_MIN_SIMILARITY;
    if (envVal !== undefined && envVal !== null && envVal.trim() !== '') {
        const parsed = Number(envVal);
        if (Number.isFinite(parsed) && parsed >= -1.0 && parsed <= 1.0) {
            return parsed;
        }
        console.warn(
            `[RAG] Invalid RAG_MIN_SIMILARITY environment value '${envVal}'. Falling back to default ${DEFAULT_MIN_SIMILARITY}.`
        );
    }

    return DEFAULT_MIN_SIMILARITY;
}

/**
 * Filter chunks by cosine similarity threshold.
 *
 * @param {{ chunkIndex: number, chunkText: string, similarity: number }[]} chunks
 * @param {number} threshold - Minimum similarity threshold.
 * @returns {{ chunkIndex: number, chunkText: string, similarity: number }[]}
 */
export function filterChunksBySimilarity(chunks, threshold) {
    if (!Array.isArray(chunks)) return [];
    return chunks.filter(c => typeof c?.similarity === 'number' && c.similarity >= threshold);
}

/**
 * Retrieve the most relevant chunks for a query, scoped to a specific resume and user.
 * Chunks are filtered by the configured minimum similarity threshold after the database query.
 *
 * @param {string} resumeId - UUID of the resume.
 * @param {string} userId - Clerk user ID (ownership filter).
 * @param {string} query - User question text.
 * @param {number|{ topK?: number, minSimilarity?: number }} [options=DEFAULT_TOP_K] - Top K count or options object.
 * @returns {Promise<{ chunkIndex: number, chunkText: string, similarity: number }[]>}
 */
export async function retrieveRelevantChunks(resumeId, userId, query, options = DEFAULT_TOP_K) {
    const topK = typeof options === 'number' ? options : (options?.topK ?? DEFAULT_TOP_K);
    const customMinSimilarity = typeof options === 'object' && options !== null ? options.minSimilarity : undefined;
    const minSimilarity = getMinSimilarityThreshold(customMinSimilarity);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
            `Query embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${queryEmbedding?.length}`
        );
    }
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Use cosine distance (<=>) for similarity search
    // pgvector returns distance, so lower is more similar
    const results = await sql`
        SELECT
            chunk_index,
            chunk_text,
            1 - (embedding <=> ${embeddingStr}::vector) AS similarity
        FROM resume_chunks
        WHERE resume_id = ${resumeId}
          AND user_id = ${userId}
        ORDER BY embedding <=> ${embeddingStr}::vector
        LIMIT ${topK}
    `;

    const mapped = results.map(row => ({
        chunkIndex: row.chunk_index,
        chunkText: row.chunk_text,
        similarity: parseFloat(row.similarity),
    }));

    return filterChunksBySimilarity(mapped, minSimilarity);
}

/**
 * Build the context string for the LLM from retrieved chunks and review data.
 *
 * @param {{ chunkText: string, similarity: number }[]} chunks - Retrieved chunks.
 * @param {object|null} review - Parsed review JSON from the resume record.
 * @returns {string} - Context string for the LLM.
 */
export function buildContext(chunks, review) {
    let context = '';

    // Add review findings if available
    if (review) {
        context += '=== RESUME REVIEW FINDINGS ===\n';
        context += `Overall Impression: ${review.overallImpression}\n\n`;
        if (review.strengths?.length) {
            context += 'Strengths:\n';
            review.strengths.forEach(s => { context += `- ${s}\n`; });
            context += '\n';
        }
        if (review.weaknesses?.length) {
            context += 'Weaknesses:\n';
            review.weaknesses.forEach(w => { context += `- ${w}\n`; });
            context += '\n';
        }
        if (review.suggestions?.length) {
            context += 'Suggestions:\n';
            review.suggestions.forEach(sg => { context += `- ${sg}\n`; });
            context += '\n';
        }
        context += '\n';
    }

    // Add relevant resume text chunks or explicit empty notice
    context += '=== RELEVANT RESUME SECTIONS ===\n';
    if (chunks && chunks.length > 0) {
        chunks.forEach((chunk, i) => {
            context += `[Section ${i + 1}]:\n${chunk.chunkText}\n\n`;
        });
    } else {
        context += 'None. No relevant resume sections were found matching this question.\n\n';
    }

    return context;
}
