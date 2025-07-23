export interface MCPServer {
  id: string;
  name: string;
  description: string;
  icon: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  status: 'installed' | 'running' | 'stopped' | 'uninstalled';
  category: string;
}