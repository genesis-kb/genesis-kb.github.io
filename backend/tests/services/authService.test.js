/**
 * Unit Tests — authService.js
 *
 * Tests registerUser, loginUser, getUserById.
 * Mocks: query (from supabaseService), bcrypt, jwt, config.
 */

import { jest } from '@jest/globals';

// ─── Manual mocks ───────────────────────────────────────────────────────────
// We mock the `query` function that authService imports from supabaseService
const mockQuery = jest.fn();
jest.unstable_mockModule('../../src/services/supabaseService.js', () => ({
  query: mockQuery,
}));

// Mock config to provide test JWT secret
jest.unstable_mockModule('../../src/config/index.js', () => ({
  default: {
    auth: {
      jwtSecret: 'test-jwt-secret-for-unit-tests-must-be-at-least-32-chars',
      jwtExpiresIn: '1h',
      bcryptRounds: 4, // fast rounds for testing
    },
  },
}));

// Mock logger to suppress output
jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Import AFTER mocks are set up
const { registerUser, loginUser, getUserById } = await import(
  '../../src/services/authService.js'
);

// ─── Setup / Teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  mockQuery.mockReset();
});

// ─── registerUser ───────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('returns user and token on success', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          avatar_url: null,
          created_at: '2024-01-01',
        },
      ],
    });

    const result = await registerUser('test@test.com', 'password123', 'Test');

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('test@test.com');
    expect(result.user.id).toBe('user-1');
  });

  it('does not return password in user object', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          password: 'hashed',
          avatar_url: null,
          created_at: '2024-01-01',
        },
      ],
    });

    const result = await registerUser('test@test.com', 'password123');
    expect(result.user).not.toHaveProperty('password');
  });

  it('throws 409 EMAIL_EXISTS on duplicate email (pg error 23505)', async () => {
    const pgError = new Error('duplicate key');
    pgError.code = '23505';
    mockQuery.mockRejectedValueOnce(pgError);

    await expect(registerUser('dup@test.com', 'pass1234')).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_EXISTS',
    });
  });

  it('re-throws non-duplicate database errors', async () => {
    const genericError = new Error('connection failed');
    mockQuery.mockRejectedValueOnce(genericError);

    await expect(registerUser('test@test.com', 'pass1234')).rejects.toThrow(
      'connection failed'
    );
  });
});

// ─── loginUser ──────────────────────────────────────────────────────────────

describe('loginUser', () => {
  it('returns user and token for valid credentials', async () => {
    // We need a real bcrypt hash for the password 'password123'
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('password123', 4);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          password: hash,
          avatar_url: null,
          created_at: '2024-01-01',
        },
      ],
    });

    const result = await loginUser('test@test.com', 'password123');

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('test@test.com');
    expect(result.user).not.toHaveProperty('password');
  });

  it('throws 401 when user is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(loginUser('unknown@test.com', 'pass1234')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('throws 401 when password is wrong', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-password', 4);

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          password: hash,
          avatar_url: null,
          created_at: '2024-01-01',
        },
      ],
    });

    await expect(loginUser('test@test.com', 'wrong-password')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });
});

// ─── getUserById ─────────────────────────────────────────────────────────────

describe('getUserById', () => {
  it('returns sanitized user when found', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          avatar_url: 'https://img.example.com/1.jpg',
          created_at: '2024-01-01',
        },
      ],
    });

    const user = await getUserById('user-1');

    expect(user).toEqual({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test',
      avatarUrl: 'https://img.example.com/1.jpg',
      createdAt: '2024-01-01',
    });
  });

  it('returns null when user is not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const user = await getUserById('nonexistent');
    expect(user).toBeNull();
  });
});
