import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { createLogger } from './utils/logger';
import { desktopApi } from './lib/tauri-api';

const logger = createLogger('deep-link');

// Simple synchronous deeplink processing
const processDeepLinks = async () => {
  try {
    const args = await desktopApi.getCliArgs();
    logger.info('CLI args received by app:', args);
    
    const deepLinkArgs = args?.filter(arg => arg.startsWith('todoforai://')) || [];
    
    for (const url of deepLinkArgs) {
      try {
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean);
        const isHostAuth = u.host === 'auth' && segments[0] === 'apikey';
        const isPathAuth = segments[0] === 'auth' && segments[1] === 'apikey';
        
        if (isHostAuth || isPathAuth) {
          const key = isHostAuth ? segments[1] : segments[2];
          if (key) {
            logger.info('Setting API key from deep link:', key);
            localStorage.setItem('deeplink_api_key', decodeURIComponent(key));
          }
        }
      } catch (err) {
        logger.error('Invalid deep link URL:', url, err);
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
});
