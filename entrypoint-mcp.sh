#!/bin/sh
set -e

PORT="${PORT:-3000}"
INTERNAL_PORT="${INTERNAL_PORT:-3001}"
MCP_MODE="${MCP_TRANSPORT:-auto}"

if [ "$1" = "--stdio" ]; then
  MCP_MODE="stdio"
elif [ "$1" = "--http" ]; then
  MCP_MODE="http"
fi

# In stdio mode, JSON-RPC is piped through standard input and standard output
if [ "$MCP_MODE" = "stdio" ] || { [ "$MCP_MODE" = "auto" ] && [ ! -t 0 ] && [ -z "$PORT_EXPLICIT" ]; }; then
  export PORT=$INTERNAL_PORT
  export HOSTNAME="127.0.0.1"

  # Launch the internal standalone service silently in background
  node server.js >/dev/null 2>&1 &
  SERVER_PID=$!

  trap 'kill $SERVER_PID 2>/dev/null || true' EXIT INT TERM

  READY=0
  for i in $(seq 1 60); do
    if curl -s -f "http://127.0.0.1:$INTERNAL_PORT/api/mcp" >/dev/null 2>&1; then
      READY=1
      break
    fi
    sleep 0.2
  done

  if [ $READY -ne 1 ]; then
    echo "[MCP] Failed to start internal MCP server within timeout" >&2
    exit 1
  fi

  export MCP_ENDPOINT="http://127.0.0.1:$INTERNAL_PORT/api/mcp"
  exec node mcp-bridge.mjs
else
  # In HTTP mode, listen on all interfaces
  export PORT="$PORT"
  export HOSTNAME="0.0.0.0"
  echo "Starting Vane MCP Server on http://0.0.0.0:$PORT/api/mcp ..."
  exec node server.js
fi
