/**
 * Database Service
 * Handles all database operations with PostgreSQL (AWS RDS)
 *
 * Note: File kept as supabaseService.js to avoid changing controller imports.
 */

import { query } from './dbPool.js';
import logger from '../config/logger.js';


/**
 * Fetch conference summaries without raw transcript text
 * @param {Object} options - Pagination options
 * @param {number} [options.limit] - Optional result limit
 * @param {number} [options.offset=0] - Optional result offset
 * @returns {Promise<Array>} Summary rows
 */
export const fetchTranscriptSummaries = async ({ limit, offset = 0 } = {}) => {
  logger.info('Fetching lean transcript summaries from database...');

  const params = [];
  let sql = `
    SELECT
        t.id,
        c.title,
        COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS speakers,
        c.event_date,
        tx.name AS conference,
        cs.name AS channel_name,
        NULL AS loc,
        COALESCE(c.source_metadata->'tags', '[]') AS tags,
        '[]'::jsonb AS topics,
        '[]'::jsonb AS categories,
        MAX(su.content) AS summary,
        c.status,
        t.duration_seconds
    FROM transcripts t
    JOIN content_items c ON t.content_item_id = c.id
    LEFT JOIN content_sources cs ON c.source_id = cs.id
    LEFT JOIN content_item_speakers cis ON c.id = cis.content_item_id
    LEFT JOIN speakers s ON cis.speaker_id = s.id
    LEFT JOIN taxonomies tx ON c.event_id = tx.id
    LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
    WHERE t.is_current = true
    GROUP BY t.id, c.id, cs.id, tx.id
    ORDER BY c.event_date DESC NULLS LAST
  `;

  if (typeof limit === 'number') {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }

  if (typeof offset === 'number' && offset > 0) {
    params.push(offset);
    sql += ` OFFSET $${params.length}`;
  }

  const result = await query(sql, params);

  logger.info(`Successfully fetched ${result.rows.length} lean transcript rows`);
  return result.rows;
};

/**
 * Break text into paragraphs of ~5 sentences each.
 * If the last chunk has fewer than 3 sentences, merge it into the previous one.
 */
const addParagraphBreaks = (text) => {
  if (!text) return text;

  // Split into sentences (keep the delimiter attached)
  const sentences = text.split(/(?<=[.?!])\s+/).filter((s) => s.trim());
  if (sentences.length <= 6) return text;

  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 5) {
    paragraphs.push(sentences.slice(i, i + 5).join(' '));
  }

  // If last paragraph is too short, merge it with the previous one
  if (paragraphs.length > 1 && paragraphs[paragraphs.length - 1].split(/[.?!]/).length <= 3) {
    const last = paragraphs.pop();
    paragraphs[paragraphs.length - 1] += ' ' + last;
  }

  return paragraphs.join('\n\n');
};

/**
 * Strip speaker/timestamp labels like "Speaker 0: 00:01:23" from transcript text.
 * Handles labels at start, inline, and with surrounding whitespace/newlines.
 */
