-- ============================================================
-- QuickAI: Resume RAG Schema Migration
-- Run this against your Neon PostgreSQL database.
-- Prerequisite: pgvector extension must be available on your Neon project.
-- ============================================================

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: resumes
-- Stores uploaded resume data, extracted text, and AI review.
-- ============================================================
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    extracted_text TEXT NOT NULL,
    review_content JSONB,
    ingestion_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (ingestion_status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_status ON resumes(user_id, ingestion_status);

-- ============================================================
-- Table: resume_chunks
-- Stores chunked resume text with pgvector embeddings.
-- Embedding dimension: 768 (matches Gemini text-embedding-004)
-- ============================================================
CREATE TABLE IF NOT EXISTS resume_chunks (
    id SERIAL PRIMARY KEY,
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_chunks_resume_id ON resume_chunks(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_chunks_user_resume ON resume_chunks(user_id, resume_id);

-- HNSW index for fast cosine similarity search on embeddings
-- Only create if not exists (safe to re-run)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resume_chunks_embedding_hnsw'
    ) THEN
        CREATE INDEX idx_resume_chunks_embedding_hnsw
        ON resume_chunks
        USING hnsw (embedding vector_cosine_ops);
    END IF;
END
$$;

-- ============================================================
-- Table: resume_chat_messages
-- Stores chat history per resume per user.
-- ============================================================
CREATE TABLE IF NOT EXISTS resume_chat_messages (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_resume ON resume_chat_messages(user_id, resume_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_resume_created ON resume_chat_messages(resume_id, created_at);
