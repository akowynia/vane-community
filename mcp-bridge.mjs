#!/usr/bin/env node

/**
 * MCP Stdio-to-HTTP JSON-RPC Bridge
 * Reads newline-delimited JSON-RPC from standard input,
 * forwards requests to the local Vane MCP server endpoint,
 * and writes responses to standard output.
 */

import readline from 'node:readline';

const endpoint = process.env.MCP_ENDPOINT || 'http://127.0.0.1:3001/api/mcp';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch (err) {
    process.stderr.write(`[MCP Bridge] Invalid JSON: ${trimmed}\n`);
    return;
  }

  const isNotification = payload.id === undefined || payload.id === null;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.MCP_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.MCP_API_KEY}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!isNotification) {
      const result = await response.json();
      process.stdout.write(JSON.stringify(result) + '\n');
    }
  } catch (err) {
    if (!isNotification) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: payload.id,
        error: {
          code: -32603,
          message: `Internal bridge error: ${err instanceof Error ? err.message : String(err)}`,
        },
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

rl.on('close', () => {
  process.exit(0);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
