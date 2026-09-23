/**
 * Unit Tests — hooks/useChatHistory.ts
 *
 * Tests the per-user query key, cancelling in-flight fetches before an
 * append, and refetching instead of appending when nothing is cached.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { mockGetChatHistory } = vi.hoisted(() => ({ mockGetChatHistory: vi.fn() }))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@test.com' } }),
}))
vi.mock('../../../services/aiService', () => ({
  getChatHistory: (...args: unknown[]) => mockGetChatHistory(...args),
  clearChat: vi.fn(),
}))

import { useChatHistory } from '@/hooks/useChatHistory'

const TRANSCRIPT_ID = 't1'
const KEY = ['chatHistory', 'u1', TRANSCRIPT_ID]

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  const hook = renderHook(() => useChatHistory(TRANSCRIPT_ID), { wrapper })
  return { queryClient, ...hook }
}

describe('useChatHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('caches the saved chat under the user and transcript', async () => {
    mockGetChatHistory.mockResolvedValueOnce([{ role: 'user', content: 'Q', createdAt: '' }])

    const { queryClient, result } = setup()

    await waitFor(() => expect(result.current.messages).toHaveLength(1))
    expect(queryClient.getQueryData(KEY)).toEqual([{ role: 'user', content: 'Q', createdAt: '' }])
  })

  it('cancels in-flight fetches before appending an exchange', async () => {
    mockGetChatHistory.mockResolvedValueOnce([])
    const { queryClient, result } = setup()
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const cancel = vi.spyOn(queryClient, 'cancelQueries')
    const set = vi.spyOn(queryClient, 'setQueryData')

    await act(() => result.current.appendExchange('Q', 'A'))

    expect(cancel).toHaveBeenCalledWith({ queryKey: KEY })
    expect(set).toHaveBeenCalled()
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0])
    expect(queryClient.getQueryData(KEY)).toEqual([
      expect.objectContaining({ role: 'user', content: 'Q' }),
      expect.objectContaining({ role: 'assistant', content: 'A' }),
    ])
  })

  it('refetches instead of appending when nothing is cached', async () => {
    mockGetChatHistory.mockRejectedValueOnce(new Error('load failed'))
    const { queryClient, result } = setup()
    await waitFor(() => expect(result.current.error).toBeTruthy())

    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const set = vi.spyOn(queryClient, 'setQueryData')
    mockGetChatHistory.mockResolvedValueOnce([
      { role: 'user', content: 'Older', createdAt: '' },
      { role: 'user', content: 'Q', createdAt: '' },
      { role: 'assistant', content: 'A', createdAt: '' },
    ])

    await act(() => result.current.appendExchange('Q', 'A'))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: KEY })
    expect(set).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.messages).toHaveLength(3))
  })
})
