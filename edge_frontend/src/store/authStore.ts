import { create } from 'zustand';
import { getApiBase } from '../config/api-config';
import { createLogger } from '../utils/logger';
import pythonService from '../services/python-service';

const log = createLogger('auth-store');
let isAuthenticating = false;

// Session constants
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface User {
  email?: string;
  apiKey?: string;
  name?: string;
  isAuthenticated: boolean;
  lastLoginTime?: number;
  apiUrl?: string;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  apiKey?: string;
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
  apiUrl: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  loginWithCredentials: (email: string, password: string, apiUrl?: string, debug?: boolean) => Promise<void>;
  loginWithApiKey: (apiKey: string, apiUrl?: string, debug?: boolean) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  initializeWithCachedAuth: (user: User) => Promise<void>;
  isAuthenticated: () => boolean;
  isSessionValid: () => boolean;
  setApiUrl: (apiUrl: string) => void;
  setUser: (user: User) => void;
  setError: (error: string | null) => void;
  getCurrentUser: () => User;
}

// Utility function to restore user from storage
export const restoreUserFromStorage = async (apiUrl: string | null): Promise<User | null> => {
  if (!apiUrl) {
    log.info('No API URL provided, cannot restore user');
    return null;
  }

  try {
    const storageKey = `currentUser_${apiUrl}`;
    const storedUser = localStorage.getItem(storageKey);

    if (storedUser) {
      const userData = JSON.parse(storedUser);

      // Check if we have the required auth data
      if (userData.apiKey) {
        // Check if the session is still valid (e.g., not expired)
        const sessionAge = Date.now() - (userData.lastLoginTime || 0);

        if (sessionAge < SESSION_MAX_AGE) {
          // Validate the stored API key with the Python backend
          try {
            // Initialize Python service if needed
            await pythonService.initialize();

            const validationResult = await pythonService.callPython('validate_stored_credentials', {
              apiUrl: apiUrl,
              apiKey: userData.apiKey,
            });

            if (validationResult.valid) {
              log.info(`User session restored from storage for API URL: ${apiUrl}`);
              return {
                ...userData,
                isAuthenticated: true,
              };
            } else {
              log.info(
                `Stored API key is invalid for API URL: ${apiUrl}, removing from storage. Error: ${validationResult.error || 'Unknown'}`
              );
            }
          } catch (error) {
            log.error(`Failed to validate stored API key for API URL: ${apiUrl}:`, error);
          }

          // Remove invalid session
          localStorage.removeItem(storageKey);
        } else {
          // Session expired
          localStorage.removeItem(storageKey);
          log.info(`Stored session expired for API URL: ${apiUrl}, removed from storage`);
        }
      } else {
        // Missing required auth data
        localStorage.removeItem(storageKey);
        log.info(`Invalid stored user data for API URL: ${apiUrl}, removed from storage`);
      }
    }
  } catch (error) {
    log.error(`Failed to restore user from storage for API URL: ${apiUrl}:`, error);
  }

  return null;
};

export const useAuthStore = create<AuthState>()((set, get) => {
  return {
    user: null,
    error: null,
    isLoading: false,
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

        // Get API URL from config if not provided
        if (!credentials.apiUrl) {
          credentials.apiUrl = await getApiBase();
        }

        set({ apiUrl: credentials.apiUrl });

        // Call login method on Python service
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

    loginWithCredentials: async (email, password, apiUrl, debug) => {
      await get().login({ email, password, apiUrl, debug });
    },

    loginWithApiKey: async (apiKey, apiUrl, debug) => {
      await get().login({ apiKey, apiUrl, debug });
    },

    logout: () => {
      const { apiUrl } = get();
      if (apiUrl) {
        localStorage.removeItem(`currentUser_${apiUrl}`);
        log.info(`User data removed from storage for API URL: ${apiUrl}`);
      }

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

            // Login with the cached API key
            await pythonService.login({
              apiKey: user.apiKey,
              apiUrl: get().apiUrl,
            });
            set({ user });

            // User will be updated via auth_success event
            log.info('Initialized with cached authentication');
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

    setApiUrl: (apiUrl: string) => {
      set({ apiUrl });
    },

    setUser: (user: User) => {
      set({ user });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    getCurrentUser: () => {
      const { user } = get();
      return user || { isAuthenticated: false };
    },
  };
});
