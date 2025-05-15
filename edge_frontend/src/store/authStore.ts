import { create } from 'zustand';
import type { User } from '../services/auth-service';
import authService from '../services/auth-service';
import pythonService from '../services/python-service';
import { getApiBase } from '../config/api-config';

let isAuthenticating = false;

interface AuthState {
  user: User;
  error: string | null;
  isLoading: boolean;

  // Actions
  login: (credentials: { email: string; password: string; apiUrl?: string } | { apiKey: string; apiUrl?: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  initializeWithCachedAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: authService.getCurrentUser(),
  error: null,
  isLoading: false,

  login: async (credentials) => {
    if (isAuthenticating) {
      return;
    }
    isAuthenticating = true;
    set({ isLoading: true });

    try {
      if ('email' in credentials) {
        await authService.loginWithCredentials(credentials.email, credentials.password, credentials.apiUrl);
      } else {
        await authService.loginWithApiKey(credentials.apiKey, credentials.apiUrl);
      }

      // The actual user update will happen via the auth_success event
      // We're just clearing any previous errors here
      set({ error: null });
    } catch (error) {
      set({ error: (error as Error).message });
    } finally {
      isAuthenticating = false;
      set({ isLoading: false });
    }
  },

  logout: () => {
    authService.logout();
    set({ user: { isAuthenticated: false } });
  },

  clearError: () => set({ error: null }),

  initializeWithCachedAuth: async () => {
    // Check if the session is still valid
    if (authService.isSessionValid()) {
      try {
        // Initialize Python service and login with cached API key
        await pythonService.initialize();
        const user = authService.getCurrentUser();
        if (user.apiKey) {
          const apiUrl = await getApiBase();
          await authService.loginWithApiKey(user.apiKey, apiUrl);
          set({ user });
        }
      } catch (error) {
        console.error('Failed to initialize with cached auth:', error);

        // Clear auth on failure
        set({
          user: { isAuthenticated: false },
          error: 'Session expired. Please log in again.',
        });
      }
    } else {
      // Session is invalid or expired
      set({ user: { isAuthenticated: false } });
    }
  },
}));
