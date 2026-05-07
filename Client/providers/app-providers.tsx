'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/lib/stores/auth-store';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const initialize = useAuthStore((state) => state.initialize);
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    void initialize();
  }, [hydrated, token, initialize]);

  useEffect(() => {
    const onUnhandledRejection = () => {
      toast.error('Something unexpected happened. Please try again.');
    };

    const onGlobalError = () => {
      toast.error('An unexpected UI error occurred.');
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onGlobalError);

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onGlobalError);
    };
  }, []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
