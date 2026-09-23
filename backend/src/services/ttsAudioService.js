/**
 * TTS Audio Service
 * Synthesizes a transcript's speech once, stores it in S3 as WAV, and
 * serves every later request from that copy.
 *
 * The server builds the spoken text from the database — clients only name
 * a transcript and a source — so nobody can store arbitrary audio under a
 * transcript. The cache identity is the transcript, the SHA-256 of exactly
 * what is spoken, and the provider/voice/engine that spoke it.
 */

import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { query } from './dbPool.js';
import { APIError } from '../middleware/errorHandler.js';
import { pcmToWav } from '../utils/wav.js';
import * as aiService from './aiService.js';
import * as audioStorageService from './audioStorageService.js';
import * as supabaseService from './supabaseService.js';

export const TTS_SOURCES = ['transcript', 'summary'];

const ROW_COLUMNS = `id, transcript_id, source, text_hash, provider, voice, engine, s3_key,
  sample_rate, byte_size, duration_seconds, created_at`;

// Syntheses in progress, keyed by cache identity, so concurrent requests for
// the same audio share one provider call and one upload.
const inFlight = new Map();

const assertStorageEnabled = () => {
  if (!config.ai.tts.storageEnabled) {
    throw new APIError(
      'Audio is not available — this server has no audio storage configured.',
      503,
      'TTS_STORAGE_NOT_CONFIGURED'
    );
  }
};

/**
 * Build the text TTS speaks for a transcript, from the database
 * @param {string} transcriptId - Transcript ID
 * @param {'transcript'|'summary'} source - What to read aloud
 * @returns {Promise<string>} Text exactly as it will be spoken (truncated)
 */
export const resolveSourceText = async (transcriptId, source) => {
  const transcript = await supabaseService.fetchTranscriptById(transcriptId);
  if (!transcript) {
    throw new APIError('Transcript not found', 404, 'NOT_FOUND');
  }

  const fullText =
    source === 'summary'
      ? transcript.summary || transcript.corrected_text || transcript.raw_text
      : transcript.corrected_text || transcript.raw_text;

  if (!fullText || fullText.trim().length === 0) {
    throw new APIError('This transcript has no text to read aloud', 422, 'NO_SPEECH_TEXT');
  }

  return aiService.prepareSpeechText(fullText);
};

const hashText = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

const safeKeyPart = (value) => value.replace(/[^A-Za-z0-9_-]/g, '_');

/**
 * S3 key for one cached audio file. Engine is included when set, so two
 * engines of the same voice never overwrite each other.
 */
const buildS3Key = (transcriptId, textHash, { provider, voice, engine }) => {
  const name = [textHash, provider, voice, engine].filter(Boolean).map(safeKeyPart).join('-');
  return `${config.ai.tts.storage.prefix}${safeKeyPart(transcriptId)}/${name}.wav`;
};

/**
 * Find stored audio for the transcript's current text and voice.
 * When AI is off there is no current voice, so any stored voice for the
 * current text is accepted — stored audio stays playable.
 * @param {string} transcriptId - Transcript ID
 * @param {'transcript'|'summary'} source - What was read aloud
 * @returns {Promise<Object|null>} tts_audio row, or null
 */
