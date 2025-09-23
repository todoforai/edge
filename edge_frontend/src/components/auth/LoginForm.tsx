import { useState, useCallback, useEffect } from 'react';
import { styled } from '../../../styled-system/jsx';
import { useAuthStore } from '../../store/authStore';
import { 
  useApiVersionEffect, 
  useAuthEventListenersEffect
} from '../../hooks/auth-hooks';
import { createLogger } from '../../utils/logger';

const log = createLogger('login-form');

const LoginContainer = styled('div', {
  base: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    padding: '20px',
    width: '100%',
    boxSizing: 'border-box',
  },
});

const LoginCard = styled('div', {
  base: {
    width: '100%',
    maxWidth: '400px',
    padding: '30px',
    backgroundColor: 'token(colors.cardBackground)',
    borderRadius: 'token(radii.lg)',
    boxShadow: 'token(shadows.md)',
    border: '1px solid token(colors.borderColor)',
  },
});

const LoginHeader = styled('h2', {
  base: {
    marginTop: '0',
    marginBottom: '24px',
    textAlign: 'center',
    color: 'token(colors.foreground)',
  },
});

const LoginFormRoot = styled('form', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
});

const FormGroup = styled('div', {
  base: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },
});

const Label = styled('label', {
  base: {
    fontSize: '14px',
    color: 'token(colors.muted)',
  },
});

const Input = styled('input', {
  base: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'token(colors.cardBackground)',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    color: 'token(colors.foreground)',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',

    '&:focus': {
      borderColor: 'token(colors.primary)',
    },
  },
});

const PasswordContainer = styled('div', {
  base: {
    position: 'relative',
  },
});

const ToggleButton = styled('button', {
  base: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'token(colors.muted)',
    cursor: 'pointer',
    fontSize: '14px',
    textShadow: 'none',
    padding: '0',
  },
});

const LoginButton = styled('button', {
  base: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(45deg, #ffa500, #ff6347, #ff4500)',
    color: 'white',
    border: 'none',
    borderRadius: 'token(radii.lg)',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.2)',

    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: 'token(shadows.md)',
    },

    '&:disabled': {
      background: 'token(colors.muted)',
      cursor: 'not-allowed',
    },
  },
});

const ErrorMessage = styled('div', {
  base: {
    color: 'token(colors.danger)',
    fontSize: '14px',
  },
});

const LoginFooter = styled('div', {
  base: {
    marginTop: '20px',
    textAlign: 'center',
  },
});

const ApiUrlContainer = styled('div', {
  base: {
    marginTop: '15px',
    textAlign: 'center',
  },
});

const ApiUrlText = styled('div', {
  base: {
    fontSize: '12px',
    color: 'token(colors.muted)',
    cursor: 'pointer',
    userSelect: 'none',
  },
});

const ApiUrlInput = styled('input', {
  base: {
    width: '100%',
    padding: '6px 8px',
    fontSize: '12px',
    backgroundColor: 'token(colors.cardBackground)',
    border: '1px solid token(colors.borderColor)',
    borderRadius: 'token(radii.md)',
    color: 'token(colors.foreground)',
    textAlign: 'center',
  },
});

const VersionText = styled('div', {
  base: {
    fontSize: '12px',
    color: 'token(colors.muted)',
    marginTop: '5px',
  },
});

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
    <LoginContainer>
      <LoginCard>
        <LoginHeader>Connect your PC to TODOforAI</LoginHeader>

        <LoginFormRoot onSubmit={handleSubmit}>
          <FormGroup>
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              required
            />
          </FormGroup>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <LoginButton type="submit" disabled={isLoading}>
            {isLoading ? 'Connecting...' : 'Connect'}
          </LoginButton>
        </LoginFormRoot>

        <LoginFooter>
          <ApiUrlContainer>
            {isApiUrlEditable ? (
              <ApiUrlInput 
                type="text" 
                value={apiUrl || ''} 
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="API URL"
              />
            ) : (
              // Only show API URL if it's not the default TODOforAI URL
              apiUrl && !apiUrl.includes('todofor.ai') && (
                <ApiUrlText onClick={handleApiUrlClick}>
                  API: {apiUrl}
                </ApiUrlText>
              )
            )}
            {appVersion && <VersionText>Version: {appVersion}</VersionText>}
          </ApiUrlContainer>
        </LoginFooter>
      </LoginCard>
    </LoginContainer>
  );
};
