/**
 * Saved AI chat for one transcript (signed-in users only).
 *
 * React Query owns the saved messages, keyed per user and transcript, so
 * switching tabs or reopening the chat panel reads the cache instead of
 * refetching, and one user's chat is never served to another.
 * A successful reply is appended to the cache rather than refetched.
 */

import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'
import { chatHistoryKey } from '@/lib/queryKeys'
import {
  clearChat,
  getChatHistory,
  type ChatHistoryMessage,
} from '../../services/aiService'

export interface UseChatHistoryReturn {
  messages: ChatHistoryMessage[]
  isLoading: boolean
  error: unknown
  refetch: () => void
  appendExchange: (question: string, answer: string) => Promise<void>
  clear: () => Promise<void>
  isClearing: boolean
}

export function useChatHistory(transcriptId: string): UseChatHistoryReturn {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id ?? ''
  const queryKey = chatHistoryKey(userId, transcriptId)

  const {
    data: messages = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ChatHistoryMessage[]>({
    queryKey,
    queryFn: () => getChatHistory(transcriptId),
    enabled: !!userId && !!transcriptId,
    staleTime: 5 * 60 * 1000, // 5min — only this tab writes to the chat
    gcTime: 30 * 60 * 1000,
    retry: false,
  })

  const appendExchange = useCallback(
    async (question: string, answer: string) => {
      const key = chatHistoryKey(userId, transcriptId)

      // A fetch finishing after this write would overwrite it with a list
      // that may not include the new exchange yet.
      await queryClient.cancelQueries({ queryKey: key })

      // With nothing cached (e.g. history never loaded), writing just this
      // exchange would hide the older saved messages — refetch instead.
      if (queryClient.getQueryData(key) === undefined) {
        await queryClient.invalidateQueries({ queryKey: key })
        return
      }

      const now = new Date().toISOString()
      queryClient.setQueryData<ChatHistoryMessage[]>(key, (old = []) => [
        ...old,
        { role: 'user', content: question, createdAt: now },
        { role: 'assistant', content: answer, createdAt: now },
      ])
    },
    [queryClient, userId, transcriptId]
  )

  const clearMutation = useMutation({
    mutationFn: () => clearChat(transcriptId),
    onSuccess: () => {
      queryClient.setQueryData<ChatHistoryMessage[]>(queryKey, [])
    },
  })

  return {
    messages,
    // Disabled queries report pending; only a running fetch counts as loading.
    isLoading: !!userId && isLoading,
    error,
    refetch: () => void refetch(),
    appendExchange,
    clear: () => clearMutation.mutateAsync(),
    isClearing: clearMutation.isPending,
  }
}
