/**
 * Auth Controller
 * Handles HTTP request/response for authentication endpoints.
 * Validates input, delegates to authService, and formats responses.
 */

import { asyncHandler, APIError } from '../middleware/errorHandler.js';
import * as authService from '../services/authService.js';
import { sendSuccess, sendCreated } from '../utils/responseHelper.js';

/**
 * POST /api/v1/auth/register
 * Create a new user account.
 * Body: { email, password, name? }
 */
export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const result = await authService.registerUser(email, password, name);
    sendCreated(res, result);
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

  try {
    const result = await authService.loginUser(email, password);
    sendSuccess(res, result);
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

  sendSuccess(res, { user });
});
