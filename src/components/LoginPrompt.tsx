/**
 * LoginPrompt
 * Inline placeholder shown to unauthenticated users trying to access
 * protected component-level features (like the Notes panel).
 */

import { LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface LoginPromptProps {
  message?: string;
}

export function LoginPrompt({ message = 'Sign in to access this feature' }: LoginPromptProps) {
  const { openLoginModal } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-border/50 h-full min-h-[300px]">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <LogIn className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-display font-semibold text-lg mb-2">Authentication Required</h3>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        {message}
      </p>
      <button
        onClick={openLoginModal}
        className="px-6 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
      >
        Sign In
      </button>
    </div>
  );
}
