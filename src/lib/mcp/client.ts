import { spawn, ChildProcess } from 'child_process';
import configManager from '@/lib/config';
import { validateUrlForSSRF } from '@/lib/security/ssrf';
import {
  MCPServerConfig,
  MCPTool,
  MCPCallToolResult,
  MCPServerStatus,
} from './types';
import { recordMcpLog } from './logger';

interface StdioSession {
  process: ChildProcess;
  nextId: number;
  pendingRequests: Map<
    number,
    {
      resolve: (data: any) => void;
      reject: (err: any) => void;
      timeout: NodeJS.Timeout;
    }
  >;
  buffer: string;
}

class MCPClientManager {
  private static instance: MCPClientManager;
  private stdioSessions: Map<string, StdioSession> = new Map();

  private constructor() {}

  static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager();
    }
    return MCPClientManager.instance;
  }

  /**
   * Fetch all configured MCP servers from persistent configuration
   */
  getServers(): MCPServerConfig[] {
    const raw = configManager.getConfig('mcpServers', '[]');
    if (Array.isArray(raw)) return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Save MCP servers list to persistent configuration
   */
  async saveServers(servers: MCPServerConfig[]): Promise<void> {
    await configManager.updateConfig('mcpServers', JSON.stringify(servers));
  }

  /**
   * Get or spawn a stdio subprocess connection for a server
   */
  private getOrCreateStdioSession(server: MCPServerConfig): StdioSession {
    const existing = this.stdioSessions.get(server.id);
    if (existing && !existing.process.killed && existing.process.exitCode === null) {
      return existing;
    }

    if (!server.command) {
      throw new Error(`Command missing for stdio server ${server.name}`);
    }

    const cleanEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      ...server.env,
    };

    const child = spawn(server.command, server.args || [], {
      env: cleanEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const session: StdioSession = {
      process: child,
      nextId: 1,
      pendingRequests: new Map(),
      buffer: '',
    };

    child.stdout?.on('data', (chunk: Buffer) => {
      session.buffer += chunk.toString('utf-8');
      const lines = session.buffer.split('\n');
      session.buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.id && session.pendingRequests.has(parsed.id)) {
            const req = session.pendingRequests.get(parsed.id)!;
            clearTimeout(req.timeout);
            session.pendingRequests.delete(parsed.id);
            if (parsed.error) {
              req.reject(new Error(parsed.error.message || 'MCP Error'));
            } else {
              req.resolve(parsed.result);
            }
          }
        } catch {
          // Ignore non-json stdout lines
        }
      }
    });

    child.on('error', (err) => {
      console.warn(`[MCPClient] Subprocess error on ${server.name}:`, err);
      this.stdioSessions.delete(server.id);
    });

    child.on('exit', () => {
      this.stdioSessions.delete(server.id);
    });

    this.stdioSessions.set(server.id, session);
    return session;
  }

  /**
   * Send a JSON-RPC request over stdio
   */
  private async sendStdioRequest(
    server: MCPServerConfig,
    method: string,
    params: any = {},
    timeoutMs: number = 10000,
  ): Promise<any> {
    const session = this.getOrCreateStdioSession(server);
    const id = session.nextId++;

    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }) + '\n';

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (session.pendingRequests.has(id)) {
          session.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      session.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        session.process.stdin?.write(payload);
      } catch (err) {
        clearTimeout(timeout);
        session.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * Send a JSON-RPC request over SSE / HTTP
   */
  private async sendSSERequest(
    server: MCPServerConfig,
    method: string,
    params: any = {},
    timeoutMs: number = 10000,
  ): Promise<any> {
    if (!server.url) {
      throw new Error(`Endpoint URL missing for SSE server ${server.name}`);
    }

    const ssrfCheck = await validateUrlForSSRF(server.url);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF check failed: ${ssrfCheck.reason}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...server.env,
    };

    const res = await fetch(server.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to communicate with MCP server`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || 'MCP Error');
    }

    return data.result;
  }

  /**
   * List all tools exposed by a specific MCP server
   */
  async listServerTools(server: MCPServerConfig): Promise<MCPTool[]> {
    if (!server.enabled) return [];

    try {
      let result: any;
      if (server.transport === 'stdio') {
        // Send initialize first if needed
        try {
          await this.sendStdioRequest(server, 'initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vane-community', version: '1.0.1' },
          }, 4000);
        } catch {
          // May already be initialized
        }
        result = await this.sendStdioRequest(server, 'tools/list', {}, 6000);
      } else {
        result = await this.sendSSERequest(server, 'tools/list', {}, 6000);
      }

      const tools: MCPTool[] = (result?.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || { type: 'object' },
        serverId: server.id,
        serverName: server.name,
      }));

      return tools;
    } catch (err: any) {
      console.warn(`[MCPClient] Failed to list tools for ${server.name}:`, err?.message);
      return [];
    }
  }

  /**
   * List tools across all enabled MCP servers
   */
  async listAllTools(): Promise<MCPTool[]> {
    const servers = this.getServers().filter((s) => s.enabled);
    const results = await Promise.all(servers.map((s) => this.listServerTools(s)));
    return results.flat();
  }

  /**
   * Execute an MCP tool on target server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPCallToolResult> {
    const servers = this.getServers();
    const server = servers.find((s) => s.id === serverId);

    if (!server) {
      return {
        isError: true,
        content: [{ type: 'text', text: `MCP server ${serverId} not found.` }],
      };
    }

    if (!server.enabled) {
      return {
        isError: true,
        content: [{ type: 'text', text: `MCP server ${server.name} is currently disabled.` }],
      };
    }

    const startTime = performance.now();

    try {
      let result: any;
      if (server.transport === 'stdio') {
        result = await this.sendStdioRequest(
          server,
          'tools/call',
          { name: toolName, arguments: args },
          30000,
        );
      } else {
        result = await this.sendSSERequest(
          server,
          'tools/call',
          { name: toolName, arguments: args },
          30000,
        );
      }

      const durationMs = Math.round(performance.now() - startTime);
      const isError = Boolean(result?.isError);
      const summaryText = result?.content?.[0]?.text;

      recordMcpLog({
        direction: 'outbound',
        serverName: server.name,
        method: 'tools/call',
        toolName,
        callerUser: 'search-agent',
        inputPayload: args,
        outputSummary: summaryText ? (summaryText.length > 200 ? summaryText.substring(0, 200) + '...' : summaryText) : 'Success',
        status: isError ? 'error' : 'success',
        errorMessage: isError ? (summaryText || 'Tool returned error') : undefined,
        durationMs,
      }).catch(() => {});

      return {
        content: result?.content || [
          { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) },
        ],
        isError,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      const errorMsg = err?.message || String(err);

      recordMcpLog({
        direction: 'outbound',
        serverName: server.name,
        method: 'tools/call',
        toolName,
        callerUser: 'search-agent',
        inputPayload: args,
        status: 'error',
        errorMessage: errorMsg,
        durationMs,
      }).catch(() => {});

      return {
        isError: true,
        content: [{ type: 'text', text: `Tool execution failed: ${errorMsg}` }],
      };
    }
  }

  /**
   * Health check for a server
   */
  async checkServerStatus(server: MCPServerConfig): Promise<MCPServerStatus> {
    try {
      const tools = await this.listServerTools(server);
      return {
        serverId: server.id,
        status: 'connected',
        toolsCount: tools.length,
      };
    } catch (err: any) {
      return {
        serverId: server.id,
        status: 'error',
        error: err?.message || 'Connection failed',
        toolsCount: 0,
      };
    }
  }
}

export const mcpClientManager = MCPClientManager.getInstance();
export default mcpClientManager;

