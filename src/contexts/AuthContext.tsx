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
import { authApi } from '../../services/authService';
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
        const data = await authApi.me();
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
      persistToken(data.token);
      setUser(data.user);
      setIsLoginModalOpen(false);
      toast.success(`Welcome back, ${data.user.name || data.user.email}!`);
    },
    [persistToken]
  );

  /**
   * Register a new account
   */
  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const data = await authApi.register(email, password, name);
      persistToken(data.token);
      setUser(data.user);
      setIsLoginModalOpen(false);
      toast.success('Account created! Welcome aboard.');
    },
    [persistToken]
  );

  /**
   * Log out — clear token and user state
   */
  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
    toast.success('Logged out');
  }, [persistToken]);

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
