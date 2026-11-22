import fs from 'fs';
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

interface SSESession {
  targetUrl: string;
  sessionId?: string;
}

class MCPClientManager {
  private static instance: MCPClientManager;
  private stdioSessions: Map<string, StdioSession> = new Map();
  private sseSessions: Map<string, SSESession> = new Map();

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
   * Disconnect and invalidate any active process or cached session for a server
   */
  disconnectServer(serverId: string): void {
    const stdioSession = this.stdioSessions.get(serverId);
    if (stdioSession) {
      try {
        if (!stdioSession.process.killed) {
          stdioSession.process.kill('SIGTERM');
        }
      } catch (err) {
        console.warn(`[MCPClient] Error terminating subprocess for server ${serverId}:`, err);
      }
      this.stdioSessions.delete(serverId);
    }

    this.sseSessions.delete(serverId);
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
   * Parse either direct JSON response or Streamable HTTP / Server-Sent Events (SSE) data stream
   */
  private parseSSEOrJson(rawText: string): any {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed);
    }
    const lines = trimmed.split('\n');
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('data:')) {
        dataLines.push(line.replace(/^data:\s*/, ''));
      }
    }
    if (dataLines.length > 0) {
      const combined = dataLines.join('\n');
      return JSON.parse(combined);
    }
    throw new Error(`Unable to parse MCP response payload: ${trimmed.substring(0, 120)}`);
  }

  /**
   * Detect whether runtime environment is containerized (Docker)
   */
  private isDockerEnvironment(): boolean {
    try {
      return (
        fs.existsSync('/.dockerenv') ||
        fs.existsSync('/run/.containerenv') ||
        Boolean(process.env.DOCKER_CONTAINER)
      );
    } catch {
      return false;
    }
  }

  /**
   * Helper to resolve local candidate URLs, seamlessly converting localhost / 127.0.0.1
   * to host.docker.internal, docker bridge gateway (172.17.0.1), and known container names.
   */
  private resolveCandidateUrls(rawUrl: string, serviceHint?: string): string[] {
    let normalized = (rawUrl || '').trim();
    if (!normalized) return [];
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `http://${normalized}`;
    }

    const inDocker = this.isDockerEnvironment();
    const candidates: string[] = [];
    const isLocal = normalized.includes('localhost') || normalized.includes('127.0.0.1');

    if (inDocker && isLocal) {
      // In Docker, host.docker.internal and container names must be prioritized over 127.0.0.1
      candidates.push(
        normalized.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal'),
        normalized.replace(/localhost|127\.0\.0\.1/, '172.17.0.1'),
      );

      const lowerHint = (serviceHint || '').toLowerCase();
      if (lowerHint.includes('crawl4ai') || normalized.includes(':11235')) {
        candidates.push(normalized.replace(/localhost(:\d+)?|127\.0\.0\.1(:\d+)?/, 'crawl4ai:11235'));
      }
      if (lowerHint.includes('firecrawl') || normalized.includes(':3002')) {
        candidates.push(normalized.replace(/localhost(:\d+)?|127\.0\.0\.1(:\d+)?/, 'firecrawl:3002'));
      }
      if (lowerHint.includes('presenton') || normalized.includes(':5000') || normalized.includes(':5001')) {
        candidates.push('http://presenton/mcp', 'http://presenton:80/mcp');
      }

      // Add original localhost as fallback
      candidates.push(normalized);
    } else {
      candidates.push(normalized);
      if (isLocal) {
        candidates.push(
          normalized.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal'),
        );
      }
    }

    return Array.from(new Set(candidates));
  }

  /**
   * Build candidate endpoint URLs for remote SSE servers, handling Docker container networking
   */
  private getSSECandidateUrls(server: MCPServerConfig): string[] {
    if (!server.url) return [];
    const urls: string[] = [];

    const existing = this.sseSessions.get(server.id);
    if (existing?.targetUrl) {
      urls.push(existing.targetUrl);
    }

    const resolved = this.resolveCandidateUrls(server.url, server.name);
    urls.push(...resolved);

    return Array.from(new Set(urls));
  }

  /**
   * Ensure Streamable HTTP / FastMCP SSE server has initialized session ID
   */
  private async ensureSSEInitialized(
    server: MCPServerConfig,
    timeoutMs: number = 10000,
  ): Promise<SSESession> {
    const existing = this.sseSessions.get(server.id);
    if (existing) return existing;

    const candidateUrls = this.getSSECandidateUrls(server);
    let lastError: any;

    for (const targetUrl of candidateUrls) {
      const ssrfCheck = await validateUrlForSSRF(targetUrl, { allowLocal: true });
      if (!ssrfCheck.valid) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            ...server.env,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'vane-community', version: '1.0.1' },
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to initialize MCP SSE session`);
        }

        const rawText = await res.text();
        const data = this.parseSSEOrJson(rawText);
        if (data.error) {
          throw new Error(data.error.message || 'MCP Initialization error');
        }

        const sessionId = res.headers.get('mcp-session-id') || undefined;
        const session: SSESession = { targetUrl, sessionId };
        this.sseSessions.set(server.id, session);
        return session;
      } catch (err: any) {
        clearTimeout(timeout);
        lastError = err;
      }
    }

    const fallbackSession: SSESession = { targetUrl: candidateUrls[0] || server.url! };
    this.sseSessions.set(server.id, fallbackSession);
    return fallbackSession;
  }

  /**
   * Execute single SSE/HTTP JSON-RPC request attempt
   */
  private async executeSSERequest(
    server: MCPServerConfig,
    method: string,
    params: any = {},
    timeoutMs: number = 10000,
  ): Promise<any> {
    if (!server.url) {
      throw new Error(`Endpoint URL missing for SSE server ${server.name}`);
    }

    if (method !== 'initialize') {
      await this.ensureSSEInitialized(server, timeoutMs).catch(() => {});
    }

    const session = this.sseSessions.get(server.id);
    const candidateUrls = this.getSSECandidateUrls(server);
    let lastError: any;

    for (const targetUrl of candidateUrls) {
      const ssrfCheck = await validateUrlForSSRF(targetUrl, { allowLocal: true });
      if (!ssrfCheck.valid) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...server.env,
      };

      if (session?.sessionId) {
        headers['mcp-session-id'] = session.sessionId;
      }

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

        if (res.status === 400 && session?.sessionId) {
          this.sseSessions.delete(server.id);
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to communicate with MCP server`);
        }

        const rawText = await res.text();
        const data = this.parseSSEOrJson(rawText);

        const newSessionId = res.headers.get('mcp-session-id');
        if (newSessionId) {
          this.sseSessions.set(server.id, { targetUrl, sessionId: newSessionId });
        }

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
   * Send a JSON-RPC request over SSE / HTTP with automatic session reconnection
   */
  private async sendSSERequest(
    server: MCPServerConfig,
    method: string,
    params: any = {},
    timeoutMs: number = 10000,
  ): Promise<any> {
    try {
      return await this.executeSSERequest(server, method, params, timeoutMs);
    } catch (err: any) {
      if (
        err?.message?.includes('Missing session ID') ||
        err?.message?.includes('session') ||
        err?.message?.includes('HTTP 400')
      ) {
        this.sseSessions.delete(server.id);
        return await this.executeSSERequest(server, method, params, timeoutMs);
      }
      throw err;
    }
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
    raw = raw.replace(/\/mcp\/?$/, '').replace(/\/+$/, '');
    return this.resolveCandidateUrls(raw, 'crawl4ai');
  }

  /**
   * Health check for Crawl4AI container
   */
  private async checkCrawl4AiStatus(server: MCPServerConfig): Promise<MCPServerStatus> {
    const candidateUrls = this.getCrawl4AiCandidateUrls(server);
    const token =
      server.env?.CRAWL4AI_API_TOKEN ||
      server.env?.API_TOKEN ||
      process.env.CRAWL4AI_API_TOKEN ||
      'test_api_code';
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          this.sseSessions.set(server.id, { targetUrl: baseUrl });
          return {
            serverId: server.id,
            status: 'connected',
            toolsCount: 1,
          };
        } else {
          lastError = new Error(`HTTP ${res.status}: ${res.statusText || 'Crawl4AI service error'}`);
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

    const isTimeout =
      lastError?.name === 'AbortError' ||
      lastError?.name === 'TimeoutError' ||
      lastError?.message?.includes('aborted');

    let errorMsg: string;
    if (isConnRefused) {
      errorMsg = 'Crawl4AI offline (verify container is running: docker compose up -d crawl4ai)';
    } else if (isTimeout) {
      errorMsg = 'Connection timed out. If running in Docker, ensure Crawl4AI listens on 0.0.0.0 and use host.docker.internal';
    } else {
      errorMsg = lastError?.message || 'Crawl4AI unreachable';
    }

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
   * Check if the given server config represents a self-hosted Firecrawl REST service
   */
  private isFirecrawl(server: MCPServerConfig): boolean {
    const name = (server.name || '').toLowerCase();
    const url = (server.url || '').toLowerCase();
    return server.transport !== 'stdio' && (name.includes('firecrawl') || url.includes(':3002'));
  }

  /**
   * Generate candidate base URLs for self-hosted Firecrawl API
   */
  private getFirecrawlCandidateUrls(server: MCPServerConfig): string[] {
    let raw = (server.url || 'http://localhost:3002').trim();
    raw = raw.replace(/\/+$/, '');
    return this.resolveCandidateUrls(raw, 'firecrawl');
  }

  /**
   * Health check for self-hosted Firecrawl API container
   */
  private async checkFirecrawlStatus(server: MCPServerConfig): Promise<MCPServerStatus> {
    const candidateUrls = this.getFirecrawlCandidateUrls(server);
    const apiKey =
      server.env?.FIRECRAWL_API_KEY ||
      server.env?.API_KEY ||
      process.env.FIRECRAWL_API_KEY ||
      '';

    let lastError: any;

    for (const baseUrl of candidateUrls) {
      // Test readiness, health, or root endpoints
      const testEndpoints = [`${baseUrl}/v0/health/readiness`, `${baseUrl}/health`, `${baseUrl}/`];
      for (const targetUrl of testEndpoints) {
        const ssrfCheck = await validateUrlForSSRF(targetUrl, { allowLocal: true });
        if (!ssrfCheck.valid) continue;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        try {
          const headers: Record<string, string> = {
            'Accept': 'application/json',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }

          const res = await fetch(targetUrl, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            this.sseSessions.set(server.id, { targetUrl: baseUrl });
            return {
              serverId: server.id,
              status: 'connected',
              toolsCount: 1,
            };
          } else {
            lastError = new Error(`HTTP ${res.status}: ${res.statusText || 'Firecrawl service error'}`);
          }
        } catch (err: any) {
          clearTimeout(timeout);
          lastError = err;
        }
      }
    }

    const isConnRefused =
      lastError?.code === 'ECONNREFUSED' ||
      lastError?.message?.includes('fetch failed') ||
      lastError?.message?.includes('ECONNREFUSED');

    const isTimeout =
      lastError?.name === 'AbortError' ||
      lastError?.name === 'TimeoutError' ||
      lastError?.message?.includes('aborted');

    let errorMsg: string;
    if (isConnRefused) {
      errorMsg = 'Firecrawl offline (run: docker compose up -d firecrawl)';
    } else if (isTimeout) {
      errorMsg = 'Connection timed out. If running in Docker, ensure Firecrawl listens on 0.0.0.0 and use host.docker.internal:3002';
    } else {
      errorMsg = lastError?.message || 'Firecrawl unreachable';
    }

    return {
      serverId: server.id,
      status: 'error',
      error: errorMsg,
      toolsCount: 0,
    };
  }

  /**
   * Invoke /v1/scrape on self-hosted Firecrawl API
   */
  private async callFirecrawlTool(
    server: MCPServerConfig,
    toolName: string,
    args: Record<string, any>,
  ): Promise<MCPCallToolResult> {
    const candidateUrls = this.getFirecrawlCandidateUrls(server);
    const targetUrlInput = args.url || args.urls;
    if (!targetUrlInput) {
      return {
        content: [{ type: 'text', text: 'Missing required argument: url' }],
        isError: true,
      };
    }

    const apiKey =
      server.env?.FIRECRAWL_API_KEY ||
      server.env?.API_KEY ||
      process.env.FIRECRAWL_API_KEY ||
      '';

    let lastError: any;

    for (const baseUrl of candidateUrls) {
      const scrapeUrl = `${baseUrl}/v1/scrape`;
      const ssrfCheck = await validateUrlForSSRF(scrapeUrl, { allowLocal: true });
      if (!ssrfCheck.valid) continue;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const res = await fetch(scrapeUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            url: targetUrlInput,
            formats: ['markdown'],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`Firecrawl returned HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const markdown =
          data?.data?.markdown ||
          data?.markdown ||
          data?.data?.content ||
          data?.content ||
          '';

        if (!markdown && !data?.success) {
          throw new Error(data?.error || 'Firecrawl failed to extract page content');
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
          text: `Firecrawl execution failed: ${lastError?.message || 'Connection failed'}`,
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

    if (this.isFirecrawl(server)) {
      return [
        {
          name: 'firecrawl_scrape',
          description:
            'Extract clean markdown from a URL using self-hosted Firecrawl API',
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

    if (this.isFirecrawl(server)) {
      const result = await this.callFirecrawlTool(server, toolName, args);
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
    if (this.isFirecrawl(server)) {
      return this.checkFirecrawlStatus(server);
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
      let errorMsg = err?.message || 'Connection failed';
      if (err?.name === 'AbortError' || errorMsg.includes('aborted')) {
        errorMsg =
          'Connection timed out. If running in Docker, ensure target service listens on 0.0.0.0 and use host.docker.internal';
      }
      return {
        serverId: server.id,
        status: 'error',
        error: errorMsg,
        toolsCount: 0,
      };
    }
  }
}

export const mcpClientManager = MCPClientManager.getInstance();
export default mcpClientManager;

