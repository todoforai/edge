import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';

import { ThemeProvider } from 'styled-components';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';
import { GlobalStyles } from './styles/GlobalStyles';
import { theme } from './styles/theme';
import './App.css';

function App() {
  const { user, initializeWithCachedAuth } = useAuthStore();

  // Initialize Python service with cached credentials on app start
  useEffect(() => {
    if (user.isAuthenticated) {
      initializeWithCachedAuth();
    }
  }, [user.isAuthenticated, initializeWithCachedAuth]);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {user.isAuthenticated ? <Dashboard user={user} /> : <LoginForm />}
    </ThemeProvider>
  );
}

export default App;
