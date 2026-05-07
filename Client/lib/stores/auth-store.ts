'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { meRequest, loginRequest, signupRequest } from '@/lib/api/auth';
import { clearAuthCookie, setAuthCookie } from '@/lib/auth/token-cookie';
import { AUTH_STORAGE_KEY } from '@/lib/constants/auth';
import type { AuthSession, AuthUser, LoginInput, SignupInput } from '@/lib/types/auth';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  isLoading: boolean;
  setHydrated: (value: boolean) => void;
  initialize: () => Promise<void>;
  setSession: (input: AuthSession) => void;
  clearSession: () => void;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  fetchUser: () => Promise<AuthUser | null>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hydrated: false,
      isLoading: false,
      setHydrated: (value) => set({ hydrated: value }),
      initialize: async () => {
        const sessionToken = get().token;
        if (!sessionToken) {
          return;
        }

        setAuthCookie(sessionToken);
        if (get().user) {
          return;
        }

        try {
          set({ isLoading: true });
          await get().fetchUser();
        } catch {
          get().clearSession();
        } finally {
          set({ isLoading: false });
        }
      },
      setSession: ({ token, user }) => {
        set({ token, user });
        setAuthCookie(token);
      },
      clearSession: () => {
        clearAuthCookie();
        set({ token: null, user: null });
      },
      login: async (input) => {
        set({ isLoading: true });
        try {
          const session = await loginRequest(input);
          get().setSession(session);
        } finally {
          set({ isLoading: false });
        }
      },
      signup: async (input) => {
        set({ isLoading: true });
        try {
          const session = await signupRequest(input);
          get().setSession(session);
        } finally {
          set({ isLoading: false });
        }
      },
      fetchUser: async () => {
        if (!get().token) {
          return null;
        }

        const user = await meRequest();
        set({ user });
        return user;
      },
      logout: () => {
        get().clearSession();
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export const getAuthAccessToken = (): string | null => useAuthStore.getState().token;
export const getAuthWorkspaceId = (): string | undefined => useAuthStore.getState().user?.workspaceId;
export const clearAuthSession = (): void => useAuthStore.getState().clearSession();
