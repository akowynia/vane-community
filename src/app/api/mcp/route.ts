export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { handleMCPRequest, MCP_SERVER_INFO, EXPOSED_MCP_TOOLS } from '@/lib/mcp/server';
import { extractRawApiKey, validateApiKey } from '@/lib/security/apiKeys';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { recordMcpLog } from '@/lib/mcp/logger';

/**
 * GET /api/mcp - MCP Server discovery and manifest
 */
export const GET = async (req: Request) => {
  return Response.json(
    {
      server: MCP_SERVER_INFO,
      protocolVersion: '2024-11-05',
      tools: EXPOSED_MCP_TOOLS,
    },
    { status: 200 },
  );
};

/**
 * POST /api/mcp - JSON-RPC 2.0 MCP handler
 */
export const POST = async (req: Request) => {
  const startTime = performance.now();
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  let callerUser = 'admin (single-user)';
  let apiKeyId: string | undefined = undefined;
  let apiKeyName: string | undefined = undefined;

  try {
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const rawKey = extractRawApiKey(req);
    if (rawKey) {
      const keyValidation = await validateApiKey(rawKey);
      if (keyValidation.success) {
        apiKeyId = keyValidation.key?.id;
        apiKeyName = keyValidation.key?.name;
        callerUser = keyValidation.user?.username || keyValidation.key?.name || 'api-user';
      }
    }

    if (instanceMode === 'multi') {
      let isAuthorized = Boolean(apiKeyId);

      if (!isAuthorized) {
        const user = await resolveRequestUser(req as NextRequest);
        if (user) {
          isAuthorized = true;
          callerUser = user.username;
        }
      }

      if (!isAuthorized) {
        return Response.json(
          {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32000,
              message: 'Authentication required. Provide a valid Bearer API key or active session.',
            },
          },
          { status: 401 },
        );
      }
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || body.jsonrpc !== '2.0') {
      return Response.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32600,
            message: 'Invalid Request: payload must be a JSON-RPC 2.0 object.',
          },
        },
        { status: 400 },
      );
    }

    const response = await handleMCPRequest(body);
    const durationMs = Math.round(performance.now() - startTime);

    const isError = Boolean(response.error);
    const toolName = body.method === 'tools/call' ? body.params?.name : undefined;

    let outputSummary: string | undefined = undefined;
    if (response.error) {
      outputSummary = response.error.message;
    } else if (response.result?.tools) {
      outputSummary = `${response.result.tools.length} tools available`;
    } else if (response.result?.content) {
      const text = response.result.content[0]?.text || '';
      outputSummary = text.length > 200 ? text.substring(0, 200) + '...' : text;
    } else if (response.result?.serverInfo) {
      outputSummary = `Client initialized (${response.result.serverInfo.name})`;
    }

    recordMcpLog({
      direction: 'inbound',
      serverName: 'vane-server',
      method: body.method || 'unknown',
      toolName,
      callerUser,
      apiKeyId,
      apiKeyName,
      clientIp,
      userAgent,
      inputPayload: body.params?.arguments || body.params,
      outputSummary,
      status: isError ? 'error' : 'success',
      errorMessage: response.error?.message,
      durationMs,
    }).catch(() => {});

    return Response.json(response, { status: 200 });
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    console.error('MCP Server error:', err);

    recordMcpLog({
      direction: 'inbound',
      serverName: 'vane-server',
      method: 'unknown',
      callerUser,
      apiKeyId,
      apiKeyName,
      clientIp,
      userAgent,
      status: 'error',
      errorMessage: err?.message || 'Internal error handling MCP request',
      durationMs,
    }).catch(() => {});

    return Response.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: err?.message || 'Internal error handling MCP request',
        },
      },
      { status: 500 },
    );
  }
};

