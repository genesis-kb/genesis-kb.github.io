/**
 * ProtectedRoute
 * Wraps routes that require authentication.
 * If the user is not logged in, it prompts them to log in via the AuthContext modal.
 * While loading, it displays a loading spinner.
 */

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = '/' }: ProtectedRouteProps) {
  const { user, isLoading, openLoginModal, isLoginModalOpen } = useAuth();
  const navigate = useNavigate();
  const modalWasOpened = useRef(false);

  useEffect(() => {
    // If we've finished loading and there is no user, trigger the login modal
    if (!isLoading && !user && !isLoginModalOpen && !modalWasOpened.current) {
      modalWasOpened.current = true;
      openLoginModal();
    }
  }, [isLoading, user, openLoginModal, isLoginModalOpen]);

  useEffect(() => {
    // If the modal was opened by this route but then closed without a successful login,
    // redirect them away to avoid being stuck on an empty/unauthorized page.
    if (!isLoading && !user && !isLoginModalOpen && modalWasOpened.current) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoginModalOpen, isLoading, user, navigate, redirectTo]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Don't render protected content; useEffect will redirect/prompt
  }

  return <>{children}</>;
}