const stripSpeakerLabels = (text) => {
  if (!text) return text;
  return text
    .replace(/\n*Speaker \d+:\s*\d{2}:\d{2}:\d{2}\n*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/**
 * Format a transcript row — clean up labels and add paragraph breaks.
 */
const formatTranscript = (row) => {
  if (!row) return row;
  return {
    ...row,
    raw_text: row.raw_text ? addParagraphBreaks(stripSpeakerLabels(row.raw_text)) : row.raw_text,
    corrected_text: row.corrected_text ? addParagraphBreaks(stripSpeakerLabels(row.corrected_text)) : row.corrected_text,
  };
};

/**
 * Fetch all transcripts from the database
 * @returns {Promise<Array>} Array of transcript records
 */
export const fetchAllTranscripts = async () => {
  logger.info('Fetching all transcripts from database...');

  const sql = `
    SELECT
        t.id,
        c.title,
        COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS speakers,
        c.event_date,
        tx.name AS conference,
        cs.name AS channel_name,
        NULL AS loc,
        COALESCE(c.source_metadata->'tags', '[]') AS tags,
        '[]'::jsonb AS topics,
        '[]'::jsonb AS categories,
        MAX(su.content) AS summary,
        t.raw_text,
        t.corrected_text,
        c.status,
        t.duration_seconds
    FROM transcripts t
    JOIN content_items c ON t.content_item_id = c.id
    LEFT JOIN content_sources cs ON c.source_id = cs.id
    LEFT JOIN content_item_speakers cis ON c.id = cis.content_item_id
    LEFT JOIN speakers s ON cis.speaker_id = s.id
    LEFT JOIN taxonomies tx ON c.event_id = tx.id
    LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
    WHERE t.is_current = true
    GROUP BY t.id, c.id, cs.id, tx.id
    ORDER BY c.event_date DESC NULLS LAST
  `;
  const result = await query(sql);

  logger.info(`Successfully fetched ${result.rows.length} transcripts`);
  return result.rows.map(formatTranscript);
};

/**
 * Fetch a single transcript by ID
 * @param {string} id - Transcript ID
 * @returns {Promise<Object|null>} Transcript record or null
 */
export const fetchTranscriptById = async (id) => {
  logger.info(`Fetching transcript with ID: ${id}`);

  const sql = `
    SELECT
        t.id,
        c.title,
        COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS speakers,
        c.event_date,
        tx.name AS conference,
        cs.name AS channel_name,
        NULL AS loc,
        COALESCE(c.source_metadata->'tags', '[]') AS tags,
        '[]'::jsonb AS topics,
        '[]'::jsonb AS categories,
        MAX(su.content) AS summary,
        t.raw_text,
        t.corrected_text,
        c.status,
        t.duration_seconds
    FROM transcripts t
    JOIN content_items c ON t.content_item_id = c.id
    LEFT JOIN content_sources cs ON c.source_id = cs.id
    LEFT JOIN content_item_speakers cis ON c.id = cis.content_item_id
    LEFT JOIN speakers s ON cis.speaker_id = s.id
    LEFT JOIN taxonomies tx ON c.event_id = tx.id
    LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
    WHERE t.id = $1 AND t.is_current = true
    GROUP BY t.id, c.id, cs.id, tx.id
  `;

  const result = await query(sql, [id]);

  if (result.rows.length === 0) {
    logger.warn(`Transcript not found: ${id}`);
    return null;
  }

  return formatTranscript(result.rows[0]);
};

/**
 * Search transcripts using PostgreSQL Full-Text Search.
 * Returns ranked results with highlighted snippets.
 * @param {string} searchQuery - Search query
 * @param {number} limit - Max results per page
 * @param {number} offset - Offset for pagination
 * @returns {Promise<{results: Array, total: number}>}
 */
export const searchTranscripts = async (searchQuery, limit = 20, offset = 0) => {
  const sanitized = searchQuery
    .replace(/[<>"'\`;(){}[\]\\\\]/g, '')
    .trim()
    .substring(0, 200);

  if (!sanitized || sanitized.length < 2) {
    logger.warn('Search query too short or invalid after sanitization');
    return { results: [], total: 0 };
  }

  logger.info(`FTS searching for: "${sanitized}" (limit=${limit}, offset=${offset})`);

  try {
    const ftsQuery = `plainto_tsquery('english', $1)`;
    const textVector = `to_tsvector('english', COALESCE(t.corrected_text, t.raw_text, ''))`;
    const titleDescVector = `to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.description, ''))`;
    const summaryVector = `to_tsvector('english', COALESCE(su.content, ''))`;
    const summaryAggVector = `to_tsvector('english', COALESCE(MAX(su.content), ''))`;

    const searchSql = `
      SELECT
          t.id,
          c.title,
          COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS speakers,
          c.event_date,
          tx.name AS conference,
          cs.name AS channel_name,
          NULL AS loc,
          COALESCE(c.source_metadata->'tags', '[]') AS tags,
          '[]'::jsonb AS topics,
          '[]'::jsonb AS categories,
          MAX(su.content) AS summary,
          c.status,
          t.duration_seconds,
          ts_rank(${titleDescVector} || ${textVector} || ${summaryAggVector}, ${ftsQuery}) AS rank,
          ts_headline('english', coalesce(t.corrected_text, t.raw_text, ''), ${ftsQuery}, 'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') AS snippet
      FROM transcripts t
      JOIN content_items c ON t.content_item_id = c.id
      LEFT JOIN content_sources cs ON c.source_id = cs.id
      LEFT JOIN content_item_speakers cis ON c.id = cis.content_item_id
      LEFT JOIN speakers s ON cis.speaker_id = s.id
      LEFT JOIN taxonomies tx ON c.event_id = tx.id
      LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
      WHERE t.is_current = true
        AND (
          ${titleDescVector} @@ ${ftsQuery}
          OR ${textVector} @@ ${ftsQuery}
          OR ${summaryVector} @@ ${ftsQuery}
        )
      GROUP BY t.id, c.id, cs.id, tx.id
      ORDER BY rank DESC
      LIMIT $2 OFFSET $3
    `;

    const countSql = `
      SELECT COUNT(DISTINCT t.id) AS total
      FROM transcripts t
      JOIN content_items c ON t.content_item_id = c.id
      LEFT JOIN summaries su ON t.id = su.transcript_id AND su.summary_type = 'tldr'
      WHERE t.is_current = true
        AND (
          to_tsvector('english', COALESCE(c.title, '') || ' ' || COALESCE(c.description, '')) @@ plainto_tsquery('english', $1)
          OR to_tsvector('english', COALESCE(t.corrected_text, t.raw_text, '')) @@ plainto_tsquery('english', $1)
          OR to_tsvector('english', COALESCE(su.content, '')) @@ plainto_tsquery('english', $1)
        )
    `;

    const [searchResult, countResult] = await Promise.all([
      query(searchSql, [sanitized, limit, offset]),
      query(countSql, [sanitized]),
    ]);

    const results = searchResult.rows;
    const total = parseInt(countResult.rows[0]?.total || '0', 10);

    logger.info(`FTS search returned ${results.length} results (total: ${total})`);
    return { results, total };
  } catch (err) {
    logger.error('Error executing FTS search query:', { error: err.message });
    throw err;
  }
};

/**
 * Get cached AI content (summary, etc.) for a transcript
 * @param {string} transcriptId - Transcript ID
 * @param {string} type - Content type (summary, entities, etc.)
 * @returns {Promise<string|null>} Cached content or null
 */
export const getCachedAIContent = async (transcriptId, type) => {
  try {
    const result = await query(
      `SELECT content FROM summaries WHERE transcript_id = $1 AND summary_type = $2`,
      [transcriptId, type]
    );
    return result.rows[0]?.content || null;
  } catch (err) {
    logger.warn('Cache lookup error:', { error: err.message });
    return null;
  }
};

/**
 * Store AI content in cache
 * @param {string} transcriptId - Transcript ID
 * @param {string} type - Content type
 * @param {string} content - Content to cache
 */
export const cacheAIContent = async (transcriptId, type, content) => {
  try {
    await query(
      `INSERT INTO summaries (transcript_id, summary_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (transcript_id, summary_type)
       DO UPDATE SET content = EXCLUDED.content, created_at = NOW()`,
      [transcriptId, type, content]
    );
    logger.debug(`Cached ${type} for transcript ${transcriptId}`);
  } catch (err) {
    logger.warn('Cache store error:', { error: err.message });
  }
};

/**
 * Health check for database connection
 * @returns {Promise<boolean>} True if connection is healthy
 */
export const healthCheck = async () => {
  try {
    const result = await query('SELECT 1');
    return result.rows.length > 0;
  } catch (err) {
    logger.error('Database health check failed:', { error: err.message });
    return false;
  }
};

/**
 * Fetch aggregated metadata from all transcripts:
 * unique speakers, topics, categories (conferences), stats.
 * Derived entirely from actual DB data.
 */
export const fetchTranscriptMeta = async () => {
  logger.info('Fetching transcript metadata aggregates...');

  const result = await query(`
    SELECT
        COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS speakers,
        COALESCE(c.source_metadata->'tags', '[]') AS tags,
        '[]'::jsonb AS topics,
        tx.name AS conference,
        cs.name AS channel_name,
        '[]'::jsonb AS categories,
        NULL AS loc
    FROM transcripts t
    JOIN content_items c ON t.content_item_id = c.id
    LEFT JOIN content_sources cs ON c.source_id = cs.id
    LEFT JOIN content_item_speakers cis ON c.id = cis.content_item_id
    LEFT JOIN speakers s ON cis.speaker_id = s.id
    LEFT JOIN taxonomies tx ON c.event_id = tx.id
    WHERE t.is_current = true
    GROUP BY t.id, c.id, cs.id, tx.id
  `);

  const rows = result.rows;
  const speakerMap = {};
  const topicMap = {};
  const conferenceSet = {};
  const tagSet = {};

  const normalizeLabel = (value) => {
    if (!value || typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const cleanLabel = (value) => {
    if (!value || typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  };

  for (const row of rows) {
    // In the new schema, tags from source_metadata serve as both tags and topics
    const rowTags = Array.isArray(row.tags) ? row.tags : [];

    // Speakers
    if (Array.isArray(row.speakers)) {
      for (const s of row.speakers) {
        const speakerName = cleanLabel(s);
        const speakerKey = normalizeLabel(speakerName);
        if (!speakerKey) continue;
        if (!speakerMap[speakerKey]) speakerMap[speakerKey] = { name: speakerName, transcriptCount: 0, topics: new Set() };
        speakerMap[speakerKey].transcriptCount++;
        for (const t of rowTags) {
          const topicName = cleanLabel(t);
          if (topicName) speakerMap[speakerKey].topics.add(topicName);
        }
      }
    }

    // Topics (derived from source_metadata tags)
    for (const t of rowTags) {
      const topicName = cleanLabel(t);
      const topicKey = normalizeLabel(topicName);
      if (!topicKey) continue;
      if (!topicMap[topicKey]) topicMap[topicKey] = { name: topicName, count: 0 };
      topicMap[topicKey].count++;
    }

    // Tags
    for (const t of rowTags) {
      const tagName = cleanLabel(t);
      const tagKey = normalizeLabel(tagName);
      if (!tagKey) continue;
      if (!tagSet[tagKey]) tagSet[tagKey] = { name: tagName, count: 0 };
      tagSet[tagKey].count++;
    }

    // Conferences (from conference or channel_name field)
    const confName = cleanLabel(row.conference || row.channel_name);
    const confKey = normalizeLabel(confName);
    if (confKey) {
      if (!conferenceSet[confKey]) conferenceSet[confKey] = { name: confName, count: 0, loc: row.loc };
      conferenceSet[confKey].count++;
    }
  }

  const speakers = Object.values(speakerMap).map((s) => ({
    name: s.name,
    slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    transcriptCount: s.transcriptCount,
    topics: [...s.topics].slice(0, 5),
  })).sort((a, b) => b.transcriptCount - a.transcriptCount);

  const topics = Object.values(topicMap).map(({ name, count }) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    count,
  })).sort((a, b) => b.count - a.count);

  const conferences = Object.values(conferenceSet).map((c) => ({
    name: c.name,
    slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    sessions: c.count,
    location: c.loc || '',
  })).sort((a, b) => b.sessions - a.sessions);

  const tags = Object.values(tagSet).map(({ name, count }) => ({
    name,
    count,
  })).sort((a, b) => b.count - a.count);

  const stats = {
    totalTranscripts: rows.length,
    totalSpeakers: speakers.length,
    totalConferences: conferences.length,
    totalTopics: topics.length,
  };

  return { speakers, topics, conferences, tags, stats };
};

export default {
  fetchTranscriptSummaries,
  fetchAllTranscripts,
  fetchTranscriptById,
  searchTranscripts,
  getCachedAIContent,
  cacheAIContent,
  healthCheck,
  fetchTranscriptMeta,
};
