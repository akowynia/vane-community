export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import mcpClientManager from '@/lib/mcp/client';

export const PUT = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && (!user || user.role !== 'admin')) {
      return Response.json(
        { message: 'Admin access required to modify MCP servers.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return Response.json({ message: 'Request body required' }, { status: 400 });
    }

    const servers = mcpClientManager.getServers();
    const idx = servers.findIndex((s) => s.id === id);
    if (idx === -1) {
      return Response.json({ message: 'MCP server not found' }, { status: 404 });
    }

    const current = servers[idx];
    const newTransport = body.transport !== undefined ? body.transport : current.transport;

    if (newTransport === 'sse') {
      const targetUrl = body.url !== undefined ? body.url?.trim() : current.url;
      if (!targetUrl) {
        return Response.json({ message: 'URL is required for SSE transport.' }, { status: 400 });
      }
      try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return Response.json(
            { message: 'Invalid URL protocol: must be http or https.' },
            { status: 400 },
          );
        }
      } catch {
        return Response.json({ message: 'Invalid URL format.' }, { status: 400 });
      }
    } else if (newTransport === 'stdio') {
      const targetCommand = body.command !== undefined ? body.command?.trim() : current.command;
      if (!targetCommand) {
        return Response.json(
          { message: 'Executable command is required for stdio transport.' },
          { status: 400 },
        );
      }
    }

    servers[idx] = {
      ...current,
      name: body.name !== undefined ? body.name.trim() : current.name,
      transport: newTransport,
      command: newTransport === 'stdio' ? (body.command !== undefined ? body.command?.trim() : current.command) : undefined,
      args: newTransport === 'stdio'
        ? ('args' in body
            ? (Array.isArray(body.args) && body.args.length > 0 ? body.args : undefined)
            : current.args)
        : undefined,
      url: newTransport === 'sse' ? (body.url !== undefined ? body.url?.trim() : current.url) : undefined,
      env: 'env' in body
        ? (body.env && typeof body.env === 'object' && Object.keys(body.env).length > 0 ? body.env : undefined)
        : current.env,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
      autoApprove: body.autoApprove !== undefined ? Boolean(body.autoApprove) : current.autoApprove,
      updatedAt: new Date().toISOString(),
    };

    const isScraper = (name?: string) => {
      const lower = (name || '').toLowerCase();
      return (
        lower.includes('firecrawl') ||
        lower.includes('crawl4ai') ||
        lower.includes('scraper') ||
        lower.includes('crawler')
      );
    };

    // Ensure only one external scraper engine is active at any time
    if (servers[idx].enabled && isScraper(servers[idx].name)) {
      for (let i = 0; i < servers.length; i++) {
        if (i !== idx && isScraper(servers[i].name) && servers[i].enabled) {
          servers[i].enabled = false;
          mcpClientManager.disconnectServer(servers[i].id);
        }
      }
    }

    mcpClientManager.disconnectServer(id);
    await mcpClientManager.saveServers(servers);
    return Response.json({ server: servers[idx] }, { status: 200 });
  } catch (err: any) {
    console.error('Error updating MCP server:', err);
    return Response.json(
      { message: err?.message || 'Failed to update MCP server' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && (!user || user.role !== 'admin')) {
      return Response.json(
        { message: 'Admin access required to delete MCP servers.' },
        { status: 403 },
      );
    }

    const servers = mcpClientManager.getServers();
    const filtered = servers.filter((s) => s.id !== id);

    if (filtered.length === servers.length) {
      return Response.json({ message: 'MCP server not found' }, { status: 404 });
    }

    mcpClientManager.disconnectServer(id);
    await mcpClientManager.saveServers(filtered);
    return Response.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error('Error deleting MCP server:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete MCP server' },
      { status: 500 },
    );
  }
};

