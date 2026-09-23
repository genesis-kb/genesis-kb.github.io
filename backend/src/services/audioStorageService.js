/**
 * Audio Storage Service
 * Reads and writes generated speech in the private TTS audio bucket.
 *
 * Objects are never exposed to browsers — no ACLs, no presigned URLs.
 * The backend streams them to signed-in users. The bucket itself (and its
 * policy) is provisioned outside the app.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import config from '../config/index.js';
import { awsClientConfig } from '../config/aws.js';
import logger from '../config/logger.js';

let s3Client = null;

const getS3Client = () => {
  if (!s3Client) {
    s3Client = new S3Client(awsClientConfig({ region: config.ai.tts.storage.region }));
    logger.info('S3 client for TTS audio initialized successfully');
  }
  return s3Client;
};

/**
 * Store a WAV file
 * @param {string} key - Object key
 * @param {Buffer} buffer - WAV bytes
 */
export const putAudio = async (key, buffer) => {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: config.ai.tts.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: 'audio/wav',
      ContentLength: buffer.length,
    })
  );
  logger.info(`Stored TTS audio: ${key}`);
};

/**
 * Open a stored WAV file for streaming
 * @param {string} key - Object key
 * @returns {Promise<{body: import('stream').Readable, contentLength: number|undefined, contentType: string}>}
 */
export const getAudioStream = async (key) => {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: config.ai.tts.storage.bucket,
      Key: key,
    })
  );

  return {
    // In Node the SDK returns the body as a Readable (IncomingMessage).
    body: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType || 'audio/wav',
  };
};

export default { putAudio, getAudioStream };
