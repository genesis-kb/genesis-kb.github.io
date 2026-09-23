/**
 * Unit Tests — wav.js
 *
 * Checks the RIFF/WAVE header built around raw PCM.
 */

import { pcmToWav } from '../../src/utils/wav.js';

describe('pcmToWav', () => {
  const pcm = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);

  it('prepends a 44-byte header and keeps the PCM intact', () => {
    const wav = pcmToWav(pcm, { sampleRate: 16000, channels: 1 });

    expect(wav.length).toBe(44 + pcm.length);
    expect(wav.subarray(44).equals(pcm)).toBe(true);
  });

  it('writes the RIFF, fmt and data chunks', () => {
    const wav = pcmToWav(pcm, { sampleRate: 16000, channels: 1 });

    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(4)).toBe(36 + pcm.length);
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.readUInt32LE(16)).toBe(16);
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.toString('ascii', 36, 40)).toBe('data');
    expect(wav.readUInt32LE(40)).toBe(pcm.length);
  });

  it('derives byte rate and block align from the format', () => {
    const wav = pcmToWav(pcm, { sampleRate: 24000, channels: 2 });

    expect(wav.readUInt16LE(22)).toBe(2); // channels
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt32LE(28)).toBe(24000 * 2 * 2); // byte rate
    expect(wav.readUInt16LE(32)).toBe(4); // block align
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
  });
});
