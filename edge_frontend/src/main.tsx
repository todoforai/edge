import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './styles/globals.css'
import { listen } from '@tauri-apps/api/event';
import { useAuthStore } from './store/authStore';

listen<string>('deep-link://url', (e) => {
  const url = e.payload;
  try {
    const u = new URL(url);
    // Expect: todoforai://auth/apikey/<KEY>
    const host = u.host || u.hostname;
    const segments = u.pathname.split('/').filter(Boolean);
    // Handle both shapes:
    // - todoforai://auth/apikey/<KEY>  -> host=auth, path=/apikey/<KEY>
    // - todoforai://auth/apikey/<KEY> (some OS may deliver as path starting with 'auth')
    const isHostAuth = host === 'auth' && segments[0] === 'apikey';
    const isPathAuth = segments[0] === 'auth' && segments[1] === 'apikey';
    if (isHostAuth || isPathAuth) {
      const key = isHostAuth ? segments[1] : segments[2];
      if (key) {
        const apiKey = decodeURIComponent(key);
        console.log('Received API key via deep link:', key);
        // Trigger login with API key
        useAuthStore.getState().loginWithApiKey(apiKey).catch((err) => {
          console.error('Deep link API key login failed:', err);
        });
      }
    }
  } catch (err) {
    console.error('Invalid deep link URL:', url, err);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
