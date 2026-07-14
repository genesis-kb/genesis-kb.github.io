/**
 * Auth API Service
 * Handles all HTTP calls to the auth endpoints.
 */

import api from './api';
import type { AuthResponse, User } from '@/types/auth';

export const authApi = {
  /**
   * Register a new user account.
   */
  register: (email: string, password: string, name?: string) =>
    api.post<AuthResponse>('/api/v1/auth/register', { email, password, name }),

  /**
   * Log in with email and password.
   */
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/v1/auth/login', { email, password }),

  /**
   * Get the current user's profile (requires valid JWT).
   */
  me: () =>
    api.get<{ user: User }>('/api/v1/auth/me'),
};

export default authApi;
