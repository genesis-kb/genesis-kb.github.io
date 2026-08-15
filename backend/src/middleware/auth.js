/**
 * JWT Authentication Middleware
 * Extracts and verifies JWT from the Authorization header.
 * Sets req.user = { id, email } on success.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { APIError } from './errorHandler.js';

/**
 * Verify JWT token and return decoded user info
 * @param {string} token
 * @returns {Object} { id, email }
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    return { id: decoded.sub, email: decoded.email };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new APIError('Token expired — please log in again', 401, 'TOKEN_EXPIRED');
    }
    throw new APIError('Invalid token', 401, 'INVALID_TOKEN');
  }
};

/**
 * requireAuth — blocks unauthenticated requests with 401.
 * Expects header: Authorization: Bearer <token>
 */
export const requireAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new APIError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  req.user = verifyToken(token);
  next();
};

/**
 * optionalAuth — does not block unauthenticated requests.
 * Parses the token and sets req.user if present and valid.
 * Fails silently for missing/invalid tokens.
 */
export const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    try {
      req.user = verifyToken(token);
    } catch (err) {
      // Ignore token errors for optional auth (e.g. expired or invalid)
    }
  }

  next();
};
