-- ============================================================
-- TTS Audio Cache Migration
-- Records generated speech stored in the private TTS audio S3 bucket,
-- so each transcript's audio is synthesized once and reused.
-- ============================================================

-- TTS Audio Table
-- One row per distinct spoken text and voice: text_hash is the SHA-256 of
-- exactly what was spoken (after truncation), so edited transcripts or a
-- voice change produce new audio instead of serving stale audio.
CREATE TABLE IF NOT EXISTS tts_audio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('transcript', 'summary')),
    text_hash TEXT NOT NULL,
    provider TEXT NOT NULL,
    voice TEXT NOT NULL,
    engine TEXT NOT NULL DEFAULT '',
    s3_key TEXT NOT NULL,
    sample_rate INT NOT NULL,
    byte_size INT NOT NULL,
    duration_seconds NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(transcript_id, text_hash, provider, voice, engine)
);

CREATE INDEX IF NOT EXISTS idx_tts_audio_transcript_id ON tts_audio(transcript_id);
