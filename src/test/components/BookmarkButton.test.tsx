/**
 * Unit Tests — components/BookmarkButton.tsx
 *
 * Tests rendering in bookmarked/unbookmarked states,
 * click toggles, label display, and event propagation stop.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookmarkButton } from '@/components/BookmarkButton'

// Mock useBookmarks hook
const mockIsBookmarked = vi.fn()
const mockAddBookmark = vi.fn()
const mockRemoveBookmark = vi.fn()

vi.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: mockIsBookmarked,
    addBookmark: mockAddBookmark,
    removeBookmark: mockRemoveBookmark,
    bookmarks: [],
    highlights: [],
    addHighlight: vi.fn(),
    removeHighlight: vi.fn(),
    updateHighlightNote: vi.fn(),
    getHighlightsForTranscript: vi.fn(),
    totalCount: 0,
    isPersistent: true,
    showPrivateModeNotice: false,
    isLoading: false,
  }),
}))

const sampleTranscript = {
  id: 't-123',
  title: 'Bitcoin Scaling Solutions',
  speakers: ['Alice', 'Bob'],
  event_date: '2024-03-15',
  loc: 'Miami',
}

describe('BookmarkButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with "Add bookmark" aria-label when not bookmarked', () => {
    mockIsBookmarked.mockReturnValue(false)

    render(<BookmarkButton transcript={sampleTranscript} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Add bookmark')
    expect(button).toHaveAttribute('title', 'Add bookmark')
  })

  it('renders with "Remove bookmark" aria-label when bookmarked', () => {
    mockIsBookmarked.mockReturnValue(true)

    render(<BookmarkButton transcript={sampleTranscript} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Remove bookmark')
  })

  it('calls addBookmark when clicked and not bookmarked', async () => {
    mockIsBookmarked.mockReturnValue(false)
    const user = userEvent.setup()

    render(<BookmarkButton transcript={sampleTranscript} />)

    await user.click(screen.getByRole('button'))

    expect(mockAddBookmark).toHaveBeenCalledWith(sampleTranscript)
    expect(mockRemoveBookmark).not.toHaveBeenCalled()
  })

  it('calls removeBookmark when clicked and already bookmarked', async () => {
    mockIsBookmarked.mockReturnValue(true)
    const user = userEvent.setup()

    render(<BookmarkButton transcript={sampleTranscript} />)

    await user.click(screen.getByRole('button'))

    expect(mockRemoveBookmark).toHaveBeenCalledWith('t-123')
    expect(mockAddBookmark).not.toHaveBeenCalled()
  })

  it('shows "Bookmark" label when showLabel=true and not bookmarked', () => {
    mockIsBookmarked.mockReturnValue(false)

    render(<BookmarkButton transcript={sampleTranscript} showLabel />)

    expect(screen.getByText('Bookmark')).toBeInTheDocument()
  })

  it('shows "Bookmarked" label when showLabel=true and bookmarked', () => {
    mockIsBookmarked.mockReturnValue(true)

    render(<BookmarkButton transcript={sampleTranscript} showLabel />)

    expect(screen.getByText('Bookmarked')).toBeInTheDocument()
  })

  it('does not show label when showLabel=false (default)', () => {
    mockIsBookmarked.mockReturnValue(false)

    render(<BookmarkButton transcript={sampleTranscript} />)

    expect(screen.queryByText('Bookmark')).toBeNull()
    expect(screen.queryByText('Bookmarked')).toBeNull()
  })

  it('stops event propagation on click', async () => {
    mockIsBookmarked.mockReturnValue(false)
    const parentClickHandler = vi.fn()
    const user = userEvent.setup()

    render(
      <div onClick={parentClickHandler}>
        <BookmarkButton transcript={sampleTranscript} />
      </div>
    )

    await user.click(screen.getByRole('button'))

    expect(parentClickHandler).not.toHaveBeenCalled()
  })

  it('passes transcript.id to isBookmarked check', () => {
    mockIsBookmarked.mockReturnValue(false)

    render(<BookmarkButton transcript={sampleTranscript} />)

    expect(mockIsBookmarked).toHaveBeenCalledWith('t-123')
  })
})
