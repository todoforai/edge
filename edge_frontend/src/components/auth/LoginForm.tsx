import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { 
  useApiVersionEffect, 
  useAuthEventListenersEffect
} from '../../hooks/auth-hooks';
import { createLogger } from '../../utils/logger';
import { Eye, EyeOff } from 'lucide-react';
import { cva } from "class-variance-authority";

const log = createLogger('login-form');

const loginContainer = cva([
  "flex justify-center items-center h-screen p-5 w-full box-border"
]);

const loginCard = cva([
  "w-full max-w-[400px] p-8 bg-card rounded-lg shadow-md border border-border"
]);

const loginHeader = cva([
  "mt-0 mb-6 text-center font-bold text-foreground"
]);

const loginForm = cva([
  "flex flex-col gap-5"
]);

const formGroup = cva([
  "flex flex-col gap-2 w-full"
]);

const label = cva([
  "text-sm text-muted-foreground"
]);

const inputContainer = cva([
  "relative"
]);

const input = cva([
  "w-full py-2.5 px-3 bg-card border border-border rounded-md text-foreground text-base transition-colors box-border focus:outline-none focus:border-primary"
]);

const eyeButton = cva([
  "absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-muted-foreground p-1 flex items-center rounded transition-colors hover:bg-accent"
]);

const loginButton = cva([
  "w-full p-3 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 text-white border-none rounded-lg text-base cursor-pointer transition-all hover:-translate-y-px hover:shadow-md disabled:bg-muted-foreground disabled:cursor-not-allowed"
]);

const errorMessage = cva([
  "text-destructive text-sm -my-2.5"
]);

const loginFooter = cva([
  "mt-5 text-center"
]);

const apiUrlContainer = cva([
  "mt-4 text-center"
]);

const apiUrlText = cva([
  "text-xs text-muted-foreground cursor-pointer select-none"
]);

const apiUrlInput = cva([
  "w-full py-1.5 px-2 text-xs bg-card border border-border rounded-md text-foreground text-center"
]);

const versionText = cva([
  "text-xs text-muted-foreground mt-1"
]);

export const LoginForm = () => {
  const { 
    login, 
    isLoading, 
    error, 
    clearError, 
    shouldAutoLogin, 
    setShouldAutoLogin,
    deeplinkApiKey,
    clearDeeplinkApiKey
  } = useAuthStore();
  
  // Determine initial login method based on deeplink API key
  const [apiKey, setApiKey] = useState(deeplinkApiKey || '');
  const [clickCount, setClickCount] = useState(0);
  const [isApiUrlEditable, setIsApiUrlEditable] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Use custom hooks
  const { apiUrl, setApiUrl, appVersion } = useApiVersionEffect();
  useAuthEventListenersEffect();

  // Auto-login effect - triggers from store state
  useEffect(() => {
    if (shouldAutoLogin && apiKey && !isLoading) {
      log.info('Auto-login triggered with API key:', apiKey.substring(0, 8) + '...');
      setShouldAutoLogin(false); // Prevent multiple auto-login attempts
      
      // Small delay to let UI update
      setTimeout(() => {
        handleSubmit(null, true); // Pass true to indicate auto-login
      }, 500);
    }
  }, [shouldAutoLogin, apiKey, isLoading, setShouldAutoLogin]);

  const handleSubmit = (e: React.FormEvent | null, isAuto = false) => {
    if (e) e.preventDefault();
    clearError();

    // Clear deeplink API key when login starts
    if (deeplinkApiKey && (isAuto || apiKey === deeplinkApiKey)) {
      log.info('Clearing deeplink API key as login starts');
      clearDeeplinkApiKey();
    }

    // Send only apiKey credentials
    login({ 
      apiKey, 
      apiUrl: isApiUrlEditable && apiUrl ? apiUrl : undefined 
    });
  };

  const handleApiUrlClick = useCallback(() => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 7) {
      setIsApiUrlEditable(true);
      setClickCount(0);
    }
  }, [clickCount]);

  return (
    <div className={loginContainer()}>
      <div className={loginCard()}>
        <h2 className={loginHeader()}>Connect your PC to TODO for AI</h2>

        <form className={loginForm()} onSubmit={handleSubmit}>
          <div className={formGroup()}>
            <label className={label()} htmlFor="apiKey">API Key</label>
            <div className={inputContainer()}>
              <input
                className={input()}
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key"
                required
              />
              <button
                type="button"
                className={eyeButton()}
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className={errorMessage()}>{error}</div>}

          <button className={loginButton()} type="submit" disabled={isLoading}>
            {isLoading ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        <div className={loginFooter()}>
          <div className={apiUrlContainer()}>
            {isApiUrlEditable ? (
              <input 
                className={apiUrlInput()}
                type="text" 
                value={apiUrl || ''} 
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="API URL"
              />
            ) : (
              // Only show API URL if it's not the default TODOforAI URL
              apiUrl && !apiUrl.includes('todofor.ai') && (
                <div className={apiUrlText()} onClick={handleApiUrlClick}>
                  API: {apiUrl}
                </div>
              )
            )}
            {appVersion && <div className={versionText()}>Version: {appVersion}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
