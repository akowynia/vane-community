export type MCPTransportType = 'stdio' | 'sse';

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
  autoApprove?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MCPToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  [key: string]: any;
}

export interface MCPToolSchema {
  type: 'object';
  properties?: Record<string, MCPToolParameter>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPToolSchema;
  serverId?: string;
  serverName?: string;
}

export interface MCPCallToolRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface MCPCallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPServerStatus {
  serverId: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
  toolsCount: number;
}

