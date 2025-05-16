import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useAuthStore } from '../../store/authStore';
import { getApiBase } from '../../config/api-config';
import { getAppVersion } from '../../lib/tauri-api';

export const LoginForm = () => {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [loginMethod, setLoginMethod] = useState<'credentials' | 'apiKey'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [isApiUrlEditable, setIsApiUrlEditable] = useState(false);

  // Pre-fill credentials in development mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      setEmail('lfg@todofor.ai');
      setPassword('Test123');
    }
  }, []);

  // Fetch and set the current API URL and app version
  useEffect(() => {
    const fetchApiUrlAndVersion = async () => {
      const url = await getApiBase();
      setApiUrl(url);
      
      const version = await getAppVersion();
      setAppVersion(version);
    };
    fetchApiUrlAndVersion();
  }, []);

  const handleApiUrlClick = useCallback(() => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 7) {
      setIsApiUrlEditable(true);
      setClickCount(0);
    }
  }, [clickCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (loginMethod === 'credentials') {
      login({ email, password, apiUrl: isApiUrlEditable ? apiUrl : undefined });
    } else {
      login({ apiKey, apiUrl: isApiUrlEditable ? apiUrl : undefined });
    }
  };

  return (
    <LoginContainer>
      <LoginCard>
        <LoginHeader>Connect your PC to TodoForAI</LoginHeader>

        <TabContainer>
          <TabButton $active={loginMethod === 'credentials'} onClick={() => setLoginMethod('credentials')} type="button">
            Email & Password
          </TabButton>
          <TabButton $active={loginMethod === 'apiKey'} onClick={() => setLoginMethod('apiKey')} type="button">
            API Key
          </TabButton>
        </TabContainer>

        <LoginFormRoot onSubmit={handleSubmit}>
          {loginMethod === 'credentials' ? (
            <>
              <FormGroup>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </FormGroup>

              <FormGroup>
                <Label htmlFor="password">Password</Label>
                <PasswordContainer>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <ToggleButton type="button" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </ToggleButton>
                </PasswordContainer>
              </FormGroup>
            </>
          ) : (
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
          )}

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <LoginButton type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </LoginButton>
        </LoginFormRoot>

        <LoginFooter>
          <SwitchButton type="button" onClick={() => setLoginMethod(loginMethod === 'credentials' ? 'apiKey' : 'credentials')}>
            {loginMethod === 'credentials' ? 'Login with API Key instead' : 'Login with Email & Password instead'}
          </SwitchButton>
          
          <ApiUrlContainer>
            {isApiUrlEditable ? (
              <ApiUrlInput 
                type="text" 
                value={apiUrl} 
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="API URL"
              />
            ) : (
              <ApiUrlText onClick={handleApiUrlClick}>
                API: {apiUrl}
              </ApiUrlText>
            )}
            {appVersion && <VersionText>Version: {appVersion}</VersionText>}
          </ApiUrlContainer>
        </LoginFooter>
      </LoginCard>
    </LoginContainer>
  );
};

// Styled Components
const LoginContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  padding: 20px;
  background-color: ${(props) => props.theme.colors.background};
  width: 100%;
  box-sizing: border-box;
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 400px;
  padding: 30px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border-radius: ${(props) => props.theme.radius.lg};
  box-shadow: ${(props) => props.theme.shadows.md};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
`;

const LoginHeader = styled.h2`
  margin-top: 0;
  margin-bottom: 24px;
  text-align: center;
  color: ${(props) => props.theme.colors.foreground};
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid ${(props) => props.theme.colors.borderColor};
`;

// Alternative approach - change the styled component definition
const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 10px 0;
  background: none;
  border: none;
  border-radius: 0;
  cursor: pointer;
  font-size: 14px;
  font-weight: ${(props) => (props.$active ? '600' : 'normal')};
  color: ${(props) => (props.$active ? props.theme.colors.primary : props.theme.colors.muted)};
  border-bottom: 2px solid ${(props) => (props.$active ? props.theme.colors.primary : 'transparent')};
  transition: all 0.2s;
  background: transparent;
  text-shadow: none;
  margin: 0 10px;
  position: relative;

  &:hover {
    color: ${(props) => props.theme.colors.primary};
  }
`;
const LoginFormRoot = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%; /* Ensure the form group takes full width */
`;

const Label = styled.label`
  font-size: 14px;
  color: ${(props) => props.theme.colors.muted};
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 12px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: ${(props) => props.theme.radius.md};
  color: ${(props) => props.theme.colors.foreground};
  font-size: 16px;
  transition: border-color 0.2s;
  box-sizing: border-box; /* Add this to fix the sizing issue */

  &:focus {
    border-color: ${(props) => props.theme.colors.primary};
  }
`;

const PasswordContainer = styled.div`
  position: relative;
`;

const ToggleButton = styled.button`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: ${(props) => props.theme.colors.muted};
  cursor: pointer;
  font-size: 14px;
  background: transparent;
  text-shadow: none;
  padding: 0;
`;

const LoginButton = styled.button`
  width: 100%;
  padding: 12px;
  background: linear-gradient(45deg, #ffa500, #ff6347, #ff4500);
  color: white;
  border: none;
  border-radius: ${(props) => props.theme.radius.lg};
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${(props) => props.theme.shadows.md};
  }

  &:disabled {
    background: ${(props) => props.theme.colors.muted};
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  color: ${(props) => props.theme.colors.danger};
  font-size: 14px;
`;

const LoginFooter = styled.div`
  margin-top: 20px;
  text-align: center;
`;

const SwitchButton = styled.button`
  background: none;
  border: none;
  color: ${(props) => props.theme.colors.primary};
  cursor: pointer;
  font-size: 14px;
  background: transparent;
  text-shadow: none;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
`;

const ApiUrlContainer = styled.div`
  margin-top: 15px;
  text-align: center;
`;

const ApiUrlText = styled.div`
  font-size: 12px;
  color: ${(props) => props.theme.colors.muted};
  cursor: pointer;
  user-select: none;
`;

const ApiUrlInput = styled.input`
  width: 100%;
  padding: 6px 8px;
  font-size: 12px;
  background-color: ${(props) => props.theme.colors.cardBackground};
  border: 1px solid ${(props) => props.theme.colors.borderColor};
  border-radius: ${(props) => props.theme.radius.md};
  color: ${(props) => props.theme.colors.foreground};
  text-align: center;
`;

const VersionText = styled.div`
  font-size: 12px;
  color: ${(props) => props.theme.colors.muted};
  margin-top: 5px;
`;
