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

const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', requireAuth, authController.me);

export default router;
