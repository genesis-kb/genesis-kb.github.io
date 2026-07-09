-- ============================================================
-- Full-Text Search Migration for new v2 schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================
-- NOTE: This replaces the old transcripts-only FTS with indexes
-- that work across the normalized schema (content_items, transcripts, summaries).
-- The primary GIN indexes are created by NEW_DB_SCRIPTS/add_indexes.py.
-- This file provides the RPC search functions for the backend API.

DROP FUNCTION IF EXISTS search_transcripts_fts(text, int, int);

-- 1. Create the RPC function for full-text search with ranking and snippets.
--    Searches across content_items (title/description), transcripts (text),
--    and summaries (content). Only searches current transcript versions.
CREATE OR REPLACE FUNCTION search_transcripts_fts(
  search_query text,
  result_limit int DEFAULT 20,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  speakers text[],
  event_date date,
  conference text,
  channel_name text,
  loc text,
  tags jsonb,
  categories jsonb,
  summary text,
  status text,
  duration_seconds integer,
  rank real,
  headline_title text,
  headline_content text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  tsquery_val := plainto_tsquery('english', search_query);

  IF tsquery_val = ''::tsquery THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    c.title,
    COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS speakers,
    c.event_date,
    tx.name AS conference,
    cs.name AS channel_name,
    NULL::text AS loc,
    COALESCE(c.source_metadata->'tags', '[]'::jsonb) AS tags,
    '[]'::jsonb AS categories,
    MAX(su.content) AS summary,
    c.status,
    t.duration_seconds,
    ts_rank(
      to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.description, ''))
      || to_tsvector('english', COALESCE(t.corrected_text, t.raw_text, ''))
      || to_tsvector('english', COALESCE(MAX(su.content), '')),
      tsquery_val
    ) AS rank,
    ts_headline(
      'english',
      c.title,
      tsquery_val,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=20, MinWords=5, HighlightAll=true'
    ) AS headline_title,
    ts_headline(
      'english',
      coalesce(t.corrected_text, t.raw_text, ''),
      tsquery_val,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15, MaxFragments=2, FragmentDelimiter= ... '
    ) AS headline_content
  FROM transcripts t
  JOIN content_items c ON t.content_item_id = c.id
  LEFT JOIN content_sources cs ON c.source_id = cs.id
  LEFT JOIN content_item_speakers cis ON c.id = cis.content_item_id
  LEFT JOIN speakers s ON cis.speaker_id = s.id
  LEFT JOIN taxonomies tx ON c.event_id = tx.id
  LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
  WHERE t.is_current = true
    AND (
      to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) @@ tsquery_val
      OR to_tsvector('english', COALESCE(t.corrected_text, t.raw_text, '')) @@ tsquery_val
      OR to_tsvector('english', COALESCE(su.content, '')) @@ tsquery_val
    )
  GROUP BY t.id, c.id, cs.id, tx.id
  ORDER BY rank DESC, c.event_date DESC NULLS LAST
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- 2. Create a companion function to get total count for pagination.
CREATE OR REPLACE FUNCTION search_transcripts_fts_count(
  search_query text
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  tsquery_val tsquery;
  total bigint;
BEGIN
  tsquery_val := plainto_tsquery('english', search_query);

  IF tsquery_val = ''::tsquery THEN
    RETURN 0;
  END IF;

  SELECT count(DISTINCT t.id) INTO total
  FROM transcripts t
  JOIN content_items c ON t.content_item_id = c.id
  LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
  WHERE t.is_current = true
    AND (
      to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) @@ tsquery_val
      OR to_tsvector('english', COALESCE(t.corrected_text, t.raw_text, '')) @@ tsquery_val
      OR to_tsvector('english', COALESCE(su.content, '')) @@ tsquery_val
    );

  RETURN total;
END;
$$;
