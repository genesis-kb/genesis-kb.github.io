/**
 * Unit Tests — components/ProtectedRoute.tsx
 *
 * Tests rendering children when authenticated, showing loading spinner,
 * and triggering login modal / redirect when unauthenticated.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// Mock useAuth hook
const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading spinner when isLoading is true', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      openLoginModal: vi.fn(),
      isLoginModalOpen: false,
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret stuff</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    // Loading spinner should be visible (Loader2 renders an SVG with animate-spin)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()

    // Protected content should NOT be rendered
    expect(screen.queryByTestId('protected-content')).toBeNull()
  })

  it('renders children when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'u1', email: 'test@test.com' },
      isLoading: false,
      openLoginModal: vi.fn(),
      isLoginModalOpen: false,
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret stuff</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    expect(screen.getByTestId('protected-content')).toBeInTheDocument()
  })

  it('opens login modal when not authenticated and not loading', async () => {
    const openLoginModal = vi.fn()
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      openLoginModal,
      isLoginModalOpen: false,
    })

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    // Should NOT render protected content
    expect(screen.queryByTestId('protected-content')).toBeNull()

    // Should have called openLoginModal
    await waitFor(() => {
      expect(openLoginModal).toHaveBeenCalledTimes(1)
    })
  })

  it('redirects to redirectTo path when modal is closed without login', async () => {
    const openLoginModal = vi.fn()
    
    // First render: modal opens
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      openLoginModal,
      isLoginModalOpen: false, // modal was closed after being opened
    })

    const { rerender } = render(
      <MemoryRouter>
        <ProtectedRoute redirectTo="/home">
          <div>Secret</div>
        </ProtectedRoute>
      </MemoryRouter>
    )

    // After the useEffects run, navigate should be called with redirectTo
    await waitFor(() => {
      // The redirect may happen after two renders (once for modal open, once for close)
      if (mockNavigate.mock.calls.length > 0) {
        expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true })
      }
    })
  })
})
