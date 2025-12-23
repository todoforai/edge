import { create } from 'zustand';
import { createLogger } from '@/utils/logger';
import pythonService from '../services/python-service';

const log = createLogger('auth-store');
let isAuthenticating = false;

// Session constants
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const STORAGE_KEY = `currentUser`;

export interface User {
  apiKey?: string;
  name?: string;
  isAuthenticated: boolean;
  lastLoginTime?: number;
  apiUrl?: string;
}

export interface LoginCredentials {
  apiKey: string;
  apiUrl?: string;
  debug?: boolean;
}

export interface LoginResponse {
  status: string;
  message: string;
}

interface AuthState {
  user: User | null;
  error: string | null;
  isLoading: boolean;
  shouldAutoLogin: boolean;
  deeplinkApiKey: string | null;
  apiUrl: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  initializeWithCachedAuth: (user: User) => Promise<void>;
  isAuthenticated: () => boolean;
  isSessionValid: () => boolean;
  setUser: (user: User) => void;
  setError: (error: string | null) => void;
  getCurrentUser: () => User;
  setShouldAutoLogin: (shouldAutoLogin: boolean) => void;
  setDeeplinkApiKey: (apiKey: string) => void;
  clearDeeplinkApiKey: () => void;
  setApiUrl: (apiUrl: string) => void;
}

// Utility function to restore user from storage
export const restoreUserFromStorage = async (): Promise<User | null> => {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEY);

    if (storedUser) {
      const userData = JSON.parse(storedUser);

      // Check if we have the required auth data (apiKey is required)
      if (userData.apiKey) {
        // Check if the session is still valid (e.g., not expired)
        const sessionAge = Date.now() - (userData.lastLoginTime || 0);

        if (sessionAge < SESSION_MAX_AGE) {
          log.info(`User session restored from storage`);
          return {
            ...userData,
          };
        } else {
          // Session expired
          localStorage.removeItem(STORAGE_KEY);
          log.info(`Stored session expired, removed from storage`);
        }
      } else {
        // Missing required auth data
        localStorage.removeItem(STORAGE_KEY);
        log.info(`Invalid stored user data, removed from storage`);
      }
    }
  } catch (error) {
    log.error(`Failed to restore user from storage:`, error);
  }

  return null;
};

export const useAuthStore = create<AuthState>()((set, get) => {
  return {
    user: null,
    error: null,
    isLoading: false,
    shouldAutoLogin: false,
    deeplinkApiKey: null, // Initialize deeplink API key
    apiUrl: null,

    login: async (credentials) => {
      if (isAuthenticating) {
        log.info('Authentication already in progress, ignoring request');
        return;
      }

      isAuthenticating = true;
      set({ isLoading: true, error: null });

      try {
        // Initialize Python service if not already initialized
        await pythonService.initialize();

        // Call login method on Python service (apiUrl is now hardcoded on Python side)
        const response = await pythonService.login(credentials);
        log.info(`Login request sent: ${response.status} - ${response.message}`);

        // The actual user update will happen via the auth_success event
      } catch (error) {
        log.error('Login failed:', error);
        set({
          error: error instanceof Error ? error.message : 'Login failed',
        });
      } finally {
        isAuthenticating = false;
        set({ isLoading: false });
      }
    },

    logout: () => {
      localStorage.removeItem(STORAGE_KEY);
      log.info(`User data removed from storage`);

      set({ user: { isAuthenticated: false } });
      log.info('User logged out');
    },

    clearError: () => set({ error: null }),

    initializeWithCachedAuth: async (user: User) => {
      try {
        if (user) {
          // If we have a valid session, initialize Python service
          if (user.isAuthenticated && user.apiKey) {
            // Initialize Python service and login with cached API key
            await pythonService.initialize();

            // Login with the cached API key (apiUrl is now hardcoded on Python side)
            await pythonService.login({
              apiKey: user.apiKey,
            });
            set({ user });

            // User will be updated via auth_success event
            log.info('Initialized with cached authentication');
          } else {
            log.info('Invalid cached session (missing apiKey)');
            set({ user: { isAuthenticated: false } });
          }
        } else {
          log.info('No valid cached session found');
          set({ user: { isAuthenticated: false } });
        }
      } catch (error) {
        log.error('Failed to initialize with cached auth:', error);

        // Clear auth on failure
        set({
          user: { isAuthenticated: false },
          error: 'Session expired. Please log in again.',
        });
      }
    },

    isAuthenticated: () => {
      const { user } = get();
      return user?.isAuthenticated || false;
    },

    isSessionValid: () => {
      const { user } = get();
      if (!user?.isAuthenticated || !user.lastLoginTime) {
        return false;
      }

      const sessionAge = Date.now() - user.lastLoginTime;
      return sessionAge < SESSION_MAX_AGE;
    },

    setUser: (user: User) => {
      set({ user });
    },

    setShouldAutoLogin: (shouldAutoLogin: boolean) => {
      set({ shouldAutoLogin });
    },

    setDeeplinkApiKey: (apiKey: string) => {
      set({ deeplinkApiKey: apiKey });
    },

    clearDeeplinkApiKey: () => {
      set({ deeplinkApiKey: null });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    getCurrentUser: () => {
      const { user } = get();
      return user || { isAuthenticated: false };
    },

    setApiUrl: (apiUrl: string) => {
      set({ apiUrl });
    },
  };
});
