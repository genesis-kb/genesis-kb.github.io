/**
 * Unit Tests — services/aiService.ts (chat and stored speech)
 *
 * Tests chat request shape, error-to-reply mapping, the saved-chat
 * endpoints, and the generate-once speech flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), getBinary: vi.fn() },
}))

vi.mock('../../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../../services/api')>(
    '../../../services/api'
  )
  return { ...actual, api: mockApi }
})

import { APIError } from '../../../services/api'
import {
  chatWithTranscript,
  getChatHistory,
  clearChat,
  loadSpeechAudio,
  loadStoredSpeechAudio,
} from '../../../services/aiService'

const TRANSCRIPT_ID = '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f'

describe('chatWithTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('posts message, transcript and transcriptId — no history', async () => {
    mockApi.post.mockResolvedValueOnce({ message: 'Hi', role: 'model', timestamp: 1, saved: true })

    const reply = await chatWithTranscript('Question', 'Transcript', TRANSCRIPT_ID)

    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/ai/chat', {
      message: 'Question',
      transcript: 'Transcript',
      transcriptId: TRANSCRIPT_ID,
    })
    expect(reply).toEqual({ message: 'Hi', saved: true, failed: false })
  })

  it('surfaces saved: false from the server', async () => {
    mockApi.post.mockResolvedValueOnce({ message: 'Hi', role: 'model', timestamp: 1, saved: false })

    const reply = await chatWithTranscript('Question', 'Transcript', TRANSCRIPT_ID)

    expect(reply.saved).toBe(false)
    expect(reply.failed).toBe(false)
  })

  it('maps a 401 to an unauthorized failed reply', async () => {
    mockApi.post.mockRejectedValueOnce(new APIError('Authentication required', 401, 'UNAUTHORIZED'))

    const reply = await chatWithTranscript('Question', 'Transcript', TRANSCRIPT_ID)

    expect(reply).toMatchObject({ failed: true, saved: false, unauthorized: true })
  })

  it('keeps the existing friendly messages for other errors', async () => {
    mockApi.post.mockRejectedValueOnce(new APIError('slow down', 429, 'RATE_LIMIT_EXCEEDED'))

    const reply = await chatWithTranscript('Question', 'Transcript', TRANSCRIPT_ID)

    expect(reply).toMatchObject({
      message: 'Too many requests. Please wait a moment and try again.',
      failed: true,
      unauthorized: false,
    })
  })
})

describe('saved chat endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getChatHistory GETs the transcript chat and returns its messages', async () => {
    const messages = [{ role: 'user', content: 'Q', createdAt: '2026-09-23T10:00:00Z' }]
    mockApi.get.mockResolvedValueOnce({ messages })

    await expect(getChatHistory(TRANSCRIPT_ID)).resolves.toEqual(messages)
    expect(mockApi.get).toHaveBeenCalledWith(`/api/v1/ai/chat/${TRANSCRIPT_ID}`)
  })

  it('clearChat DELETEs the transcript chat', async () => {
    mockApi.delete.mockResolvedValueOnce({ cleared: true })

    await clearChat(TRANSCRIPT_ID)

    expect(mockApi.delete).toHaveBeenCalledWith(`/api/v1/ai/chat/${TRANSCRIPT_ID}`)
  })
})

describe('loadStoredSpeechAudio', () => {
  const path = `/api/v1/ai/tts/${TRANSCRIPT_ID}`
  const wav = new ArrayBuffer(8)
  const metadata = { sampleRate: 16000, durationSeconds: 1, byteSize: 8, format: 'wav' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('downloads stored audio', async () => {
    mockApi.get.mockResolvedValueOnce({ audio: metadata })
    mockApi.getBinary.mockResolvedValueOnce(wav)

    await expect(loadStoredSpeechAudio(TRANSCRIPT_ID, 'summary')).resolves.toBe(wav)

    expect(mockApi.get).toHaveBeenCalledWith(`${path}?source=summary`)
    expect(mockApi.getBinary).toHaveBeenCalledWith(`${path}/audio?source=summary`, {
      timeout: expect.any(Number),
    })
  })

  it('returns null without generating when nothing is stored', async () => {
    mockApi.get.mockResolvedValueOnce({ audio: null })

    await expect(loadStoredSpeechAudio(TRANSCRIPT_ID, 'summary')).resolves.toBeNull()

    expect(mockApi.post).not.toHaveBeenCalled()
    expect(mockApi.getBinary).not.toHaveBeenCalled()
  })

  it('throws a user-facing message on failure', async () => {
    mockApi.get.mockRejectedValueOnce(new APIError('Authentication required', 401, 'UNAUTHORIZED'))

    await expect(loadStoredSpeechAudio(TRANSCRIPT_ID, 'summary')).rejects.toThrow(
      'Please sign in to listen to audio.'
    )
  })
})

describe('loadSpeechAudio', () => {
  const path = `/api/v1/ai/tts/${TRANSCRIPT_ID}`
  const wav = new ArrayBuffer(8)
  const metadata = { sampleRate: 16000, durationSeconds: 1, byteSize: 8, format: 'wav' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('downloads stored audio without generating it', async () => {
    mockApi.get.mockResolvedValueOnce({ audio: metadata })
    mockApi.getBinary.mockResolvedValueOnce(wav)

    await expect(loadSpeechAudio(TRANSCRIPT_ID, 'summary')).resolves.toBe(wav)

    expect(mockApi.get).toHaveBeenCalledWith(`${path}?source=summary`)
    expect(mockApi.post).not.toHaveBeenCalled()
    expect(mockApi.getBinary).toHaveBeenCalledWith(`${path}/audio?source=summary`, {
      timeout: expect.any(Number),
    })
  })

  it('generates the audio first when nothing is stored', async () => {
    mockApi.get.mockResolvedValueOnce({ audio: null })
    mockApi.post.mockResolvedValueOnce({ audio: metadata, cached: false })
    mockApi.getBinary.mockResolvedValueOnce(wav)

    await expect(loadSpeechAudio(TRANSCRIPT_ID, 'transcript')).resolves.toBe(wav)

    expect(mockApi.post).toHaveBeenCalledWith(
      path,
      { source: 'transcript' },
      { timeout: expect.any(Number) }
    )
    expect(mockApi.post.mock.invocationCallOrder[0]).toBeLessThan(
      mockApi.getBinary.mock.invocationCallOrder[0]
    )
  })

  it.each([
    [new APIError('Authentication required', 401, 'UNAUTHORIZED'), 'Please sign in to listen to audio.'],
    [new APIError('Slow down', 429, 'RATE_LIMIT_EXCEEDED'), 'Too many audio requests. Please wait a moment and try again.'],
    [new APIError('No bucket', 503, 'TTS_STORAGE_NOT_CONFIGURED'), 'Audio generation is not available right now.'],
    [new APIError('No AI', 503, 'AI_NOT_CONFIGURED'), 'Audio generation is not available right now.'],
    [new APIError('Empty', 422, 'NO_SPEECH_TEXT'), 'This transcript has no text to read aloud.'],
    [new APIError('Boom', 500, 'INTERNAL_ERROR'), 'Audio generation failed: Boom'],
  ])('maps %s to a user-facing message', async (error, message) => {
    mockApi.get.mockResolvedValueOnce({ audio: null })
    mockApi.post.mockRejectedValueOnce(error)

    await expect(loadSpeechAudio(TRANSCRIPT_ID, 'summary')).rejects.toThrow(message)
    expect(mockApi.getBinary).not.toHaveBeenCalled()
  })
})
