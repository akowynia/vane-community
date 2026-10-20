export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import mcpClientManager from '@/lib/mcp/client';
import { MCPServerConfig } from '@/lib/mcp/types';
import crypto from 'crypto';

/**
 * GET /api/mcp/servers - List configured MCP servers with status
 */
export const GET = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && (!user || user.role !== 'admin')) {
      return Response.json(
        { message: 'Admin access required to view MCP servers.' },
        { status: 403 },
      );
    }

    const servers = mcpClientManager.getServers();
    const statuses = await Promise.all(
      servers.map(async (s) => {
        if (!s.enabled) {
          return { serverId: s.id, status: 'disconnected' as const, toolsCount: 0 };
        }
        return mcpClientManager.checkServerStatus(s);
      }),
    );

    return Response.json({ servers, statuses }, { status: 200 });
  } catch (err: any) {
    console.error('Error listing MCP servers:', err);
    return Response.json(
      { message: err?.message || 'Failed to list MCP servers' },
      { status: 500 },
    );
  }
};

/**
 * POST /api/mcp/servers - Add a new MCP server
 */
export const POST = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && (!user || user.role !== 'admin')) {
      return Response.json(
        { message: 'Admin access required to configure MCP servers.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.transport) {
      return Response.json(
        { message: 'Server name and transport type are required.' },
        { status: 400 },
      );
    }

    const servers = mcpClientManager.getServers();
    const newServer: MCPServerConfig = {
      id: crypto.randomUUID(),
      name: body.name.trim(),
      transport: body.transport === 'sse' ? 'sse' : 'stdio',
      command: body.command?.trim() || undefined,
      args: Array.isArray(body.args) ? body.args : undefined,
      url: body.url?.trim() || undefined,
      env: typeof body.env === 'object' ? body.env : undefined,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
      autoApprove: Boolean(body.autoApprove),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    servers.push(newServer);
    await mcpClientManager.saveServers(servers);

    return Response.json({ server: newServer }, { status: 201 });
  } catch (err: any) {
    console.error('Error adding MCP server:', err);
    return Response.json(
      { message: err?.message || 'Failed to add MCP server' },
      { status: 500 },
    );
  }
};

