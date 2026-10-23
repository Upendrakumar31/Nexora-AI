/**
 * Live integration test for Resume RAG retrieval quality.
 * Kept separate from the normal unit test suite.
 * Run with: node --env-file=.env --test tests/retrievalQuality.live.test.js
 *
 * Requirements:
 * - Dynamically uses an existing resume from the database (no hardcoded IDs or personal data).
 * - Tests query retrieval and similarity score differential between relevant and off-topic queries.
 * - Does not assert universal cutoff values.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sql from '../configs/db.js';
import { retrieveRelevantChunks } from '../services/ragService.js';

describe('Live Retrieval Quality (Integration)', () => {
    it('retrieves chunks and shows relative score differential for relevant vs off-topic queries', async (t) => {
        if (!process.env.DATABASE_URL || !process.env.GEMINI_API_KEY) {
            t.skip('Missing DATABASE_URL or GEMINI_API_KEY in environment, skipping live integration test');
            return;
        }

        // Dynamically find the most recent completed resume
        const [resume] = await sql`
            SELECT id, user_id
            FROM resumes
            WHERE ingestion_status = 'completed'
            ORDER BY created_at DESC
            LIMIT 1
        `;

        if (!resume) {
            t.skip('No completed resumes found in database to run live retrieval test');
            return;
        }

        const relevantQuery = 'What technical skills, responsibilities, or education are mentioned?';
        const offTopicQuery = 'What is the recipe for baking chocolate chip cookies?';

        // Retrieve with a very low threshold (0.0) so we can inspect raw relative scores
        const relevantChunks = await retrieveRelevantChunks(resume.id, resume.user_id, relevantQuery, {
            topK: 5,
            minSimilarity: 0.0,
        });

        const offTopicChunks = await retrieveRelevantChunks(resume.id, resume.user_id, offTopicQuery, {
            topK: 5,
            minSimilarity: 0.0,
        });

        assert.ok(relevantChunks.length > 0, 'Expected at least one chunk returned for relevant resume query');

        const topRelevantScore = relevantChunks[0]?.similarity ?? 0;
        const topOffTopicScore = offTopicChunks[0]?.similarity ?? 0;

        // Relative comparison: relevant query should match the resume closer than an off-topic cooking query
        assert.ok(
            topRelevantScore >= topOffTopicScore,
            `Expected relevant query score (${topRelevantScore}) to be >= off-topic query score (${topOffTopicScore})`
        );
    });
});
