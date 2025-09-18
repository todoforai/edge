import { useAuthStore } from './store/authStore';
import { useMCPLogEffect } from './store/mcpLogStore';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';

function App() {
  const { user } = useAuthStore();
  
  // Initialize MCP log store
  useMCPLogEffect();

  return (
    <>
      {user && user.isAuthenticated ? <Dashboard /> : <LoginForm />}
    </>
  );
}

export default App;
