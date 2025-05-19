import { useEffect, useState } from 'react';
import { useAuthStore, restoreUserFromStorage } from '../store/authStore';
import { getApiBase } from '../config/api-config';
import { getAppVersion } from '../lib/tauri-api';
import pythonService from '../services/python-service';
import { createLogger } from '../utils/logger';

const log = createLogger('auth-hooks');

// Hook for development environment pre-filled credentials
export const useDevAuthEffect = (setEmail: (email: string) => void, setPassword: (password: string) => void) => {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('lfg@todofor.ai');
      setPassword('Test123');
    }
  }, [setEmail, setPassword]);
};

// Hook to fetch API URL and app version
export const useApiVersionEffect = () => {
  const { apiUrl, setApiUrl } = useAuthStore();
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Should run once.
    const fetchApiUrlAndVersion = async () => {
      const url = await getApiBase();
      setApiUrl(url);

      const version = await getAppVersion();
      setAppVersion(version);
    };
    fetchApiUrlAndVersion();
  }, [setApiUrl]);

  return { apiUrl, setApiUrl, appVersion };
};

// Hook to initialize with cached authentication
export const useCachedLoginEffect = () => {
  const { initializeWithCachedAuth, apiUrl } = useAuthStore();

  useEffect(() => {
    const loadedUser = restoreUserFromStorage(apiUrl);

    if (loadedUser?.apiUrl) {
      initializeWithCachedAuth(loadedUser);
    }
  }, [apiUrl]);
};

// Hook to set up auth event listeners
export const useAuthEventListenersEffect = () => {
  const { setUser, setError, apiUrl } = useAuthStore();

  useEffect(() => {
    // Set up auth success listener
    const successUnsubscribe = pythonService.addEventListener('auth_success', async (data) => {
      const payload = data.payload;
      const currentApiUrl = apiUrl || (await getApiBase());

      const updatedUser = {
        apiKey: payload.apiKey,
        email: payload.email,
        name: payload.name,
        isAuthenticated: true,
        lastLoginTime: Date.now(),
        apiUrl: currentApiUrl,
      };

      // Save user to storage
      try {
        if (updatedUser.isAuthenticated && updatedUser.apiUrl) {
          // Only store what we need to restore the session
          const storageData = {
            apiKey: updatedUser.apiKey,
            email: updatedUser.email,
            name: updatedUser.name,
            lastLoginTime: updatedUser.lastLoginTime,
            apiUrl: updatedUser.apiUrl,
          };
          localStorage.setItem(`currentUser_${updatedUser.apiUrl}`, JSON.stringify(storageData));
          log.info(`User data saved to storage for API URL: ${updatedUser.apiUrl}`);
        }
      } catch (error) {
        log.error('Failed to save user to storage:', error);
      }

      log.info('User authenticated successfully');
      setUser(updatedUser);
    });

    // Set up auth error listener
    const errorUnsubscribe = pythonService.addEventListener('auth_error', (data) => {
      const payload = data.payload;
      const errorMessage = payload.message || 'Authentication failed without message';
      log.error('Authentication error:', errorMessage);
      setError(errorMessage);
    });

    // Clean up listeners on unmount
    return () => {
      successUnsubscribe();
      errorUnsubscribe();
    };
  }, [apiUrl, setUser, setError]);
};
