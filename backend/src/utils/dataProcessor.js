/**
 * Data Processor Utility
 * Handles data transformation and grouping logic
 */

/**
 * Parse date string into standardized format
 * @param {string} dateStr - Date string in various formats
 * @returns {Object} Parsed date info with year and formatted string
 */
export const parseDate = (dateStr) => {
  let year = new Date().getFullYear();
  let formattedDate = new Date().toISOString().split('T')[0];

  if (!dateStr) {
    return { year, formattedDate };
  }

  // Handle YYYY-MM-DD (ISO format - typical from Supabase)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      year = date.getFullYear();
      formattedDate = dateStr;
    }
  }
  // Handle DD-MM-YYYY (Common manual entry format)
  else if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const parts = dateStr.split('-');
    formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    year = parseInt(parts[2], 10);
  }
  // Handle MM/DD/YYYY (US format)
  else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    const parts = dateStr.split('/');
    formattedDate = `${parts[2]}-${parts[0]}-${parts[1]}`;
    year = parseInt(parts[2], 10);
  }
  // Try generic parse
  else {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      year = date.getFullYear();
      formattedDate = date.toISOString().split('T')[0];
    }
  }

  return { year, formattedDate };
};

/**
 * Clean up location string
 * Converts slugs like "austin-tx" to "Austin Tx"
 * @param {string} location - Raw location string
 * @returns {string} Cleaned location string
 */
export const cleanLocation = (location) => {
  if (!location) return 'Uncategorized';

  return location
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Process speakers from various formats
 * @param {any} speakers - Speakers data (array, string, or null)
 * @returns {string} Comma-separated speaker names
 */
export const processSpeakers = (speakers) => {
  if (Array.isArray(speakers) && speakers.length > 0) {
    return speakers.join(', ');
  }

  if (typeof speakers === 'string' && speakers.trim().length > 0) {
    return speakers.trim();
  }

  return 'Unknown Speaker';
};

/**
 * Process tags from various formats
 * @param {any} tags - Tags data
 * @param {any} categories - Fallback categories data
 * @returns {string[]} Array of tags
 */
export const processTags = (tags, categories, topics) => {
  // Combine all available tag sources, preferring topics
  const combined = new Set();
  for (const arr of [topics, tags, categories]) {
    if (Array.isArray(arr)) {
      arr.forEach((t) => {
        const value = typeof t === 'string' ? t.trim() : '';
        if (value) combined.add(value);
      });
    }
  }
  return [...combined];
};

/**
 * Normalize free-text labels for deterministic grouping/filtering.
 */
const normalizeLabel = (value) => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
};

/**
 * Get best available transcript content
 * @param {Object} row - Database row
 * @returns {string} Best available transcript content
 */
export const getBestTranscriptContent = (row) => {
  return (
    row.corrected_text ||
    row.raw_text ||
    'Processing transcript... content pending.'
  );
};

/**
 * Generate conference ID from location and year
 * @param {string} location - Conference location
 * @param {number} year - Conference year
 * @returns {string} Conference ID
 */
export const generateConferenceId = (location, year) => {
  const cleanLoc = location.toLowerCase().replace(/\s+/g, '');
  return `conf_${cleanLoc}_${year}`;
};

/**
 * Transform raw database rows into structured conferences
 * @param {Array} rows - Raw database rows
 * @param {Object} [options]
 * @param {boolean} [options.useSummaryTranscript=false] - Use summary text for the transcript field
 * @returns {Array} Structured conference objects
 */
export const transformToConferences = (rows, options = {}) => {
  if (!rows || rows.length === 0) {
    return [];
  }

  const { useSummaryTranscript = false } = options;

  const conferencesMap = new Map();

  rows.forEach((row) => {
    // Parse date
    const { year, formattedDate } = parseDate(row.event_date);

    // Use actual conference/channel name, fall back to loc
    const confNameRaw = row.conference || row.channel_name || cleanLocation(row.loc);
    const confName = typeof confNameRaw === 'string' ? confNameRaw.trim() : confNameRaw;
    const confGroupKey = normalizeLabel(confName);
    const confId = confGroupKey.replace(/[^a-z0-9]+/g, '-');

    if (!confId) {
      return;
    }

    // Create conference if it doesn't exist
    if (!conferencesMap.has(confId)) {
      conferencesMap.set(confId, {
        id: confId,
        name: confName,
        location: cleanLocation(row.loc),
        year,
        talks: [],
      });
    }

    // Create talk object
    const talk = {
      id: row.id,
      title: row.title || 'Untitled Session',
      speaker: processSpeakers(row.speakers),
      speakers: Array.isArray(row.speakers)
        ? [...new Set(row.speakers.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean))]
        : typeof row.speakers === 'string' && row.speakers.trim()
          ? [row.speakers.trim()]
          : [],
      conference: typeof (row.conference || row.channel_name || '') === 'string'
        ? (row.conference || row.channel_name || '').trim()
        : '',
      duration: row.duration_seconds != null ? `${Math.floor(row.duration_seconds / 60)}:${(row.duration_seconds % 60).toString().padStart(2, '0')}` : 'N/A',
      date: formattedDate,
      transcript: useSummaryTranscript
        ? row.summary || ''
        : getBestTranscriptContent(row),
      summary: row.summary || null,
      topics: Array.isArray(row.topics)
        ? [...new Set(row.topics.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))]
        : [],
      tags: processTags(row.tags, row.categories, row.topics),
      transcriptBy: 'BitScribe',
    };

    // Add talk to conference
    conferencesMap.get(confId).talks.push(talk);
  });

  // Convert Map to Array and sort by year descending
  return Array.from(conferencesMap.values()).sort((a, b) => b.year - a.year);
};

export default {
  parseDate,
  cleanLocation,
  processSpeakers,
  processTags,
  getBestTranscriptContent,
  generateConferenceId,
  transformToConferences,
};
