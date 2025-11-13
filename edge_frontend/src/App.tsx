import { useAuthStore } from './store/authStore';
import { useMCPLogEffect } from './store/mcpLogStore';
import { LoginForm } from './components/auth/LoginForm';
import { Dashboard } from './components/dashboard/Dashboard';
import { useEdgeConfigInitEffect } from './store/edgeConfigStore';

function App() {
  const { user } = useAuthStore();

  // Initialize MCP log store
  useMCPLogEffect();
  useEdgeConfigInitEffect();

  return <>{user && user.isAuthenticated ? <Dashboard /> : <LoginForm />}</>;
}

export default App;
