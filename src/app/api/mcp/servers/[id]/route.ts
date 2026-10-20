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
    servers[idx] = {
      ...current,
      name: body.name !== undefined ? body.name.trim() : current.name,
      transport: body.transport !== undefined ? body.transport : current.transport,
      command: body.command !== undefined ? body.command?.trim() : current.command,
      args: body.args !== undefined ? body.args : current.args,
      url: body.url !== undefined ? body.url?.trim() : current.url,
      env: body.env !== undefined ? body.env : current.env,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled,
      autoApprove: body.autoApprove !== undefined ? Boolean(body.autoApprove) : current.autoApprove,
      updatedAt: new Date().toISOString(),
    };

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

