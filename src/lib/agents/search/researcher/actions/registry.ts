import { Tool, ToolCall } from '@/lib/models/types';
import {
  ActionOutput,
  AdditionalConfig,
  ClassifierOutput,
  ResearchAction,
  SearchAgentConfig,
  SearchSources,
} from '../../types';

import mcpClientManager from '@/lib/mcp/client';

class ActionRegistry {
  private static actions: Map<string, ResearchAction> = new Map();

  static register(action: ResearchAction<any>) {
    this.actions.set(action.name, action);
  }

  static get(name: string): ResearchAction | undefined {
    return this.actions.get(name);
  }

  static getAvailableActions(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): ResearchAction[] {
    return Array.from(
      this.actions.values().filter((action) => action.enabled(config)),
    );
  }

  static getAvailableActionTools(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): Tool[] {
    const availableActions = this.getAvailableActions(config);

    return availableActions.map((action) => ({
      name: action.name,
      description: action.getToolDescription({ mode: config.mode }),
      schema: action.schema,
    }));
  }

  static async getAvailableActionToolsWithMCP(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): Promise<Tool[]> {
    const tools = this.getAvailableActionTools(config);
    try {
      const mcpTools = await mcpClientManager.listAllTools();
      for (const mt of mcpTools) {
        tools.push({
          name: `mcp_${mt.name}`,
          description: `[MCP: ${mt.serverName}] ${mt.description || 'External MCP tool'}`,
          schema: (mt.inputSchema as any) || { type: 'object' },
        });
      }
    } catch {}
    return tools;
  }

  static getAvailableActionsDescriptions(config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }): string {
    const availableActions = this.getAvailableActions(config);

    return availableActions
      .map(
        (action) =>
          `<tool name="${action.name}">\n${action.getDescription({ mode: config.mode })}\n</tool>`,
      )
      .join('\n\n');
  }

  static async execute(
    name: string,
    params: any,
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
      mode: SearchAgentConfig['mode'];
      classification?: ClassifierOutput;
      query?: string;
      tokenTracker?: {
        addTokens: (count: number) => void;
        getUsedTokens: () => number;
        isLimitExceeded: () => boolean;
      };
    },
  ) {
    const action = this.actions.get(name);

    if (!action) {
      // Check if this is an external MCP tool invocation
      if (name.startsWith('mcp_') || name.includes('_')) {
        const rawToolName = name.startsWith('mcp_') ? name.replace(/^mcp_/, '') : name;
        try {
          const tools = await mcpClientManager.listAllTools();
          const targetTool = tools.find((t) => t.name === rawToolName || t.name === name);
          if (targetTool && targetTool.serverId) {
            const mcpResult = await mcpClientManager.callTool(
              targetTool.serverId,
              targetTool.name,
              params || {},
            );
            const textOutput = (mcpResult.content || [])
              .map((c) => c.text || '')
              .filter(Boolean)
              .join('\n\n');

            return {
              type: 'search_results' as const,
              results: [
                {
                  content: textOutput || 'Tool executed with no output.',
                  metadata: {
                    title: `MCP: ${targetTool.name} (${targetTool.serverName})`,
                    url: `mcp://${targetTool.serverName}/${targetTool.name}`,
                  },
                },
              ],
            };
          }
        } catch (mcpErr) {
          console.warn(`[ActionRegistry] Failed to execute MCP tool "${name}":`, mcpErr);
        }
      }

      throw new Error(`Action with name ${name} not found`);
    }

    return action.execute(params || {}, additionalConfig);
  }

  static async executeAll(
    actions: ToolCall[],
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
      mode: SearchAgentConfig['mode'];
      classification?: ClassifierOutput;
      query?: string;
      tokenTracker?: {
        addTokens: (count: number) => void;
        getUsedTokens: () => number;
        isLimitExceeded: () => boolean;
      };
    },
  ): Promise<ActionOutput[]> {
    return Promise.all(
      actions.map(async (actionConfig) => {
        try {
          return await this.execute(
            actionConfig.name,
            actionConfig.arguments || {},
            additionalConfig,
          );
        } catch (err) {
          console.error(
            `[ActionRegistry] Error executing action "${actionConfig.name}":`,
            err,
          );
          return {
            type: 'search_results' as const,
            results: [],
          };
        }
      }),
    );
  }
}

export default ActionRegistry;
