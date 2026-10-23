-- ============================================================
-- Nexora AI: Creations Schema Migration
-- Table: creations
-- Stores all generated content: articles, blog titles, images, and resume reviews.
-- Idempotent and safe to run against existing databases.
-- ============================================================

CREATE TABLE IF NOT EXISTS creations (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('article', 'blog-title', 'image', 'resume-review')),
    publish BOOLEAN NOT NULL DEFAULT FALSE,
    likes TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_creations_user_id ON creations(user_id);
CREATE INDEX IF NOT EXISTS idx_creations_publish_created ON creations(publish, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_creations_user_created ON creations(user_id, created_at DESC);
