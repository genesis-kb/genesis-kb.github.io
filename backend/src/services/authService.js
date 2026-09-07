/**
 * Auth Service
 * Handles user registration, login, and JWT token generation.
 * All database operations use the shared query() from supabaseService.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../config/logger.js';
import { query } from './supabaseService.js';

let dummyHash = null;
const getDummyHash = async () => {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash('dummy-password', config.auth.bcryptRounds);
  }
  return dummyHash;
};

/**
 * Register a new user with email and password.
 * @param {string} email - User email
 * @param {string} password - Plain-text password (will be hashed)
 * @param {string} [name] - Optional display name
 * @returns {Promise<{user: Object, token: string}>}
 * @throws {Error} 409 if email already registered
 */
export const registerUser = async (email, password, name) => {
  // Email uniqueness is enforced by the unique constraint on the database

  // Hash password
  const hashedPassword = await bcrypt.hash(password, config.auth.bcryptRounds);

  // Insert user
  const safeName = typeof name === 'string' ? name.trim() : null;
  let result;
  try {
    result = await query(
      `INSERT INTO users (email, password, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar_url, created_at`,
      [email.toLowerCase().trim(), hashedPassword, safeName]
    );
  } catch (err) {
    if (err.code === '23505') {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      error.code = 'EMAIL_EXISTS';
      throw error;
    }
    throw err;
  }

  const user = result.rows[0];
  const token = generateToken(user);

  logger.info(`New user registered: ${user.id}`);

  return {
    user: sanitizeUser(user),
    token,
  };
};

/**
 * Log in with email and password.
 * @param {string} email - User email
 * @param {string} password - Plain-text password
 * @returns {Promise<{user: Object, token: string}>}
 * @throws {Error} 401 if credentials are invalid
 */
export const loginUser = async (email, password) => {
  const result = await query(
    'SELECT id, email, name, password, avatar_url, created_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  let user, isValid;

  if (result.rows.length === 0) {
    // Defend against timing attacks by doing identical password hash work
    await bcrypt.compare(password, await getDummyHash());
    isValid = false;
  } else {
    user = result.rows[0];
    isValid = await bcrypt.compare(password, user.password);
  }

  if (!isValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  const token = generateToken(user);

  logger.info(`User logged in: ${user.id}`);

  return {
    user: sanitizeUser(user),
    token,
  };
};

/**
 * Get a user's public profile by ID.
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} User profile or null
 */
export const getUserById = async (userId) => {
  const result = await query(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return sanitizeUser(result.rows[0]);
};

/**
 * Generate a signed JWT for a user.
 * @param {Object} user - User record (must have id and email)
 * @returns {string} Signed JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    { sub: user.id, email: user.email },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
};

/**
 * Strip sensitive fields (password hash) from a user record.
 * @param {Object} user - Raw database row
 * @returns {Object} Safe user object for API responses
 */
const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatar_url,
  createdAt: user.created_at,
});
