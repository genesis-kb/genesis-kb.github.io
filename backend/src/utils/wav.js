/**
 * WAV Utilities
 * Wraps raw PCM in a RIFF/WAVE container so it can be stored and played as
 * an ordinary audio file.
 */

const WAV_HEADER_BYTES = 44;

/**
 * Build a WAV file from raw little-endian PCM
 * @param {Buffer} pcm - Raw PCM samples
 * @param {Object} format
 * @param {number} format.sampleRate - Samples per second (e.g. 16000)
 * @param {number} format.channels - Channel count (1 = mono)
 * @param {number} [format.bitsPerSample=16] - Bits per sample
 * @returns {Buffer} 44-byte header followed by the PCM data
 */
export const pcmToWav = (pcm, { sampleRate, channels, bitsPerSample = 16 }) => {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(WAV_HEADER_BYTES);

  // RIFF chunk descriptor
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4); // file size minus the first 8 bytes
  header.write('WAVE', 8, 'ascii');

  // fmt sub-chunk
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // fmt chunk size for PCM
  header.writeUInt16LE(1, 20); // audio format 1 = uncompressed PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
};

export default { pcmToWav };
