-- ============================================================
-- User Data Migration
-- Creates tables for storing user-specific data (Notes, Audiobook Progress)
-- ============================================================

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transcript_id TEXT NOT NULL,
    transcript_title TEXT,
    title TEXT,
    content TEXT NOT NULL,
    pinned BOOLEAN DEFAULT false,
    selected_text TEXT,
    is_concept BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_transcript_id ON notes(transcript_id);

-- Auto-update updated_at on row modification for notes
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notes_updated_at ON notes;
CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_notes_updated_at();


-- NOTE: Audiobook progress is handled by audiobooks.user_progress (see 001_audiobook_schema.sql).
-- That table was extended to use UUID user_id referencing users(id).
