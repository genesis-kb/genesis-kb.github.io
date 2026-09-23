/**
 * Unit Tests — ttsAudioService.js
 *
 * Tests the generate-once TTS audio cache: source text resolution, cache
 * hits and misses, shared in-flight syntheses, and the storage gate.
 * Mocks: config, dbPool, aiService, audioStorageService, supabaseService,
 * logger.
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';

const mockConfig = {
  ai: {
    enabled: true,
    tts: {
      storage: { bucket: 'audio-bucket', region: 'us-east-1', prefix: 'tts-audio/' },
      storageEnabled: true,
    },
  },
  server: { isDevelopment: false },
};

const mockQuery = jest.fn();
const mockAI = {
  prepareSpeechText: jest.fn((text) => text),
  getSpeechVoice: jest.fn(() => ({ provider: 'bedrock', voice: 'Joanna', engine: 'neural' })),
  generateSpeech: jest.fn(),
};
const mockStorage = { putAudio: jest.fn(), getAudioStream: jest.fn() };
const mockSupabase = { fetchTranscriptById: jest.fn() };

jest.unstable_mockModule('../../src/config/index.js', () => ({ default: mockConfig }));
jest.unstable_mockModule('../../src/services/dbPool.js', () => ({ query: mockQuery }));
jest.unstable_mockModule('../../src/services/aiService.js', () => mockAI);
jest.unstable_mockModule('../../src/services/audioStorageService.js', () => mockStorage);
jest.unstable_mockModule('../../src/services/supabaseService.js', () => mockSupabase);
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { resolveSourceText, findAudio, getOrCreateAudio, openAudio, toAudioMetadata } =
  await import('../../src/services/ttsAudioService.js');

const TRANSCRIPT_ID = '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f';
const TRANSCRIPT = {
  id: TRANSCRIPT_ID,
  raw_text: 'Raw text',
  corrected_text: 'Corrected text',
  summary: 'Summary text',
};

const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const ROW = {
  id: 'row-1',
  transcript_id: TRANSCRIPT_ID,
  source: 'summary',
  text_hash: sha256('Summary text'),
  provider: 'bedrock',
  voice: 'Joanna',
  engine: 'neural',
  s3_key: 'tts-audio/key.wav',
  sample_rate: 16000,
  byte_size: 32044,
  duration_seconds: '1.00',
};

// 1 second of 16 kHz mono 16-bit silence.
const SPEECH = {
  audio: Buffer.alloc(32000).toString('base64'),
  format: 'pcm',
  sampleRate: 16000,
  channels: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Drop queued and custom results so one test's leftovers cannot leak.
  [mockQuery, mockAI.generateSpeech, mockStorage.putAudio, mockStorage.getAudioStream].forEach(
    (mock) => mock.mockReset()
  );
  mockConfig.ai.enabled = true;
  mockConfig.ai.tts.storageEnabled = true;
  mockSupabase.fetchTranscriptById.mockResolvedValue(TRANSCRIPT);
});

// ─── resolveSourceText ──────────────────────────────────────────────────────

describe('resolveSourceText', () => {
  it('reads the corrected text for source "transcript"', async () => {
    await expect(resolveSourceText(TRANSCRIPT_ID, 'transcript')).resolves.toBe('Corrected text');
  });

  it('reads the summary for source "summary"', async () => {
    await expect(resolveSourceText(TRANSCRIPT_ID, 'summary')).resolves.toBe('Summary text');
  });

  it('falls back from summary to corrected then raw text', async () => {
    mockSupabase.fetchTranscriptById.mockResolvedValueOnce({ raw_text: 'Only raw' });
    await expect(resolveSourceText(TRANSCRIPT_ID, 'summary')).resolves.toBe('Only raw');
  });

  it('prepares the text exactly as TTS will speak it', async () => {
    mockAI.prepareSpeechText.mockReturnValueOnce('Truncated...');
    await expect(resolveSourceText(TRANSCRIPT_ID, 'summary')).resolves.toBe('Truncated...');
    expect(mockAI.prepareSpeechText).toHaveBeenCalledWith('Summary text');
  });

  it('answers 404 for an unknown transcript', async () => {
    mockSupabase.fetchTranscriptById.mockResolvedValueOnce(null);
    await expect(resolveSourceText(TRANSCRIPT_ID, 'summary')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('answers 422 when there is no text to speak', async () => {
    mockSupabase.fetchTranscriptById.mockResolvedValueOnce({ raw_text: '   ' });
    await expect(resolveSourceText(TRANSCRIPT_ID, 'transcript')).rejects.toMatchObject({
      statusCode: 422,
      code: 'NO_SPEECH_TEXT',
    });
  });
});

// ─── storage gate ───────────────────────────────────────────────────────────

describe('without audio storage', () => {
  it.each([
    ['findAudio', () => findAudio(TRANSCRIPT_ID, 'summary')],
    ['getOrCreateAudio', () => getOrCreateAudio(TRANSCRIPT_ID, 'summary')],
    ['openAudio', () => openAudio(TRANSCRIPT_ID, 'summary')],
  ])('%s answers 503 TTS_STORAGE_NOT_CONFIGURED', async (_name, call) => {
    mockConfig.ai.tts.storageEnabled = false;

    await expect(call()).rejects.toMatchObject({
      statusCode: 503,
      code: 'TTS_STORAGE_NOT_CONFIGURED',
    });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockAI.generateSpeech).not.toHaveBeenCalled();
  });
});

// ─── findAudio ──────────────────────────────────────────────────────────────

describe('findAudio', () => {
  it('looks up the current text hash and voice', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [ROW] });

    await expect(findAudio(TRANSCRIPT_ID, 'summary')).resolves.toBe(ROW);
    expect(mockQuery.mock.calls[0][1]).toEqual([
      TRANSCRIPT_ID,
      sha256('Summary text'),
      'bedrock',
      'Joanna',
      'neural',
    ]);
  });

  it('returns null when nothing is stored', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(findAudio(TRANSCRIPT_ID, 'summary')).resolves.toBeNull();
  });

  it('accepts any stored voice when AI is disabled', async () => {
    mockConfig.ai.enabled = false;
    mockQuery.mockResolvedValueOnce({ rows: [ROW] });

    await expect(findAudio(TRANSCRIPT_ID, 'summary')).resolves.toBe(ROW);
    expect(mockQuery.mock.calls[0][1]).toEqual([TRANSCRIPT_ID, sha256('Summary text')]);
    expect(mockAI.getSpeechVoice).not.toHaveBeenCalled();
  });
});

// ─── getOrCreateAudio ───────────────────────────────────────────────────────

describe('getOrCreateAudio', () => {
  it('returns stored audio without synthesizing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [ROW] });

    await expect(getOrCreateAudio(TRANSCRIPT_ID, 'summary')).resolves.toEqual({
      row: ROW,
      cached: true,
    });
    expect(mockAI.generateSpeech).not.toHaveBeenCalled();
    expect(mockStorage.putAudio).not.toHaveBeenCalled();
  });

  it('synthesizes, stores a WAV and records it on a miss', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // lookup
      .mockResolvedValueOnce({ rows: [] }) // insert
      .mockResolvedValueOnce({ rows: [ROW] }); // re-select
    mockAI.generateSpeech.mockResolvedValueOnce(SPEECH);

    await expect(getOrCreateAudio(TRANSCRIPT_ID, 'summary')).resolves.toEqual({
      row: ROW,
      cached: false,
    });

    expect(mockAI.generateSpeech).toHaveBeenCalledWith('Summary text');

    const [key, wav] = mockStorage.putAudio.mock.calls[0];
    expect(key).toBe(
      `tts-audio/${TRANSCRIPT_ID}/${sha256('Summary text')}-bedrock-Joanna-neural.wav`
    );
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.length).toBe(44 + 32000);

    const [insertSql, insertParams] = mockQuery.mock.calls[1];
    expect(insertSql).toContain('ON CONFLICT');
    expect(insertParams).toEqual([
      TRANSCRIPT_ID, 'summary', sha256('Summary text'), 'bedrock', 'Joanna', 'neural', key,
      16000, 44 + 32000, 1,
    ]);
  });

  it('shares one synthesis between concurrent requests', async () => {
    let resolveSpeech;
    mockAI.generateSpeech.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSpeech = resolve;
      })
    );
    mockQuery.mockImplementation(async (sql) =>
      sql.includes('INSERT') ? { rows: [] } : { rows: mockStorage.putAudio.mock.calls.length ? [ROW] : [] }
    );

    const first = getOrCreateAudio(TRANSCRIPT_ID, 'summary');
    const second = getOrCreateAudio(TRANSCRIPT_ID, 'summary');
    await new Promise((resolve) => setImmediate(resolve));
    resolveSpeech(SPEECH);

    const results = await Promise.all([first, second]);
    expect(results.map((r) => r.row)).toEqual([ROW, ROW]);
    expect(mockAI.generateSpeech).toHaveBeenCalledTimes(1);
    expect(mockStorage.putAudio).toHaveBeenCalledTimes(1);
  });

  it('does not record audio when the upload fails', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockAI.generateSpeech.mockResolvedValueOnce(SPEECH);
    mockStorage.putAudio.mockRejectedValueOnce(new Error('S3 down'));

    await expect(getOrCreateAudio(TRANSCRIPT_ID, 'summary')).rejects.toThrow('S3 down');
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

// ─── openAudio ──────────────────────────────────────────────────────────────

describe('openAudio', () => {
  it('opens the stored object for the current audio', async () => {
    const body = { pipe: jest.fn() };
    mockQuery.mockResolvedValueOnce({ rows: [ROW] });
    mockStorage.getAudioStream.mockResolvedValueOnce({
      body,
      contentLength: 32044,
      contentType: 'audio/wav',
    });

    await expect(openAudio(TRANSCRIPT_ID, 'summary')).resolves.toEqual({
      row: ROW,
      body,
      contentLength: 32044,
      contentType: 'audio/wav',
    });
    expect(mockStorage.getAudioStream).toHaveBeenCalledWith('tts-audio/key.wav');
  });

  it('answers 404 when nothing has been generated', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(openAudio(TRANSCRIPT_ID, 'summary')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(mockStorage.getAudioStream).not.toHaveBeenCalled();
  });
});

// ─── toAudioMetadata ────────────────────────────────────────────────────────

describe('toAudioMetadata', () => {
  it('exposes playback details but never the S3 key', () => {
    const metadata = toAudioMetadata(ROW);

    expect(metadata).toEqual({
      sampleRate: 16000,
      durationSeconds: 1,
      byteSize: 32044,
      format: 'wav',
    });
    expect(JSON.stringify(metadata)).not.toContain('tts-audio/');
  });
});
