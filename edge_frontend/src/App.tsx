import { useAuthStore } from './store/authStore';
import { ThemeProvider } from 'styled-components';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';
import { GlobalStyles } from './styles/GlobalStyles';
import { theme } from './styles/theme';
import './App.css';

function App() {
  const { user } = useAuthStore();

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      {user && user.isAuthenticated ? <Dashboard /> : <LoginForm />}
    </ThemeProvider>
  );
}

export default App;
