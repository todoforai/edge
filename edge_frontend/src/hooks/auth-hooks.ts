import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { getApiBase } from '../config/api-config';
import { getAppVersion } from '../lib/tauri-api';

// Hook for development environment pre-filled credentials
export const useDevAuthEffect = (
  setEmail: (email: string) => void,
  setPassword: (password: string) => void
) => {
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
  }, []);

  return { apiUrl, setApiUrl, appVersion };
};

// Hook to restore user authentication for a specific API URL
export const useAuthRestoreEffect = (apiUrl: string) => {
  const { restoreUserForApiUrl } = useAuthStore();
  
  useEffect(() => {
    if (apiUrl) {
      restoreUserForApiUrl(apiUrl);
    }
  }, [apiUrl, restoreUserForApiUrl]);
};

// Hook to initialize with cached authentication
export const useCachedLoginEffect = () => {
  const { user, initializeWithCachedAuth } = useAuthStore();
  
  useEffect(() => {
    if (user?.apiUrl) {
      initializeWithCachedAuth(user.apiUrl);
    }
  }, [user?.apiUrl]);
};