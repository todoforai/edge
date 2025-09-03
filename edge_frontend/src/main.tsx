import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { createLogger } from './utils/logger';
import { desktopApi } from './lib/tauri-api';
import { useAuthStore } from './store/authStore';

const logger = createLogger('deep-link');

// Simple synchronous deeplink processing
const processDeepLinks = async () => {
  try {
    const args = await desktopApi.getCliArgs();
    logger.info('Args:', args);
    const deepLinkArgs = args?.filter(arg => arg.startsWith('todoforaiedge://')) || [];
    
    for (const url of deepLinkArgs) {
      try {
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean);
        const isHostAuth = u.host === 'auth' && segments[0] === 'apikey';
        const isPathAuth = segments[0] === 'auth' && segments[1] === 'apikey';
        
        if (isHostAuth || isPathAuth) {
          const key = isHostAuth ? segments[1] : segments[2];
          if (key) {
            logger.info('Deep link API key detected:', key.substring(0, 8) + '...');
            // Store API key directly in auth store and enable auto-login
            const authStore = useAuthStore.getState();
            authStore.setDeeplinkApiKey(decodeURIComponent(key));
            authStore.setShouldAutoLogin(true);
            logger.info('Auto-login enabled with deeplink API key');
          }
        }
      } catch (err) {
        logger.error('Invalid deep link URL format:', err);
      }
    }
  } catch (error) {
    logger.error('Error processing deep links:', error);
  }
};

// Process deeplinks before rendering
processDeepLinks().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
