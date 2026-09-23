/**
 * Auth Context
 * Provides authentication state and methods to the entire app.
 *
 * Responsibilities:
 * - Stores user and token in React state
 * - Persists token to localStorage (key: btc-auth-token)
 * - On mount: validates stored token via GET /auth/me
 * - Provides login(), register(), logout()
 * - Controls the login modal open/close state
 * - Drops cached user-scoped queries whenever the signed-in user changes
 */

import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../services/authService';
import { removeUserScopedQueries } from '@/lib/queryKeys';
import type { User, AuthContextType } from '@/types/auth';

const AUTH_TOKEN_KEY = 'btc-auth-token';

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const queryClient = useQueryClient();

  /**
   * Persist or clear the token in localStorage
   */
  const persistToken = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    setToken(newToken);
  }, []);

  /**
   * On mount — if we have a stored token, validate it by calling /auth/me.
   * If the token is expired or invalid, clear it silently.
   */
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // Temporarily inject the token header for this request
        const data = await authApi.me(token);
        setUser(data.user);
      } catch {
        // Token is invalid or expired — clear silently
        persistToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  /**
   * Log in with email and password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      // A session can end without logout() (e.g. a 401 clears the token), so
      // clear the previous user's cached data on every sign-in too.
      removeUserScopedQueries(queryClient);
      persistToken(data.token);
      setUser(data.user);
      setIsLoginModalOpen(false);
      toast.success(`Welcome back, ${data.user.name || data.user.email}!`);
    },
    [persistToken, queryClient]
  );

  /**
   * Register a new account
   */
  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const data = await authApi.register(email, password, name);
      removeUserScopedQueries(queryClient);
      persistToken(data.token);
      setUser(data.user);
      setIsLoginModalOpen(false);
      toast.success('Account created! Welcome aboard.');
    },
    [persistToken, queryClient]
  );

  /**
   * Log out — clear token and user state
   */
  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
    removeUserScopedQueries(queryClient);
    toast.success('Logged out');
  }, [persistToken, queryClient]);

  const openLoginModal = useCallback(() => setIsLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setIsLoginModalOpen(false), []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      isLoading,
      login,
      register,
      logout,
      openLoginModal,
      closeLoginModal,
      isLoginModalOpen,
    }),
    [user, token, isLoading, login, register, logout, openLoginModal, closeLoginModal, isLoginModalOpen]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
