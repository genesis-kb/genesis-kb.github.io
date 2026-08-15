/**
 * Unit Tests — authController.js
 *
 * Tests controller logic (request→service delegation, response formatting).
 * Mocks: authService, responseHelper.
 */

import { jest } from '@jest/globals';

const mockAuthService = {
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  getUserById: jest.fn(),
};

jest.unstable_mockModule('../../src/services/authService.js', () => mockAuthService);

jest.unstable_mockModule('../../src/config/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { register, login, me } = await import(
  '../../src/controllers/authController.js'
);

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; },
  };
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('register', () => {
  it('returns 201 with user and token on success', async () => {
    const result = { user: { id: 'u1', email: 'a@b.com' }, token: 'jwt-token' };
    mockAuthService.registerUser.mockResolvedValueOnce(result);

    const req = { body: { email: 'a@b.com', password: 'pass1234', name: 'Test' } };
    const res = createMockRes();
    const next = jest.fn();
    await register(req, res, next);

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(result);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with 409 for duplicate email', async () => {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    err.code = 'EMAIL_EXISTS';
    mockAuthService.registerUser.mockRejectedValueOnce(err);

    const req = { body: { email: 'dup@test.com', password: 'pass1234' } };
    const res = createMockRes();
    const next = jest.fn();

    await register(req, res, next);
    
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 409,
      code: 'EMAIL_EXISTS'
    }));
  });
});

describe('login', () => {
  it('returns 200 with user and token on success', async () => {
    const result = { user: { id: 'u1', email: 'a@b.com' }, token: 'jwt' };
    mockAuthService.loginUser.mockResolvedValueOnce(result);

    const req = { body: { email: 'a@b.com', password: 'pass1234' } };
    const res = createMockRes();
    const next = jest.fn();
    await login(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual(result);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with 401 for wrong credentials', async () => {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    mockAuthService.loginUser.mockRejectedValueOnce(err);

    const req = { body: { email: 'a@b.com', password: 'wrong' } };
    const res = createMockRes();
    const next = jest.fn();

    await login(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS'
    }));
  });
});

describe('me', () => {
  it('returns 200 with user when found', async () => {
    const user = { id: 'u1', email: 'a@b.com', name: 'Test' };
    mockAuthService.getUserById.mockResolvedValueOnce(user);

    const req = { user: { id: 'u1' } };
    const res = createMockRes();
    const next = jest.fn();
    await me(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user).toEqual(user);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with 404 when user not found', async () => {
    mockAuthService.getUserById.mockResolvedValueOnce(null);

    const req = { user: { id: 'u-deleted' } };
    const res = createMockRes();
    const next = jest.fn();

    await me(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
      code: 'NOT_FOUND',
    }));
  });
});
