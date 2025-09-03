import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { listen } from '@tauri-apps/api/event';
import { createLogger } from './utils/logger';

const logger = createLogger('deep-link');

listen<string[]>('deep-link://url', (e) => {
  const urls = e.payload;
  logger.info('Deep link received:', urls);
  
  // Handle array of URLs
  for (const url of urls) {
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
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
