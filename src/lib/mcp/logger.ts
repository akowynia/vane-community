import db, { ensureMcpLogsTable } from '@/lib/db';
import { mcpLogs, MCPLogRecord, NewMCPLogRecord } from '@/lib/db/schema';
import { desc, eq, and, sql, or, like } from 'drizzle-orm';

export interface MCPLogInput {
  direction: 'inbound' | 'outbound';
  serverName: string;
  method: string;
  toolName?: string;
  callerUser?: string;
  apiKeyId?: string;
  apiKeyName?: string;
  clientIp?: string;
  userAgent?: string;
  inputPayload?: any;
  outputSummary?: string;
  status: 'success' | 'error';
  errorMessage?: string;
  durationMs: number;
}

export interface MCPUsageStats {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  topTools: Array<{ name: string; count: number; avgDurationMs: number }>;
  topCallers: Array<{ name: string; count: number }>;
}

/**
 * Truncate deep or massive payload objects to preserve database health
 */
function sanitizePayload(payload: any): any {
  if (!payload) return null;
  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= 4000) {
      return payload;
    }
    // If payload is too large, truncate strings within it
    if (typeof payload === 'object') {
      const truncated: Record<string, any> = {};
      for (const [k, v] of Object.entries(payload)) {
        if (typeof v === 'string') {
          truncated[k] = v.length > 500 ? v.substring(0, 500) + '... [truncated]' : v;
        } else {
          truncated[k] = v;
        }
      }
      return truncated;
    }
    return serialized.substring(0, 4000) + '... [truncated]';
  } catch {
    return null;
  }
}

/**
 * Asynchronously record an MCP event in the audit database
 */
export async function recordMcpLog(entry: MCPLogInput): Promise<void> {
  try {
    ensureMcpLogsTable();

    const record: NewMCPLogRecord = {
      direction: entry.direction,
      serverName: entry.serverName,
      method: entry.method,
      toolName: entry.toolName || null,
      callerUser: entry.callerUser || null,
      apiKeyId: entry.apiKeyId || null,
      apiKeyName: entry.apiKeyName || null,
      clientIp: entry.clientIp || null,
      userAgent: entry.userAgent || null,
      inputPayload: sanitizePayload(entry.inputPayload),
      outputSummary: entry.outputSummary ? entry.outputSummary.substring(0, 1000) : null,
      status: entry.status,
      errorMessage: entry.errorMessage ? entry.errorMessage.substring(0, 1000) : null,
      durationMs: Math.max(0, Math.round(entry.durationMs)),
      createdAt: new Date().toISOString(),
    };

    await db.insert(mcpLogs).values(record).execute();
  } catch (err) {
    console.warn('[MCP Logger] Failed to record log entry:', err);
  }
}

/**
 * Query recent MCP activity logs with optional filters and pagination
 */
export async function getMcpLogs(options: {
  limit?: number;
  offset?: number;
  direction?: 'inbound' | 'outbound' | 'all';
  status?: 'success' | 'error' | 'all';
  search?: string;
}): Promise<{ logs: MCPLogRecord[]; total: number }> {
  try {
    ensureMcpLogsTable();

    const limit = Math.min(options.limit || 50, 200);
    const offset = Math.max(options.offset || 0, 0);

    const conditions = [];

    if (options.direction && options.direction !== 'all') {
      conditions.push(eq(mcpLogs.direction, options.direction));
    }

    if (options.status && options.status !== 'all') {
      conditions.push(eq(mcpLogs.status, options.status));
    }

    if (options.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      conditions.push(
        or(
          like(mcpLogs.toolName, term),
          like(mcpLogs.callerUser, term),
          like(mcpLogs.apiKeyName, term),
          like(mcpLogs.serverName, term),
          like(mcpLogs.userAgent, term),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db.query.mcpLogs.findMany({
        where: whereClause,
        orderBy: [desc(mcpLogs.createdAt)],
        limit,
        offset,
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(mcpLogs)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count || 0;
    return { logs, total };
  } catch (err) {
    console.error('[MCP Logger] Failed to fetch logs:', err);
    return { logs: [], total: 0 };
  }
}

/**
 * Compute aggregate statistics on MCP usage and activity
 */
export async function getMcpUsageStats(): Promise<MCPUsageStats> {
  try {
    ensureMcpLogsTable();

    const allLogs = await db.query.mcpLogs.findMany({
      orderBy: [desc(mcpLogs.createdAt)],
      limit: 1000,
    });

    const totalCalls = allLogs.length;
    let inboundCalls = 0;
    let outboundCalls = 0;
    let successCount = 0;
    let totalDuration = 0;

    const toolCounts = new Map<string, { count: number; totalDuration: number }>();
    const callerCounts = new Map<string, number>();

    for (const log of allLogs) {
      if (log.direction === 'inbound') inboundCalls++;
      else if (log.direction === 'outbound') outboundCalls++;

      if (log.status === 'success') successCount++;
      totalDuration += log.durationMs;

      const toolKey = log.toolName || log.method;
      const currentTool = toolCounts.get(toolKey) || { count: 0, totalDuration: 0 };
      currentTool.count++;
      currentTool.totalDuration += log.durationMs;
      toolCounts.set(toolKey, currentTool);

      const callerKey = log.apiKeyName || log.callerUser || 'anonymous';
      callerCounts.set(callerKey, (callerCounts.get(callerKey) || 0) + 1);
    }

    const errorCount = totalCalls - successCount;
    const successRate = totalCalls > 0 ? Math.round((successCount / totalCalls) * 1000) / 10 : 100;
    const avgDurationMs = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    const topTools = Array.from(toolCounts.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgDurationMs: Math.round(data.totalDuration / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topCallers = Array.from(callerCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      totalCalls,
      inboundCalls,
      outboundCalls,
      successCount,
      errorCount,
      successRate,
      avgDurationMs,
      topTools,
      topCallers,
    };
  } catch (err) {
    console.error('[MCP Logger] Failed to compute stats:', err);
    return {
      totalCalls: 0,
      inboundCalls: 0,
      outboundCalls: 0,
      successCount: 0,
      errorCount: 0,
      successRate: 100,
      avgDurationMs: 0,
      topTools: [],
      topCallers: [],
    };
  }
}

/**
 * Clear all MCP activity logs
 */
export async function clearMcpLogs(): Promise<void> {
  try {
    ensureMcpLogsTable();
    await db.delete(mcpLogs).execute();
  } catch (err) {
    console.error('[MCP Logger] Failed to clear logs:', err);
    throw err;
  }
}

