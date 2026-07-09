-- ============================================================
-- Audiobook Schema — Unified Migration
-- ============================================================
-- This file consolidates all audiobook-related schema definitions,
-- ALTER TABLE additions, data migrations, and FK updates into a
-- single idempotent migration.
--

-- ════════════════════════════════════════════════════════════════
-- PART 1: Legacy Audiobooks Schema (audiobooks.*)
-- (Originally 002_audiobooks_schema.sql)
-- ════════════════════════════════════════════════════════════════

-- 1. Create a dedicated schema so audiobook tables never collide
--    with the existing public.transcripts tables.
CREATE SCHEMA IF NOT EXISTS audiobooks;

-- 2. Audiobook series table
CREATE TABLE IF NOT EXISTS audiobooks.series (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  description   TEXT,
  thumbnail_url TEXT,
  difficulty_level TEXT     NOT NULL DEFAULT 'beginner'
                            CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Chapters within a series
CREATE TABLE IF NOT EXISTS audiobooks.chapters (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  audiobook_id      UUID        NOT NULL REFERENCES audiobooks.series(id) ON DELETE CASCADE,
  chapter_number    INTEGER     NOT NULL,
  title             TEXT        NOT NULL,
  description       TEXT,
  audio_url         TEXT,
  duration_seconds  INTEGER     NOT NULL DEFAULT 0,
  transcript_summary TEXT,
  UNIQUE (audiobook_id, chapter_number)
);

-- Index for fast sorted chapter lookups
CREATE INDEX IF NOT EXISTS idx_chapters_audiobook_order
  ON audiobooks.chapters (audiobook_id, chapter_number);

-- 4. User progress tracking (no auth — user_id is a client-generated session ID)
CREATE TABLE IF NOT EXISTS audiobooks.user_progress (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  chapter_id      UUID        NOT NULL REFERENCES audiobooks.chapters(id) ON DELETE CASCADE,
  current_seconds REAL        NOT NULL DEFAULT 0,
  completed       BOOLEAN     NOT NULL DEFAULT FALSE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_user
  ON audiobooks.user_progress (user_id);


-- ════════════════════════════════════════════════════════════════
-- PART 2: New Unified Audio Playlists & Episodes Schema (public.*)
-- (Originally 005_audio_playlists_episodes.sql)
-- ════════════════════════════════════════════════════════════════

-- 1. Playlists table (replaces audiobooks.series conceptually)
CREATE TABLE IF NOT EXISTS public.audio_playlists (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT        NOT NULL,
  slug                  TEXT        NOT NULL UNIQUE,
  description           TEXT,
  playlist_type         TEXT        NOT NULL DEFAULT 'series'
                                    CHECK (playlist_type IN ('series', 'collection')),
  cover_image_url       TEXT,
  tags                  TEXT[]      NOT NULL DEFAULT '{}',
  status                TEXT        NOT NULL DEFAULT 'draft'
                                    CHECK (status IN ('draft', 'published', 'archived')),
  -- Denormalized counters — kept in sync via trigger below
  total_duration_seconds INTEGER    NOT NULL DEFAULT 0,
  episode_count         INTEGER     NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_playlists_slug
  ON public.audio_playlists (slug);

CREATE INDEX IF NOT EXISTS idx_audio_playlists_status
  ON public.audio_playlists (status);

CREATE INDEX IF NOT EXISTS idx_audio_playlists_type
  ON public.audio_playlists (playlist_type);

-- 2. Episodes table (replaces audiobooks.chapters conceptually)
CREATE TABLE IF NOT EXISTS public.audio_episodes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id       UUID        NOT NULL
                                REFERENCES public.audio_playlists(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  description       TEXT,
  sequence_number   INTEGER     NOT NULL,
  audio_url         TEXT,                        -- NULL if pending / not yet generated
  duration_seconds  INTEGER,                     -- NULL if pending
  source_url        TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  chapters          JSONB       NOT NULL DEFAULT '[]',
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playlist_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_audio_episodes_playlist_seq
  ON public.audio_episodes (playlist_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_audio_episodes_status
  ON public.audio_episodes (status);

-- 3. Trigger: auto-update updated_at on audio_playlists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audio_playlists_updated_at ON public.audio_playlists;
CREATE TRIGGER trg_audio_playlists_updated_at
  BEFORE UPDATE ON public.audio_playlists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Trigger: keep denormalized counters on audio_playlists in sync
CREATE OR REPLACE FUNCTION public.sync_playlist_counters()
RETURNS TRIGGER AS $$
BEGIN
  -- On UPDATE, if the episode was reparented to a different playlist,
  -- refresh counters on BOTH the old and new parent playlists.
  IF TG_OP = 'UPDATE' AND OLD.playlist_id IS DISTINCT FROM NEW.playlist_id THEN
    UPDATE public.audio_playlists
    SET
      episode_count          = (SELECT COUNT(*) FROM public.audio_episodes WHERE playlist_id = audio_playlists.id),
      total_duration_seconds = (SELECT COALESCE(SUM(duration_seconds), 0) FROM public.audio_episodes WHERE playlist_id = audio_playlists.id),
      updated_at             = NOW()
    WHERE id IN (OLD.playlist_id, NEW.playlist_id);

    RETURN NULL;
  END IF;

  -- For INSERT, DELETE, or UPDATE without reparenting, refresh the single affected playlist.
  UPDATE public.audio_playlists
  SET
    episode_count          = (
      SELECT COUNT(*) FROM public.audio_episodes WHERE playlist_id = COALESCE(NEW.playlist_id, OLD.playlist_id)
    ),
    total_duration_seconds = (
      SELECT COALESCE(SUM(duration_seconds), 0)
      FROM public.audio_episodes
      WHERE playlist_id = COALESCE(NEW.playlist_id, OLD.playlist_id)
    ),
    updated_at             = NOW()
  WHERE id = COALESCE(NEW.playlist_id, OLD.playlist_id);

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_playlist_counters ON public.audio_episodes;
CREATE TRIGGER trg_sync_playlist_counters
  AFTER INSERT OR UPDATE OR DELETE ON public.audio_episodes
  FOR EACH ROW EXECUTE FUNCTION public.sync_playlist_counters();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.audio_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_episodes ENABLE ROW LEVEL SECURITY;

-- 6. Add Policies
-- Even though we use an Express backend that bypasses RLS (using a direct DB pool),
-- enabling RLS and defining read-only policies ensures the tables are fully secured
-- if accessed directly via Supabase client (anon key).

DROP POLICY IF EXISTS "Allow public read access on published playlists" ON public.audio_playlists;
CREATE POLICY "Allow public read access on published playlists"
  ON public.audio_playlists
  FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Allow public read access on all episodes" ON public.audio_episodes;
CREATE POLICY "Allow public read access on all episodes"
  ON public.audio_episodes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audio_playlists p
      WHERE p.id = playlist_id AND p.status = 'published'
    )
  );


-- ════════════════════════════════════════════════════════════════
-- PART 3: Additional Columns (source, difficulty_level, transcript_summary)
-- (Originally 006_add_source_column.sql)
-- ════════════════════════════════════════════════════════════════

-- Add the source discriminator column.
-- Defaults to 'manual' so any direct SQL INSERT gets the right value
-- without the user needing to specify it.
ALTER TABLE public.audio_playlists
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
  CHECK (source IN ('manual', 'pipeline'));

-- Also add a difficulty_level column to carry over the old audiobook concept.
-- Optional — allows SQL-seeded playlists to show difficulty badges on the frontend.
ALTER TABLE public.audio_playlists
  ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'beginner'
  CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced'));

-- Add a transcript_summary column to audio_episodes to carry over
-- the old chapter field for manually-seeded rich descriptions.
ALTER TABLE public.audio_episodes
  ADD COLUMN IF NOT EXISTS transcript_summary TEXT;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_audio_playlists_source
  ON public.audio_playlists (source);


-- ════════════════════════════════════════════════════════════════
-- PART 4: Migrate Legacy Data (audiobooks.* → public.audio_*)
-- (Originally 007_migrate_legacy_data.sql)
-- ════════════════════════════════════════════════════════════════

-- Helper function to convert a title to a URL-safe slug.
-- Same logic as the Python curator's _slugify().
CREATE OR REPLACE FUNCTION public.slugify(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
BEGIN
  base_slug := regexp_replace(
    regexp_replace(
      lower(trim(input_text)),
      '[^\w\s-]', '', 'g'
    ),
    '[-\s]+', '-', 'g'
  );
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'playlist-' || substr(md5(input_text), 1, 8);
  END IF;
  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Copy audiobooks.series → public.audio_playlists
-- Use a CTE to detect and disambiguate slug collisions (e.g. two titles
-- slugifying to the same value get '-2', '-3' suffixes).
WITH numbered AS (
  SELECT
    s.id,
    s.title,
    public.slugify(s.title) AS base_slug,
    ROW_NUMBER() OVER (PARTITION BY public.slugify(s.title) ORDER BY s.created_at) AS rn,
    s.description,
    s.thumbnail_url,
    s.difficulty_level,
    s.created_at,
    COALESCE(agg.total_dur, 0) AS total_dur,
    COALESCE(agg.ch_count, 0)  AS ch_count
  FROM audiobooks.series s
  LEFT JOIN LATERAL (
    SELECT
      SUM(c.duration_seconds)::int AS total_dur,
      COUNT(c.id)::int             AS ch_count
    FROM audiobooks.chapters c
    WHERE c.audiobook_id = s.id
  ) agg ON true
)
INSERT INTO public.audio_playlists (
  id, title, slug, description, playlist_type,
  cover_image_url, tags, status, source, difficulty_level,
  total_duration_seconds, episode_count, created_at, updated_at
)
SELECT
  n.id,
  n.title,
  CASE WHEN n.rn = 1 THEN n.base_slug
       ELSE n.base_slug || '-' || n.rn::text
  END,                                   -- slug (disambiguated)
  n.description,
  'series',                              -- playlist_type
  n.thumbnail_url,                       -- cover_image_url
  '{}'::text[],                          -- tags (none in legacy)
  'published',                           -- status
  'manual',                              -- source
  n.difficulty_level,
  n.total_dur,
  n.ch_count,
  n.created_at,
  NOW()
FROM numbered n
ON CONFLICT (id) DO UPDATE SET
  title               = EXCLUDED.title,
  description         = EXCLUDED.description,
  cover_image_url     = EXCLUDED.cover_image_url,
  difficulty_level    = EXCLUDED.difficulty_level,
  total_duration_seconds = EXCLUDED.total_duration_seconds,
  episode_count       = EXCLUDED.episode_count,
  updated_at          = NOW();

-- 2. Copy audiobooks.chapters → public.audio_episodes
INSERT INTO public.audio_episodes (
  id, playlist_id, title, description, sequence_number,
  audio_url, duration_seconds, source_url, status,
  transcript_summary, chapters, metadata, created_at
)
SELECT
  c.id,
  c.audiobook_id,                      -- playlist_id = series id
  c.title,
  c.description,
  c.chapter_number,                    -- sequence_number
  c.audio_url,
  c.duration_seconds,
  NULL,                                -- source_url
  CASE
    WHEN c.audio_url IS NOT NULL THEN 'completed'
    ELSE 'pending'
  END,                                 -- status
  c.transcript_summary,
  '[]'::JSONB,                         -- chapters
  '{}'::JSONB,                         -- metadata
  NOW()
FROM audiobooks.chapters c
ON CONFLICT (id) DO UPDATE SET
  title              = EXCLUDED.title,
  description        = EXCLUDED.description,
  audio_url          = EXCLUDED.audio_url,
  duration_seconds   = EXCLUDED.duration_seconds,
  transcript_summary = EXCLUDED.transcript_summary,
  status             = EXCLUDED.status;


-- ════════════════════════════════════════════════════════════════
-- PART 5: Update User Progress FK
-- (Originally 009_update_progress_fk.sql)
-- ════════════════════════════════════════════════════════════════

-- Drop old FK constraint (name may vary — use conditional approach)
DO $$
BEGIN
  -- Drop the FK referencing audiobooks.chapters
  ALTER TABLE audiobooks.user_progress
    DROP CONSTRAINT IF EXISTS user_progress_chapter_id_fkey;
EXCEPTION WHEN undefined_object THEN
  -- Constraint doesn't exist, nothing to do
  NULL;
END $$;

-- Add new FK referencing public.audio_episodes
-- Uses NOT VALID to avoid full-table scan on large progress tables;
-- validate separately if needed.
ALTER TABLE audiobooks.user_progress
  ADD CONSTRAINT user_progress_chapter_id_fkey
  FOREIGN KEY (chapter_id) REFERENCES public.audio_episodes(id)
  ON DELETE CASCADE
  NOT VALID;

-- Remove orphaned user_progress rows and validate the constraint
DELETE FROM audiobooks.user_progress
WHERE chapter_id NOT IN (SELECT id FROM public.audio_episodes);

ALTER TABLE audiobooks.user_progress
  VALIDATE CONSTRAINT user_progress_chapter_id_fkey;
