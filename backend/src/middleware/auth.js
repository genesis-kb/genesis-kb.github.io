/**
 * JWT Authentication Middleware
 * Extracts and verifies JWT from the Authorization header.
 * Sets req.user = { id, email } on success.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { APIError } from './errorHandler.js';

/**
 * requireAuth — blocks unauthenticated requests with 401.
 * Expects header: Authorization: Bearer <token>
 */
export const requireAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new APIError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new APIError('Token expired — please log in again', 401, 'TOKEN_EXPIRED');
    }
    throw new APIError('Invalid token', 401, 'INVALID_TOKEN');
  }
};

/**
 * optionalAuth — attaches user if a valid token is present, but does NOT block.
 * Useful for routes that work for both guests and logged-in users.
 * Sets req.user = null when no token or invalid token.
 */
export const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    req.user = { id: decoded.sub, email: decoded.email };
  } catch {
    req.user = null;
  }

  next();
};
