/**
 * Unit Tests — dataProcessor.js
 *
 * Tests all pure-function exports:
 *   parseDate, cleanLocation, processSpeakers, processTags,
 *   getBestTranscriptContent, generateConferenceId, transformToConferences
 */

import {
  parseDate,
  cleanLocation,
  processSpeakers,
  processTags,
  getBestTranscriptContent,
  generateConferenceId,
  transformToConferences,
} from '../../src/utils/dataProcessor.js';

// ─── parseDate ──────────────────────────────────────────────────────────────

describe('parseDate', () => {
  it('parses ISO format (YYYY-MM-DD)', () => {
    const result = parseDate('2024-01-15');
    expect(result.year).toBe(2024);
    expect(result.formattedDate).toBe('2024-01-15');
  });

  it('parses DD-MM-YYYY format', () => {
    const result = parseDate('15-01-2024');
    expect(result.year).toBe(2024);
    expect(result.formattedDate).toBe('2024-01-15');
  });

  it('parses MM/DD/YYYY format', () => {
    const result = parseDate('01/15/2024');
    expect(result.year).toBe(2024);
    expect(result.formattedDate).toBe('2024-01-15');
  });

  it('handles generic date string via Date constructor', () => {
    const result = parseDate('January 15, 2024');
    expect(result.year).toBe(2024);
    // The formatted date should be a valid ISO date substring
    expect(result.formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns current year and date for null input', () => {
    const result = parseDate(null);
    const currentYear = new Date().getFullYear();
    expect(result.year).toBe(currentYear);
    expect(result.formattedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns current year and date for empty string', () => {
    const result = parseDate('');
    const currentYear = new Date().getFullYear();
    expect(result.year).toBe(currentYear);
  });

  it('returns current year for an unparseable string', () => {
    const result = parseDate('not-a-date-at-all');
    const currentYear = new Date().getFullYear();
    expect(result.year).toBe(currentYear);
  });
});

// ─── cleanLocation ──────────────────────────────────────────────────────────

describe('cleanLocation', () => {
  it('converts hyphenated slug to title case', () => {
    expect(cleanLocation('austin-tx')).toBe('Austin Tx');
  });

  it('converts underscored slug to title case', () => {
    expect(cleanLocation('new_york')).toBe('New York');
  });

  it('returns "Uncategorized" for null', () => {
    expect(cleanLocation(null)).toBe('Uncategorized');
  });

  it('returns "Uncategorized" for empty string', () => {
    expect(cleanLocation('')).toBe('Uncategorized');
  });

  it('handles already-clean single word', () => {
    expect(cleanLocation('Austin')).toBe('Austin');
  });
});

// ─── processSpeakers ────────────────────────────────────────────────────────

describe('processSpeakers', () => {
  it('joins array of speakers with commas', () => {
    expect(processSpeakers(['Alice', 'Bob'])).toBe('Alice, Bob');
  });

  it('returns single speaker from array', () => {
    expect(processSpeakers(['Alice'])).toBe('Alice');
  });

  it('returns trimmed string speaker', () => {
    expect(processSpeakers('  Alice  ')).toBe('Alice');
  });

  it('returns "Unknown Speaker" for empty array', () => {
    expect(processSpeakers([])).toBe('Unknown Speaker');
  });

  it('returns "Unknown Speaker" for null', () => {
    expect(processSpeakers(null)).toBe('Unknown Speaker');
  });

  it('returns "Unknown Speaker" for undefined', () => {
    expect(processSpeakers(undefined)).toBe('Unknown Speaker');
  });

  it('returns "Unknown Speaker" for empty string', () => {
    expect(processSpeakers('')).toBe('Unknown Speaker');
  });
});

// ─── processTags ────────────────────────────────────────────────────────────

describe('processTags', () => {
  it('combines topics, tags, and categories with deduplication', () => {
    const result = processTags(['bitcoin'], ['lightning'], ['bitcoin', 'privacy']);
    expect(result).toEqual(expect.arrayContaining(['bitcoin', 'lightning', 'privacy']));
    // No duplicates
    expect(result.filter((t) => t === 'bitcoin').length).toBe(1);
  });

  it('handles null arrays gracefully', () => {
    const result = processTags(null, null, ['topic1']);
    expect(result).toEqual(['topic1']);
  });

  it('returns empty array when all inputs are null', () => {
    expect(processTags(null, null, null)).toEqual([]);
  });

  it('filters out non-string and empty entries', () => {
    const result = processTags([123, '', 'valid'], null, null);
    expect(result).toEqual(['valid']);
  });

  it('trims whitespace from tag strings', () => {
    const result = processTags(['  bitcoin  '], null, null);
    expect(result).toEqual(['bitcoin']);
  });
});

// ─── getBestTranscriptContent ───────────────────────────────────────────────

describe('getBestTranscriptContent', () => {
  it('prefers corrected_text over raw_text', () => {
    const row = { corrected_text: 'corrected', raw_text: 'raw' };
    expect(getBestTranscriptContent(row)).toBe('corrected');
  });

  it('falls back to raw_text when corrected_text is missing', () => {
    const row = { raw_text: 'raw' };
    expect(getBestTranscriptContent(row)).toBe('raw');
  });

  it('returns pending message when both are missing', () => {
    const row = {};
    expect(getBestTranscriptContent(row)).toBe(
      'Processing transcript... content pending.'
    );
  });
});

// ─── generateConferenceId ───────────────────────────────────────────────────

describe('generateConferenceId', () => {
  it('generates a slug from location and year', () => {
    expect(generateConferenceId('Austin', 2024)).toBe('conf_austin_2024');
  });

  it('strips spaces from location', () => {
    expect(generateConferenceId('New York', 2023)).toBe('conf_newyork_2023');
  });

  it('lowercases the location', () => {
    expect(generateConferenceId('LONDON', 2022)).toBe('conf_london_2022');
  });
});

// ─── transformToConferences ─────────────────────────────────────────────────

describe('transformToConferences', () => {
  it('returns empty array for null input', () => {
    expect(transformToConferences(null)).toEqual([]);
  });

  it('returns empty array for empty rows', () => {
    expect(transformToConferences([])).toEqual([]);
  });

  it('groups a single row into a single conference', () => {
    const rows = [
      {
        id: 'row-1',
        title: 'Talk 1',
        conference: 'Bitcoin 2024',
        event_date: '2024-06-15',
        speakers: ['Alice'],
        loc: 'austin',
        duration_seconds: 3600,
      },
    ];

    const result = transformToConferences(rows);
    expect(result).toHaveLength(1);
    expect(result[0].talks).toHaveLength(1);
    expect(result[0].name).toBe('Bitcoin 2024');
    expect(result[0].talks[0].title).toBe('Talk 1');
  });

  it('groups multiple rows by conference name', () => {
    const rows = [
      {
        id: 'r1',
        title: 'Talk A',
        conference: 'Bitcoin 2024',
        event_date: '2024-06-15',
        speakers: ['Alice'],
        loc: 'austin',
      },
      {
        id: 'r2',
        title: 'Talk B',
        conference: 'Bitcoin 2024',
        event_date: '2024-06-16',
        speakers: ['Bob'],
        loc: 'austin',
      },
      {
        id: 'r3',
        title: 'Talk C',
        conference: 'Lightning Summit',
        event_date: '2023-09-01',
        speakers: ['Carol'],
        loc: 'london',
      },
    ];

    const result = transformToConferences(rows);
    expect(result).toHaveLength(2);

    // Sorted by year descending — Bitcoin 2024 first
    expect(result[0].name).toBe('Bitcoin 2024');
    expect(result[0].talks).toHaveLength(2);
    expect(result[1].name).toBe('Lightning Summit');
    expect(result[1].talks).toHaveLength(1);
  });

  it('formats duration_seconds as MM:SS', () => {
    const rows = [
      {
        id: 'r1',
        title: 'Talk',
        conference: 'Conf',
        event_date: '2024-01-01',
        speakers: ['Alice'],
        loc: 'x',
        duration_seconds: 90,
      },
    ];

    const result = transformToConferences(rows);
    expect(result[0].talks[0].duration).toBe('1:30');
  });

  it('shows "N/A" when duration_seconds is missing', () => {
    const rows = [
      {
        id: 'r1',
        title: 'Talk',
        conference: 'Conf',
        event_date: '2024-01-01',
        speakers: ['Alice'],
        loc: 'x',
      },
    ];

    const result = transformToConferences(rows);
    expect(result[0].talks[0].duration).toBe('N/A');
  });

  it('uses summary text when useSummaryTranscript option is true', () => {
    const rows = [
      {
        id: 'r1',
        title: 'Talk',
        conference: 'Conf',
        event_date: '2024-01-01',
        speakers: ['Alice'],
        loc: 'x',
        summary: 'This is a summary',
        corrected_text: 'Full transcript here',
      },
    ];

    const result = transformToConferences(rows, { useSummaryTranscript: true });
    expect(result[0].talks[0].transcript).toBe('This is a summary');
  });

  it('uses corrected_text by default (useSummaryTranscript false)', () => {
    const rows = [
      {
        id: 'r1',
        title: 'Talk',
        conference: 'Conf',
        event_date: '2024-01-01',
        speakers: ['Alice'],
        loc: 'x',
        summary: 'Summary',
        corrected_text: 'Full transcript',
      },
    ];

    const result = transformToConferences(rows, { useSummaryTranscript: false });
    expect(result[0].talks[0].transcript).toBe('Full transcript');
  });

  it('sorts conferences by year descending', () => {
    const rows = [
      { id: 'r1', title: 'Old', conference: 'Conf A', event_date: '2020-01-01', speakers: [], loc: 'x' },
      { id: 'r2', title: 'New', conference: 'Conf B', event_date: '2024-01-01', speakers: [], loc: 'y' },
    ];

    const result = transformToConferences(rows);
    expect(result[0].year).toBe(2024);
    expect(result[1].year).toBe(2020);
  });
});
