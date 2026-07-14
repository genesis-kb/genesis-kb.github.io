/**
 * Auth Routes
 * Handles user registration, login, and profile endpoints.
 *
 * POST /register  — Create a new account (open registration)
 * POST /login     — Authenticate and receive JWT
 * GET  /me        — Get current user profile (requires auth)
 */

import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, validationRules } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply strict rate limiting to auth routes
router.use(authLimiter);

// Public routes
router.post('/register', validationRules.register, validate, authController.register);
router.post('/login', validationRules.login, validate, authController.login);

// Protected routes
router.get('/me', requireAuth, authController.me);

export default router;
