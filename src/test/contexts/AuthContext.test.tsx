/**
 * Unit Tests — contexts/AuthContext.tsx
 *
 * Tests the AuthProvider: initial loading state, token validation on mount,
 * login, register, logout, and login modal state management.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/hooks/useAuth'

// Mock the authApi module
vi.mock('../../../services/authService', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
  },
  default: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

/** Helper component that exposes auth state for testing */
function AuthConsumer({ onRender }: { onRender: (auth: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth()
  onRender(auth)
  return (
    <div>
      <span data-testid="user">{auth.user ? auth.user.email : 'none'}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="modal">{String(auth.isLoginModalOpen)}</span>
      <button data-testid="logout" onClick={auth.logout}>Logout</button>
      <button data-testid="open-modal" onClick={auth.openLoginModal}>Open</button>
      <button data-testid="close-modal" onClick={auth.closeLoginModal}>Close</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with isLoading=true and user=null when no stored token', async () => {
    const { authApi } = await import('../../../services/authService')

    const captured: ReturnType<typeof useAuth>[] = []

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => captured.push(auth)} />
      </AuthProvider>
    )

    // After mount, should finish loading with no user
    await waitFor(() => {
      const last = captured[captured.length - 1]
      expect(last.isLoading).toBe(false)
      expect(last.user).toBeNull()
    })

    // me() should NOT have been called since there's no token
    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('validates stored token on mount via authApi.me()', async () => {
    localStorage.setItem('btc-auth-token', 'valid-token')

    const { authApi } = await import('../../../services/authService')
    const mockUser = { id: 'u1', email: 'alice@example.com', name: 'Alice', avatarUrl: null, createdAt: '2024-01-01' }
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: mockUser })

    const captured: ReturnType<typeof useAuth>[] = []

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => captured.push(auth)} />
      </AuthProvider>
    )

    await waitFor(() => {
      const last = captured[captured.length - 1]
      expect(last.isLoading).toBe(false)
      expect(last.user?.email).toBe('alice@example.com')
    })

    expect(authApi.me).toHaveBeenCalledWith('valid-token')
  })

  it('clears token silently when stored token is invalid', async () => {
    localStorage.setItem('btc-auth-token', 'expired-token')

    const { authApi } = await import('../../../services/authService')
    vi.mocked(authApi.me).mockRejectedValueOnce(new Error('Token expired'))

    const captured: ReturnType<typeof useAuth>[] = []

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => captured.push(auth)} />
      </AuthProvider>
    )

    await waitFor(() => {
      const last = captured[captured.length - 1]
      expect(last.isLoading).toBe(false)
      expect(last.user).toBeNull()
    })

    expect(localStorage.getItem('btc-auth-token')).toBeNull()
  })

  it('logout() clears user and token', async () => {
    localStorage.setItem('btc-auth-token', 'valid-token')

    const { authApi } = await import('../../../services/authService')
    const mockUser = { id: 'u1', email: 'test@test.com', name: 'Test', avatarUrl: null, createdAt: '' }
    vi.mocked(authApi.me).mockResolvedValueOnce({ user: mockUser })

    const captured: ReturnType<typeof useAuth>[] = []
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => captured.push(auth)} />
      </AuthProvider>
    )

    // Wait for user to load
    await waitFor(() => {
      expect(captured[captured.length - 1].user).not.toBeNull()
    })

    // Click logout
    await user.click(screen.getByTestId('logout'))

    await waitFor(() => {
      expect(captured[captured.length - 1].user).toBeNull()
    })
    expect(localStorage.getItem('btc-auth-token')).toBeNull()
  })

  it('openLoginModal / closeLoginModal toggle isLoginModalOpen', async () => {
    const captured: ReturnType<typeof useAuth>[] = []
    const user = userEvent.setup()

    render(
      <AuthProvider>
        <AuthConsumer onRender={(auth) => captured.push(auth)} />
      </AuthProvider>
    )

    await waitFor(() => expect(captured[captured.length - 1].isLoading).toBe(false))

    expect(captured[captured.length - 1].isLoginModalOpen).toBe(false)

    await user.click(screen.getByTestId('open-modal'))
    await waitFor(() => expect(captured[captured.length - 1].isLoginModalOpen).toBe(true))

    await user.click(screen.getByTestId('close-modal'))
    await waitFor(() => expect(captured[captured.length - 1].isLoginModalOpen).toBe(false))
  })
})

describe('useAuth (outside provider)', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress React error boundary noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function BadComponent() {
      useAuth()
      return null
    }

    expect(() => render(<BadComponent />)).toThrow('useAuth must be used within an AuthProvider')

    spy.mockRestore()
  })
})
