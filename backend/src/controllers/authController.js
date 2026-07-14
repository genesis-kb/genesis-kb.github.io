/**
 * Auth Controller
 * Handles HTTP request/response for authentication endpoints.
 * Validates input, delegates to authService, and formats responses.
 */

import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import * as authService from '../services/authService.js';

/**
 * POST /api/v1/auth/register
 * Create a new user account.
 * Body: { email, password, name? }
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  // Input validation
  if (!email || !password) {
    throw new APIError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new APIError('Invalid email format', 400, 'VALIDATION_ERROR');
  }

  if (password.length < 8) {
    throw new APIError('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
  }

  if (password.length > 128) {
    throw new APIError('Password must be at most 128 characters', 400, 'VALIDATION_ERROR');
  }

  try {
    const result = await authService.registerUser(email, password, name);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode === 409) {
      throw new APIError(err.message, 409, err.code || 'EMAIL_EXISTS');
    }
    throw err;
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate with email and password.
 * Body: { email, password }
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new APIError('Email and password are required', 400, 'VALIDATION_ERROR');
  }

  try {
    const result = await authService.loginUser(email, password);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.statusCode === 401) {
      throw new APIError(err.message, 401, err.code || 'INVALID_CREDENTIALS');
    }
    throw err;
  }
});

/**
 * GET /api/v1/auth/me
 * Get the current user's profile.
 * Requires: Authorization: Bearer <token>
 */
export const me = asyncHandler(async (req, res) => {
  const user = await authService.getUserById(req.user.id);

  if (!user) {
    throw new APIError('User not found', 404, 'NOT_FOUND');
  }

  res.json({ success: true, data: { user } });
});
