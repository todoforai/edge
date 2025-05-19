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
  initializeWithCachedAuth: (apiUrl: string) => Promise<void>;
  restoreUserForApiUrl: (apiUrl: string) => void;
  isAuthenticated: () => boolean;
  isSessionValid: () => boolean;
  setApiUrl: (apiUrl: string) => void;
  getCurrentUser: () => User;
}

// Utility functions outside the store
const saveUserToStorage = (user: User): void => {
  try {
    if (user.isAuthenticated && user.apiUrl) {
      // Only store what we need to restore the session
      const storageData = {
        apiKey: user.apiKey,
        email: user.email,
        name: user.name,
        lastLoginTime: user.lastLoginTime,
        apiUrl: user.apiUrl,
      };
      localStorage.setItem(`currentUser_${user.apiUrl}`, JSON.stringify(storageData));
      log.info(`User data saved to storage for API URL: ${user.apiUrl}`);
    } else {
      // If no API URL or not authenticated, we can't save properly
      log.info('User not authenticated or missing API URL, not saving to storage');
    }
  } catch (error) {
    log.error('Failed to save user to storage:', error);
  }
};

const restoreUserFromStorage = (apiUrl: string): User | null => {
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
          log.info(`User session restored from storage for API URL: ${apiUrl}`);
          return {
            ...userData,
            isAuthenticated: true,
          };
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

// Initialize the store with event listeners
const setupAuthEventListeners = (set: any, get: any) => {
  pythonService.addEventListener('auth_success', async (data) => {
    const payload = data.payload;
    const apiUrl = get().apiUrl || (await getApiBase());

    const updatedUser = {
      apiKey: payload.apiKey,
      email: payload.email,
      name: payload.name,
      isAuthenticated: true,
      lastLoginTime: Date.now(),
      apiUrl: apiUrl,
    };

    saveUserToStorage(updatedUser);
    log.info('User authenticated successfully');
    set({ user: updatedUser });
  });

  pythonService.addEventListener('auth_error', (data) => {
    const payload = data.payload;
    const errorMessage = payload.message || 'Authentication failed without message';
    log.error('Authentication error:', errorMessage);
    set({ error: errorMessage });
  });
};

export const useAuthStore = create<AuthState>()((set, get) => {
  // Setup event listeners
  setupAuthEventListeners(set, get);

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

    restoreUserForApiUrl: (apiUrl: string) => {
      if (!apiUrl) return;

      const user = restoreUserFromStorage(apiUrl);
      if (user) {
        set({ user, apiUrl });
        log.info(`Restored user for API URL: ${apiUrl}, authenticated: ${user.isAuthenticated}`);
      } else {
        set({ user: { isAuthenticated: false }, apiUrl });
        log.info(`No valid user found for API URL: ${apiUrl}`);
      }
    },

    initializeWithCachedAuth: async (apiUrl: string) => {
      try {
        // Get the API URL first
        set({ apiUrl });

        // Restore user for this API URL
        const user = restoreUserFromStorage(apiUrl);
        if (user) {
          set({ user });

          // If we have a valid session, initialize Python service
          if (user.isAuthenticated && user.apiKey) {
            // Initialize Python service and login with cached API key
            await pythonService.initialize();

            // Login with the cached API key
            await pythonService.login({
              apiKey: user.apiKey,
              apiUrl,
            });

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
    getCurrentUser: () => {
      const { user } = get();
      return user || { isAuthenticated: false };
    },
  };
});
