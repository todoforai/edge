/** Thin REST client for the TODOforAI API */

export class ApiClient {
  constructor(
    public apiUrl: string,
    public apiKey: string,
  ) {}

  private get headers() {
    return { "content-type": "application/json", "x-api-key": this.apiKey };
  }

  private async request(method: string, endpoint: string, body?: any) {
    const url = `${this.apiUrl}${endpoint}`;
    const opts: RequestInit = { method, headers: this.headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`API ${method} ${endpoint} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }

  async validateApiKey(): Promise<{ valid: boolean; userId?: string; error?: string; connectionError?: boolean }> {
    if (!this.apiKey) return { valid: false, error: "No API key provided" };
    try {
      const res = await fetch(`${this.apiUrl}/api/v1/apikey/validate`, {
        headers: { "x-api-key": this.apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data.valid) return { valid: true, userId: data.userId };
        return { valid: false, error: data.error || "Invalid API key" };
      }
      if (res.status === 401) return { valid: false, error: "Invalid API key" };
      if (res.status === 403) return { valid: false, error: "API key access denied" };
      return { valid: false, error: `Validation failed with status ${res.status}` };
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        return { valid: false, error: "Validation timed out", connectionError: true };
      }
      return { valid: false, error: `Validation failed: ${e.message}`, connectionError: true };
    }
  }

  createProject(name: string, description = "", isPublic = false) {
    return this.request("POST", "/api/v1/projects", { name, description, isPublic });
  }

  listProjects() {
    return this.request("GET", "/api/v1/projects");
  }

  deleteProject(projectId: string) {
    return this.request("DELETE", `/api/v1/projects/${projectId}`);
  }

  createTodo(projectId: string, content: string, agentSettings?: any) {
    return this.request("POST", `/api/v1/projects/${projectId}/todos`, { content, agentSettings });
  }

  listTodos(projectId?: string) {
    const endpoint = projectId ? `/api/v1/projects/${projectId}/todos` : "/api/v1/todos";
    return this.request("GET", endpoint);
  }

  getTodo(todoId: string) {
    return this.request("GET", `/api/v1/todos/${todoId}`);
  }

  updateTodoStatus(todoId: string, status: string) {
    return this.request("PUT", `/api/v1/todos/${todoId}`, { status });
  }

  listAgentSettings() {
    return this.request("GET", "/api/v1/agents");
  }

  getAgentSettings(id: string) {
    return this.request("GET", `/api/v1/agents/${id}`);
  }

  addMessage(projectId: string, content: string, agentSettings: any, todoId?: string, attachments?: any[], scheduledTimestamp?: number) {
    const payload: any = { content, agentSettings, attachments: attachments || [] };
    if (todoId) payload.todoId = todoId;
    if (scheduledTimestamp) payload.scheduledTimestamp = scheduledTimestamp;
    return this.request("POST", `/api/v1/projects/${projectId}/todos`, payload);
  }

  patchEdgeConfig(edgeId: string, updates: Record<string, any>) {
    return this.request("PATCH", `/api/v1/edges/${edgeId}`, { updates });
  }

  createAgent() {
    return this.request("POST", "/api/v1/agents", {});
  }

  updateAgentSettings(agentId: string, agentSettingsId: string, updates: Record<string, any>) {
    return this.request("PUT", `/api/v1/agents/${agentId}/settings`, { agentSettingsId, updates });
  }

  setAgentEdgeMcpConfig(agentId: string, agentSettingsId: string, edgeId: string, mcpName: string, config: Record<string, any>) {
    return this.request("PUT", `/api/v1/agents/${agentId}/edge-mcp-config`, { agentSettingsId, edgeId, mcpName, config });
  }

  listEdges() {
    return this.request("GET", "/api/v1/edges");
  }
}
