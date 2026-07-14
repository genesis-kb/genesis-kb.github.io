/**
 * useAuth Hook
 * Convenience wrapper for accessing AuthContext.
 * Throws if used outside of AuthProvider.
 */

import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import type { AuthContextType } from '@/types/auth';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
