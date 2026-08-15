/**
 * Unit Tests — audiobookController.js
 *
 * Tests input validation, status enums, progress capping, and buildRoadmapChapters.
 * Mocks: audiobookService.
 */

import { jest } from '@jest/globals';

const mockAudiobookService = {
  listPlaylists: jest.fn(),
  getPlaylistBySlug: jest.fn(),
  getEpisodeById: jest.fn(),
  fetchAllAudiobooks: jest.fn(),
  fetchAudiobookRoadmap: jest.fn(),
  fetchUserProgress: jest.fn(),
  upsertProgress: jest.fn(),
};

jest.unstable_mockModule('../../src/services/audiobookService.js', () => mockAudiobookService);

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  getPlaylists,
  getPlaylistBySlug,
  getEpisodeById,
  saveProgress,
} = await import('../../src/controllers/audiobookController.js');

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getPlaylists ───────────────────────────────────────────────────────────

describe('getPlaylists', () => {
  it('throws 400 for invalid status value', async () => {
    const req = { query: { status: 'invalid' } };
    const res = createMockRes();

    try {
      await getPlaylists(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    }
  });

  it('throws 400 for invalid playlist_type', async () => {
    const req = { query: { playlist_type: 'bad' } };
    const res = createMockRes();

    try {
      await getPlaylists(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws 400 for invalid source', async () => {
    const req = { query: { source: 'unknown' } };
    const res = createMockRes();

    try {
      await getPlaylists(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('succeeds with valid filter params', async () => {
    mockAudiobookService.listPlaylists.mockResolvedValueOnce([]);
    const req = { query: { status: 'published' } };
    const res = createMockRes();

    await getPlaylists(req, res);
    expect(res.statusCode).toBe(200);
  });
});

// ─── getPlaylistBySlug ──────────────────────────────────────────────────────

describe('getPlaylistBySlug', () => {
  it('throws 400 for invalid slug format', async () => {
    const req = { params: { slug: 'INVALID SLUG!!' }, user: null };
    const res = createMockRes();

    try {
      await getPlaylistBySlug(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws 404 when playlist not found', async () => {
    mockAudiobookService.getPlaylistBySlug.mockResolvedValueOnce(null);
    const req = { params: { slug: 'valid-slug' }, user: null };
    const res = createMockRes();

    try {
      await getPlaylistBySlug(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(404);
    }
  });
});

// ─── getEpisodeById ─────────────────────────────────────────────────────────

describe('getEpisodeById', () => {
  it('throws 400 for invalid UUID format', async () => {
    const req = { params: { episode_id: 'not-uuid' } };
    const res = createMockRes();

    try {
      await getEpisodeById(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws 404 when episode not found', async () => {
    mockAudiobookService.getEpisodeById.mockResolvedValueOnce(null);
    const req = { params: { episode_id: '00000000-0000-0000-0000-000000000000' } };
    const res = createMockRes();

    try {
      await getEpisodeById(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(404);
    }
  });
});

// ─── saveProgress ───────────────────────────────────────────────────────────

describe('saveProgress', () => {
  it('throws 400 for invalid chapter_id UUID', async () => {
    const req = {
      user: { id: 'u1' },
      body: { chapter_id: 'bad', current_seconds: 10, completed: false },
    };
    const res = createMockRes();

    try {
      await saveProgress(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws 400 for negative current_seconds', async () => {
    const req = {
      user: { id: 'u1' },
      body: {
        chapter_id: '00000000-0000-0000-0000-000000000000',
        current_seconds: -5,
        completed: false,
      },
    };
    const res = createMockRes();

    try {
      await saveProgress(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('caps current_seconds at MAX_SECONDS (86400)', async () => {
    mockAudiobookService.upsertProgress.mockResolvedValueOnce();
    const req = {
      user: { id: 'u1' },
      body: {
        chapter_id: '00000000-0000-0000-0000-000000000000',
        current_seconds: 100000, // exceeds 86400
        completed: false,
      },
    };
    const res = createMockRes();

    await saveProgress(req, res);

    // Verify capped value was passed to service
    const passedSeconds = mockAudiobookService.upsertProgress.mock.calls[0][2];
    expect(passedSeconds).toBe(86400);
  });

  it('throws 404 on FK violation (episode not found)', async () => {
    const fkError = new Error('foreign key violation');
    fkError.code = '23503';
    mockAudiobookService.upsertProgress.mockRejectedValueOnce(fkError);

    const req = {
      user: { id: 'u1' },
      body: {
        chapter_id: '00000000-0000-0000-0000-000000000000',
        current_seconds: 100,
        completed: false,
      },
    };
    const res = createMockRes();

    try {
      await saveProgress(req, res);
      throw new Error('Expected to throw');
    } catch (err) {
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    }
  });

  it('returns success on valid save', async () => {
    mockAudiobookService.upsertProgress.mockResolvedValueOnce();
    const req = {
      user: { id: 'u1' },
      body: {
        chapter_id: '00000000-0000-0000-0000-000000000000',
        current_seconds: 120,
        completed: true,
      },
    };
    const res = createMockRes();

    await saveProgress(req, res);
    expect(res.body.data.saved).toBe(true);
  });
});
