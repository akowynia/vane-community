export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { getMcpLogs, getMcpUsageStats, clearMcpLogs } from '@/lib/mcp/logger';

/**
 * GET /api/mcp/logs - Fetch MCP activity logs and aggregate usage metrics
 */
export const GET = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && (!user || user.role !== 'admin')) {
      return Response.json(
        { message: 'Admin access required to view MCP activity logs.' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const direction = (searchParams.get('direction') || 'all') as 'inbound' | 'outbound' | 'all';
    const status = (searchParams.get('status') || 'all') as 'success' | 'error' | 'all';
    const search = searchParams.get('search') || undefined;

    const [logsResult, stats] = await Promise.all([
      getMcpLogs({ limit, offset, direction, status, search }),
      getMcpUsageStats(),
    ]);

    return Response.json(
      {
        logs: logsResult.logs,
        total: logsResult.total,
        stats,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error fetching MCP logs:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch MCP activity logs' },
      { status: 500 },
    );
  }
};

/**
 * DELETE /api/mcp/logs - Clear all MCP activity logs
 */
export const DELETE = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && (!user || user.role !== 'admin')) {
      return Response.json(
        { message: 'Admin access required to clear MCP activity logs.' },
        { status: 403 },
      );
    }

    await clearMcpLogs();
    return Response.json({ success: true, message: 'MCP logs cleared successfully' }, { status: 200 });
  } catch (err: any) {
    console.error('Error clearing MCP logs:', err);
    return Response.json(
      { message: err?.message || 'Failed to clear MCP activity logs' },
      { status: 500 },
    );
  }
};

