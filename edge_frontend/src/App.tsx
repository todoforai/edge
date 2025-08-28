import { useAuthStore } from './store/authStore';
import { useMCPLogEffect } from './store/mcpLogStore';
import { ThemeProvider } from '@emotion/react';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';
import { theme } from './styles/theme';

function App() {
  const { user } = useAuthStore();
  
  // Initialize MCP log store
  useMCPLogEffect();

  return (
    <ThemeProvider theme={theme}>
      {user && user.isAuthenticated ? <Dashboard /> : <LoginForm />}
    </ThemeProvider>
  );
}

export default App;
