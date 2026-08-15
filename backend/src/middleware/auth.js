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
 * Extracts a Bearer token from the Authorization header.
 * @param {Object} headers - Express request headers object
 * @returns {string|null} The token string, or null if not found
 */
const extractBearerToken = (headers) => {
  const authHeader = headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.replace(/^Bearer\s+/i, '').trim();
  }
  return null;
};

/**
 * requireAuth — blocks unauthenticated requests with 401.
 * Expects header: Authorization: Bearer <token>
 */
export const requireAuth = (req, _res, next) => {
  const token = extractBearerToken(req.headers);

  if (!token) {
    throw new APIError('Authentication required', 401, 'UNAUTHORIZED');
  }

  req.user = verifyToken(token);
  next();
};

/**
 * optionalAuth — does not block unauthenticated requests.
 * Parses the token and sets req.user if present and valid.
 * Fails silently for missing/invalid tokens.
 */
export const optionalAuth = (req, _res, next) => {
  const token = extractBearerToken(req.headers);

  if (token) {
    try {
      req.user = verifyToken(token);
    } catch (err) {
      // Ignore token errors for optional auth (e.g. expired or invalid)
    }
  }

  next();
};
