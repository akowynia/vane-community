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
  isInitialized?: boolean;
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
   * Ensure stdio server subprocess has completed protocol initialization
   */
  private async ensureStdioInitialized(
    server: MCPServerConfig,
    session: StdioSession,
  ): Promise<void> {
    if (session.isInitialized) return;
    try {
      const id = session.nextId++;
      const payload =
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'vane-community', version: '1.0.1' },
          },
        }) + '\n';

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          session.pendingRequests.delete(id);
          session.isInitialized = true;
          resolve();
        }, 15000);

        session.pendingRequests.set(id, {
          resolve: () => {
            clearTimeout(timeout);
            session.isInitialized = true;
            try {
              session.process.stdin?.write(
                JSON.stringify({
                  jsonrpc: '2.0',
                  method: 'notifications/initialized',
                  params: {},
                }) + '\n',
              );
            } catch {}
            resolve();
          },
          reject: () => {
            clearTimeout(timeout);
            session.isInitialized = true;
            resolve();
          },
          timeout,
        });

        try {
          session.process.stdin?.write(payload);
        } catch {
          clearTimeout(timeout);
          session.pendingRequests.delete(id);
          session.isInitialized = true;
          resolve();
        }
      });
    } catch {
      session.isInitialized = true;
    }
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
    if (method !== 'initialize') {
      await this.ensureStdioInitialized(server, session);
    }
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

    // Build list of candidate URLs (e.g. Docker container hostnames if localhost is specified)
    const urlsToTry = [server.url];
    if (server.url.includes('localhost:11235') || server.url.includes('127.0.0.1:11235')) {
      urlsToTry.push(
        server.url.replace(/localhost:11235|127\.0\.0\.1:11235/, 'crawl4ai:11235'),
        server.url.replace(/localhost:11235|127\.0\.0\.1:11235/, 'host.docker.internal:11235'),
      );
    }

    let lastError: any;

    for (const targetUrl of urlsToTry) {
      const ssrfCheck = await validateUrlForSSRF(targetUrl, { allowLocal: true });
      if (!ssrfCheck.valid) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...server.env,
      };

      try {
        const res = await fetch(targetUrl, {
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
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
      }
    }

    throw lastError || new Error(`Failed to communicate with ${server.name} on ${server.url}`);
  }

  /**
   * Check if the given server config represents a Crawl4AI REST/Docker service
   */
  private isCrawl4Ai(server: MCPServerConfig): boolean {
    const name = (server.name || '').toLowerCase();
    const url = (server.url || '').toLowerCase();
    return server.transport !== 'stdio' && (name.includes('crawl4ai') || url.includes(':11235'));
  }

  /**
   * Generate candidate base URLs for Crawl4AI REST container (handling Docker networking)
   */
  private getCrawl4AiCandidateUrls(server: MCPServerConfig): string[] {
    let raw = (server.url || 'http://localhost:11235').trim();
    // Normalize: remove trailing slash and /mcp if present
    raw = raw.replace(/\/mcp\/?$/, '').replace(/\/+$/, '');
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `http://${raw}`;
    }

    const candidates = [raw];
    if (raw.includes('localhost:11235') || raw.includes('127.0.0.1:11235')) {
      candidates.push(
        raw.replace(/localhost:11235|127\.0\.0\.1:11235/, 'host.docker.internal:11235'),
        raw.replace(/localhost:11235|127\.0\.0\.1:11235/, 'crawl4ai:11235'),
      );
    }
    return Array.from(new Set(candidates));
  }

  /**
   * Health check for Crawl4AI container
   */
  private async checkCrawl4AiStatus(server: MCPServerConfig): Promise<MCPServerStatus> {
    const candidateUrls = this.getCrawl4AiCandidateUrls(server);
    let lastError: any;

    for (const baseUrl of candidateUrls) {
      const targetUrl = `${baseUrl}/health`;
      const ssrfCheck = await validateUrlForSSRF(targetUrl, { allowLocal: true });
      if (!ssrfCheck.valid) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      try {
        const res = await fetch(targetUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          return {
            serverId: server.id,
            status: 'connected',
            toolsCount: 1,
          };
        }
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
      }
    }

    const isConnRefused =
      lastError?.code === 'ECONNREFUSED' ||
      lastError?.message?.includes('fetch failed') ||
      lastError?.message?.includes('ECONNREFUSED');

    const errorMsg = isConnRefused
      ? 'Crawl4AI offline (run: docker compose up -d crawl4ai)'
      : (lastError?.message || 'Crawl4AI unreachable');

    return {
      serverId: server.id,
      status: 'error',
      error: errorMsg,
      toolsCount: 0,
    };
  }

  /**
   * Invoke crawl_direct on Crawl4AI container
   */
  private async callCrawl4AiTool(
    server: MCPServerConfig,
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPCallToolResult> {
    const candidateUrls = this.getCrawl4AiCandidateUrls(server);
    const targetUrlInput = args.url || args.urls;
    if (!targetUrlInput) {
      return {
        content: [{ type: 'text', text: 'Missing required argument: url' }],
        isError: true,
      };
    }

    const token =
      server.env?.CRAWL4AI_API_TOKEN ||
      server.env?.API_TOKEN ||
      process.env.CRAWL4AI_API_TOKEN ||
      'test_api_code';

    let lastError: any;

    for (const baseUrl of candidateUrls) {
      const crawlUrl = `${baseUrl}/crawl_direct`;
      const ssrfCheck = await validateUrlForSSRF(crawlUrl, { allowLocal: true });
      if (!ssrfCheck.valid) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      try {
        const res = await fetch(crawlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            urls: targetUrlInput,
            word_count_threshold: 10,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`Crawl4AI returned HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const resultData =
          data?.result ||
          (Array.isArray(data?.results) ? data.results[0] : null);

        const markdown =
          resultData?.markdown ||
          resultData?.cleaned_html ||
          resultData?.html ||
          '';

        if (!markdown && !resultData?.success) {
          throw new Error(
            resultData?.error_message || 'Crawl4AI failed to extract page content',
          );
        }

        return {
          content: [{ type: 'text', text: markdown }],
          isError: false,
        };
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Crawl4AI execution failed: ${lastError?.message || 'Connection failed'}`,
        },
      ],
      isError: true,
    };
  }

  /**
   * List all tools exposed by a specific MCP server
   */
  async listServerTools(server: MCPServerConfig): Promise<MCPTool[]> {
    if (!server.enabled) return [];

    if (this.isCrawl4Ai(server)) {
      return [
        {
          name: 'crawl4ai_scrape',
          description:
            'Extract clean markdown and metadata from a URL using Crawl4AI (with BM25 noise pruning)',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to scrape' },
            },
            required: ['url'],
          },
          serverId: server.id,
          serverName: server.name,
        },
      ];
    }

    try {
      let result: any;
      if (server.transport === 'stdio') {
        result = await this.sendStdioRequest(server, 'tools/list', {}, 10000);
      } else {
        result = await this.sendSSERequest(server, 'tools/list', {}, 10000);
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

    if (this.isCrawl4Ai(server)) {
      const result = await this.callCrawl4AiTool(server, toolName, args);
      const durationMs = Math.round(performance.now() - startTime);
      const isError = Boolean(result.isError);
      const summaryText = result.content?.[0]?.text;

      recordMcpLog({
        direction: 'outbound',
        serverName: server.name,
        method: 'tools/call',
        toolName,
        callerUser: 'search-agent',
        inputPayload: args,
        outputSummary: summaryText
          ? summaryText.length > 200
            ? summaryText.substring(0, 200) + '...'
            : summaryText
          : 'Success',
        status: isError ? 'error' : 'success',
        errorMessage: isError ? summaryText || 'Tool returned error' : undefined,
        durationMs,
      }).catch(() => {});

      return result;
    }

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
    if (this.isCrawl4Ai(server)) {
      return this.checkCrawl4AiStatus(server);
    }

    try {
      let result: any;
      if (server.transport === 'stdio') {
        result = await this.sendStdioRequest(server, 'tools/list', {}, 10000);
      } else {
        result = await this.sendSSERequest(server, 'tools/list', {}, 10000);
      }
      const toolsCount = Array.isArray(result?.tools) ? result.tools.length : 0;
      return {
        serverId: server.id,
        status: 'connected',
        toolsCount,
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

