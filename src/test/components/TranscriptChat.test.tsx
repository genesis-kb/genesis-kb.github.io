/**
 * Unit Tests — components/TranscriptChat.tsx
 *
 * Tests saved-history loading, the greeting, appending replies to the
 * React Query cache, New chat, and the signed-out / expired-session paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { RawTranscript } from '../../../types'
import { APIError } from '../../../services/api'

// vi.mock factories are hoisted above imports, so their mocks must be too.
const { mockUseAuth, mockChatWithTranscript, mockGetChatHistory, mockClearChat, mockToast } =
  vi.hoisted(() => ({
    mockUseAuth: vi.fn(),
    mockChatWithTranscript: vi.fn(),
    mockGetChatHistory: vi.fn(),
    mockClearChat: vi.fn(),
    mockToast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
  }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../../services/aiService', () => ({
  chatWithTranscript: (...args: unknown[]) => mockChatWithTranscript(...args),
  getChatHistory: (...args: unknown[]) => mockGetChatHistory(...args),
  clearChat: (...args: unknown[]) => mockClearChat(...args),
}))

vi.mock('sonner', () => ({ toast: mockToast }))

// Render markdown as plain text so assertions can match message content.
vi.mock('@/components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <span>{content}</span>,
}))

// jsdom has no layout, so scrollIntoView is missing.
Element.prototype.scrollIntoView = vi.fn()

import { TranscriptChat } from '@/components/TranscriptChat'

const transcript = {
  id: '3f2b8c1e-4d5a-4b6c-8e9f-0a1b2c3d4e5f',
  title: 'Taproot Deep Dive',
  speakers: ['Alice'],
  raw_text: 'Transcript body '.repeat(20),
} as unknown as RawTranscript

const GREETING = /I've analyzed "Taproot Deep Dive"/

const signedIn = () => ({
  user: { id: 'u1', email: 'u@test.com' },
  isLoading: false,
  logout: vi.fn(),
  openLoginModal: vi.fn(),
})

const newQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })

// Keyed by transcript, as TranscriptDetail renders it.
const chatTree = (queryClient: QueryClient, t: RawTranscript = transcript) => (
  <QueryClientProvider client={queryClient}>
    <TranscriptChat key={t.id} transcript={t} />
  </QueryClientProvider>
)

function renderChat(queryClient = newQueryClient()) {
  const view = render(chatTree(queryClient))
  return { ...view, queryClient }
}

const cacheKey = (userId = 'u1', transcriptId = transcript.id) => ['chatHistory', userId, transcriptId]

const input = () => screen.getByPlaceholderText('Ask about this transcript...')

function send(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Ask about this transcript...'), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
}

describe('TranscriptChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue(signedIn())
  })

  it('shows a login prompt and loads nothing when signed out', () => {
    mockUseAuth.mockReturnValue({ ...signedIn(), user: null })

    renderChat()

    expect(screen.getByText('Authentication Required')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ask about this transcript...')).not.toBeInTheDocument()
    expect(mockGetChatHistory).not.toHaveBeenCalled()
  })

  it('loads and shows the saved chat, without the greeting', async () => {
    mockGetChatHistory.mockResolvedValueOnce([
      { role: 'user', content: 'What is Taproot?', createdAt: '2026-09-23T10:00:00Z' },
      { role: 'assistant', content: 'A soft fork.', createdAt: '2026-09-23T10:00:01Z' },
    ])

    renderChat()

    expect(screen.getByText('Loading your chat…')).toBeInTheDocument()
    expect(await screen.findByText('What is Taproot?')).toBeInTheDocument()
    expect(screen.getByText('A soft fork.')).toBeInTheDocument()
    expect(screen.queryByText(GREETING)).not.toBeInTheDocument()
    expect(mockGetChatHistory).toHaveBeenCalledWith(transcript.id)
  })

  it('shows the greeting only when there is no saved chat', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])

    renderChat()

    expect(await screen.findByText(GREETING)).toBeInTheDocument()
  })

  it('sends without history and keeps the exchange in the cache across remounts', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])
    mockChatWithTranscript.mockResolvedValueOnce({ message: 'It batches signatures.', saved: true, failed: false })

    const { unmount, queryClient } = renderChat()
    await screen.findByText(GREETING)

    send('Explain Schnorr')

    expect(await screen.findByText('It batches signatures.')).toBeInTheDocument()
    expect(mockChatWithTranscript).toHaveBeenCalledWith(
      'Explain Schnorr',
      transcript.raw_text,
      transcript.id
    )
    expect(screen.queryByText(GREETING)).not.toBeInTheDocument()
    expect(mockToast.warning).not.toHaveBeenCalled()

    // Switching tabs unmounts the chat; remounting reads the cache.
    unmount()
    renderChat(queryClient)

    expect(screen.getByText('Explain Schnorr')).toBeInTheDocument()
    expect(screen.getByText('It batches signatures.')).toBeInTheDocument()
    expect(mockGetChatHistory).toHaveBeenCalledTimes(1)
  })

  it('warns when a reply could not be saved', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])
    mockChatWithTranscript.mockResolvedValueOnce({ message: 'Answer', saved: false, failed: false })

    renderChat()
    await screen.findByText(GREETING)
    send('Question')

    expect(await screen.findByText('Answer')).toBeInTheDocument()
    expect(mockToast.warning).toHaveBeenCalledTimes(1)
  })

  it('shows a failed reply without adding it to the saved chat', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])
    mockChatWithTranscript.mockResolvedValueOnce({
      message: 'Too many requests. Please wait a moment and try again.',
      saved: false,
      failed: true,
    })

    const { queryClient } = renderChat()
    await screen.findByText(GREETING)
    send('Question')

    expect(await screen.findByText(/Too many requests/)).toBeInTheDocument()
    expect(queryClient.getQueryData(cacheKey())).toEqual([])
  })

  it('signs out and opens the login modal when the session has expired', async () => {
    const auth = signedIn()
    mockUseAuth.mockReturnValue(auth)
    mockGetChatHistory.mockResolvedValueOnce([])
    mockChatWithTranscript.mockResolvedValueOnce({
      message: 'Please sign in to chat about this transcript.',
      saved: false,
      failed: true,
      unauthorized: true,
    })

    renderChat()
    await screen.findByText(GREETING)
    send('Question')

    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1))
    expect(auth.openLoginModal).toHaveBeenCalledTimes(1)
    // The question is kept so it can be resent after signing back in.
    expect(input()).toHaveValue('Question')
  })

  it('signs out when loading the saved chat answers 401', async () => {
    const auth = signedIn()
    mockUseAuth.mockReturnValue(auth)
    mockGetChatHistory.mockRejectedValueOnce(new APIError('Token expired', 401, 'TOKEN_EXPIRED'))

    renderChat()

    await waitFor(() => expect(auth.logout).toHaveBeenCalledTimes(1))
    expect(auth.openLoginModal).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Couldn't load your saved chat.")).not.toBeInTheDocument()
  })

  it('disables sending after a failed load, and Retry recovers', async () => {
    mockGetChatHistory
      .mockRejectedValueOnce(new APIError('Server error', 500, 'DATABASE_ERROR'))
      .mockResolvedValueOnce([
        { role: 'user', content: 'Saved question', createdAt: '2026-09-23T10:00:00Z' },
      ])

    renderChat()

    expect(await screen.findByText("Couldn't load your saved chat.")).toBeInTheDocument()
    expect(input()).toBeDisabled()
    expect(screen.queryByText(GREETING)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Saved question')).toBeInTheDocument()
    expect(input()).not.toBeDisabled()
    expect(mockGetChatHistory).toHaveBeenCalledTimes(2)
  })

  it('shows only a loader while auth is still loading', () => {
    mockUseAuth.mockReturnValue({ ...signedIn(), user: null, isLoading: true })

    renderChat()

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByPlaceholderText('Ask about this transcript...')).not.toBeInTheDocument()
    expect(screen.queryByText('Authentication Required')).not.toBeInTheDocument()
    expect(mockGetChatHistory).not.toHaveBeenCalled()
  })

  it("never shows one user's cached chat to the next user", async () => {
    mockGetChatHistory
      .mockResolvedValueOnce([{ role: 'user', content: "Alice's question", createdAt: '' }])
      .mockResolvedValueOnce([])

    const { rerender, queryClient } = renderChat()
    expect(await screen.findByText("Alice's question")).toBeInTheDocument()

    mockUseAuth.mockReturnValue({ ...signedIn(), user: { id: 'u2', email: 'bob@test.com' } })
    rerender(chatTree(queryClient))

    expect(await screen.findByText(GREETING)).toBeInTheDocument()
    expect(screen.queryByText("Alice's question")).not.toBeInTheDocument()
    expect(mockGetChatHistory).toHaveBeenCalledTimes(2)
    expect(queryClient.getQueryData(cacheKey('u2'))).toEqual([])
  })

  it('switching transcript mid-reply starts clean and files the reply under the first transcript', async () => {
    const other = { ...transcript, id: '0b1c2d3e-4f5a-4b6c-9d8e-7f6a5b4c3d2e', title: 'Lightning Basics' } as RawTranscript
    let resolveReply: (value: unknown) => void = () => {}
    mockChatWithTranscript.mockReturnValueOnce(new Promise((resolve) => (resolveReply = resolve)))
    mockGetChatHistory.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const { rerender, queryClient } = renderChat()
    await screen.findByText(GREETING)
    send('Question about Taproot')
    expect(screen.getByText('Question about Taproot')).toBeInTheDocument()

    rerender(chatTree(queryClient, other))

    expect(await screen.findByText(/I've analyzed "Lightning Basics"/)).toBeInTheDocument()
    expect(screen.queryByText('Question about Taproot')).not.toBeInTheDocument()
    expect(input()).toHaveValue('')
    expect(input()).not.toBeDisabled()

    await act(async () => {
      resolveReply({ message: 'Taproot answer', saved: true, failed: false })
    })

    expect(screen.queryByText('Taproot answer')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(cacheKey('u1', other.id))).toEqual([])
    expect(queryClient.getQueryData(cacheKey())).toEqual([
      expect.objectContaining({ role: 'user', content: 'Question about Taproot' }),
      expect.objectContaining({ role: 'assistant', content: 'Taproot answer' }),
    ])
  })

  it('New chat clears the saved chat and brings back the greeting', async () => {
    mockGetChatHistory.mockResolvedValueOnce([
      { role: 'user', content: 'Old question', createdAt: '2026-09-23T10:00:00Z' },
      { role: 'assistant', content: 'Old answer', createdAt: '2026-09-23T10:00:01Z' },
    ])
    mockClearChat.mockResolvedValueOnce(undefined)

    renderChat()
    await screen.findByText('Old question')

    fireEvent.click(screen.getByRole('button', { name: /New chat/ }))
    // Nothing is deleted until the confirmation.
    expect(await screen.findByText('Start a new chat?')).toBeInTheDocument()
    expect(mockClearChat).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat' }))

    expect(await screen.findByText(GREETING)).toBeInTheDocument()
    expect(mockClearChat).toHaveBeenCalledWith(transcript.id)
    expect(screen.queryByText('Old question')).not.toBeInTheDocument()
    expect(mockGetChatHistory).toHaveBeenCalledTimes(1)
  })

  it('keeps the saved chat when New chat is cancelled', async () => {
    mockGetChatHistory.mockResolvedValueOnce([
      { role: 'user', content: 'Old question', createdAt: '2026-09-23T10:00:00Z' },
    ])

    renderChat()
    await screen.findByText('Old question')

    fireEvent.click(screen.getByRole('button', { name: /New chat/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByText('Start a new chat?')).not.toBeInTheDocument())
    expect(mockClearChat).not.toHaveBeenCalled()
    expect(screen.getByText('Old question')).toBeInTheDocument()
  })

  it('disables New chat when there is nothing to clear', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])

    renderChat()
    await screen.findByText(GREETING)

    expect(screen.getByRole('button', { name: /New chat/ })).toBeDisabled()
  })
})
