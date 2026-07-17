-- ============================================================
-- Bookmarks & Highlights Migration
-- Creates tables for storing user bookmarks and text highlights.
-- ============================================================

-- Bookmarks Table
-- Stores transcript bookmarks (saved/favorited transcripts).
-- A user can bookmark each transcript only once (UNIQUE constraint).
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transcript_id TEXT NOT NULL,
    title TEXT NOT NULL,
    speakers TEXT,
    event_date TEXT,
    conference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, transcript_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

-- Highlights Table
-- Stores text highlights with optional notes and color coding.
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transcript_id TEXT NOT NULL,
    transcript_title TEXT,
    text TEXT NOT NULL,
    note TEXT,
    color TEXT DEFAULT 'default',
    is_underline BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_transcript_id ON highlights(transcript_id);

-- Auto-update updated_at on row modification for highlights
CREATE OR REPLACE FUNCTION update_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_highlights_updated_at ON highlights;
CREATE TRIGGER trg_highlights_updated_at
    BEFORE UPDATE ON highlights
    FOR EACH ROW
    EXECUTE FUNCTION update_highlights_updated_at();
