import { useAuthStore } from './store/authStore';
import { useMCPLogEffect } from './store/mcpLogStore';
import { ThemeProvider } from 'styled-components';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';
import { GlobalStyles } from './styles/GlobalStyles';
import { theme } from './styles/theme';
import './App.css';

function App() {
  const { user } = useAuthStore();
  
  // Initialize MCP log store
  useMCPLogEffect();

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {user && user.isAuthenticated ? <Dashboard /> : <LoginForm />}
    </ThemeProvider>
  );
}

export default App;
