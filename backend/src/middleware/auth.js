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

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new APIError('Authentication required', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  req.user = verifyToken(token);
  next();
};