export const findAudio = async (transcriptId, source) => {
  assertStorageEnabled();

  const textHash = hashText(await resolveSourceText(transcriptId, source));

  if (!config.ai.enabled) {
    const result = await query(
      `SELECT ${ROW_COLUMNS} FROM tts_audio
       WHERE transcript_id = $1 AND text_hash = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [transcriptId, textHash]
    );
    return result.rows[0] || null;
  }

  const { provider, voice, engine } = aiService.getSpeechVoice();
  return selectAudio(transcriptId, textHash, provider, voice, engine);
};

const selectAudio = async (transcriptId, textHash, provider, voice, engine) => {
  const result = await query(
    `SELECT ${ROW_COLUMNS} FROM tts_audio
     WHERE transcript_id = $1 AND text_hash = $2 AND provider = $3 AND voice = $4 AND engine = $5`,
    [transcriptId, textHash, provider, voice, engine]
  );
  return result.rows[0] || null;
};

/**
 * Synthesize, store and record audio for one cache identity.
 * INSERT ... ON CONFLICT DO NOTHING then re-select, so another server (or a
 * restart) racing on the same identity ends up with the one stored row.
 */
const createAudio = async ({ transcriptId, source, spokenText, textHash, voiceId }) => {
  const speech = await aiService.generateSpeech(spokenText);
  const pcm = Buffer.from(speech.audio, 'base64');
  const wav = pcmToWav(pcm, { sampleRate: speech.sampleRate, channels: speech.channels });
  const durationSeconds =
    Math.round((pcm.length / (speech.sampleRate * speech.channels * 2)) * 100) / 100;

  const s3Key = buildS3Key(transcriptId, textHash, voiceId);
  await audioStorageService.putAudio(s3Key, wav);

  const { provider, voice, engine } = voiceId;
  await query(
    `INSERT INTO tts_audio
       (transcript_id, source, text_hash, provider, voice, engine, s3_key,
        sample_rate, byte_size, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (transcript_id, text_hash, provider, voice, engine) DO NOTHING`,
    [
      transcriptId, source, textHash, provider, voice, engine, s3Key,
      speech.sampleRate, wav.length, durationSeconds,
    ]
  );

  const row = await selectAudio(transcriptId, textHash, provider, voice, engine);
  if (!row) {
    throw new APIError('Failed to record generated audio', 500, 'DATABASE_ERROR');
  }

  logger.info(`Generated TTS audio for transcript ${transcriptId} (${source})`);
  return row;
};

/**
 * Return stored audio for a transcript, generating and storing it first if
 * needed.
 * @param {string} transcriptId - Transcript ID
 * @param {'transcript'|'summary'} source - What to read aloud
 * @returns {Promise<{row: Object, cached: boolean}>}
 */
export const getOrCreateAudio = async (transcriptId, source) => {
  assertStorageEnabled();

  const spokenText = await resolveSourceText(transcriptId, source);
  const textHash = hashText(spokenText);
  const voiceId = aiService.getSpeechVoice();
  const { provider, voice, engine } = voiceId;

  const existing = await selectAudio(transcriptId, textHash, provider, voice, engine);
  if (existing) {
    return { row: existing, cached: true };
  }

  const identity = [transcriptId, textHash, provider, voice, engine].join('|');
  let pending = inFlight.get(identity);
  if (!pending) {
    pending = createAudio({ transcriptId, source, spokenText, textHash, voiceId }).finally(() =>
      inFlight.delete(identity)
    );
    inFlight.set(identity, pending);
  }

  return { row: await pending, cached: false };
};

/**
 * Open the stored audio for a transcript's current text for streaming.
 * Never generates — a missing file is a 404.
 * @param {string} transcriptId - Transcript ID
 * @param {'transcript'|'summary'} source - What was read aloud
 * @returns {Promise<{row: Object, body: import('stream').Readable, contentLength: number|undefined, contentType: string}>}
 */
export const openAudio = async (transcriptId, source) => {
  const row = await findAudio(transcriptId, source);
  if (!row) {
    throw new APIError('No audio has been generated for this transcript yet', 404, 'NOT_FOUND');
  }

  const stream = await audioStorageService.getAudioStream(row.s3_key);
  return { row, ...stream };
};

/**
 * Public metadata for a stored audio row — never the S3 key.
 * @param {Object} row - tts_audio row
 * @returns {{sampleRate: number, durationSeconds: number, byteSize: number, format: string}}
 */
export const toAudioMetadata = (row) => ({
  sampleRate: row.sample_rate,
  durationSeconds: Number(row.duration_seconds),
  byteSize: row.byte_size,
  format: 'wav',
});

export default {
  TTS_SOURCES,
  resolveSourceText,
  findAudio,
  getOrCreateAudio,
  openAudio,
  toAudioMetadata,
};
