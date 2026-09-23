/**
 * Unit Tests — services/aiService.ts (chat)
 *
 * Tests chat request shape, error-to-reply mapping, and the saved-chat
 * endpoints.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockApi } = vi.hoisted(() => ({
  mockApi: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../../services/api')>(
    '../../../services/api'
  )
  return { ...actual, api: mockApi }
})

import { APIError } from '../../../services/api'
import { chatWithTranscript, getChatHistory, clearChat } from '../../../services/aiService'

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
