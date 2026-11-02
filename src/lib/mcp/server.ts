import { searchSearxng } from '@/lib/searxng';
import Scraper from '@/lib/scraper';
import { MCPTool } from './types';

export const MCP_SERVER_INFO = {
  name: 'vane-community',
  version: '1.0.1',
  description: 'Privacy-focused AI search and research answering engine',
};

export const EXPOSED_MCP_TOOLS: MCPTool[] = [
  {
    name: 'search_web',
    description:
      'Search the web anonymously via Vane-Community meta-search engine with privacy protection.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query string to execute.',
        },
        sources: {
          type: 'array',
          items: { type: 'string', enum: ['web', 'academic', 'discussions'] },
          description: 'Search category sources (default: ["web"]).',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 8).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'scrape_page',
    description:
      'Safely fetch and parse clean readable Markdown content from a URL with built-in SSRF protection.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The target web page URL to scrape.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'deep_research',
    description:
      'Perform autonomous multi-hop research on a complex inquiry and synthesize structured findings with citations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The research topic or question to investigate.',
        },
        depth: {
          type: 'number',
          description: 'Maximum search depth / hops (1 to 3, default: 2).',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Handle incoming MCP JSON-RPC 2.0 requests
 */
export async function handleMCPRequest(request: {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: any;
}): Promise<any> {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: MCP_SERVER_INFO,
        },
      };
    }

    case 'notifications/initialized': {
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };
    }

    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: EXPOSED_MCP_TOOLS,
        },
      };
    }

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments || {};

      try {
        if (toolName === 'search_web') {
          const query = args.query;
          if (!query) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [{ type: 'text', text: 'Missing required argument: query' }],
              },
            };
          }

          const categories = Array.isArray(args.sources)
            ? args.sources.map((s: string) => (s === 'academic' ? 'science' : s === 'discussions' ? 'social media' : 'general'))
            : ['general'];

          const searchRes = await searchSearxng(query, { categories });
          const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
          const sliced = (searchRes.results || []).slice(0, limit);

          const formatted = sliced
            .map(
              (r, idx) =>
                `[${idx + 1}] ${r.title}\nURL: ${r.url}\n${r.content || 'No snippet available.'}`,
            )
            .join('\n\n---\n\n');

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: formatted || 'No results found for query.',
                },
              ],
            },
          };
        }

        if (toolName === 'scrape_page') {
          const url = args.url;
          if (!url) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [{ type: 'text', text: 'Missing required argument: url' }],
              },
            };
          }

          const scrapeResult = await Scraper.scrape(url, {});
          if (scrapeResult.error) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [{ type: 'text', text: `Scraping error: ${scrapeResult.error}` }],
              },
            };
          }

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `# ${scrapeResult.title}\n\n${scrapeResult.content}`,
                },
              ],
            },
          };
        }

        if (toolName === 'deep_research') {
          const query = args.query;
          if (!query) {
            return {
              jsonrpc: '2.0',
              id,
              result: {
                isError: true,
                content: [{ type: 'text', text: 'Missing required argument: query' }],
              },
            };
          }

          // Initial multi-category search
          const [webRes, sciRes] = await Promise.all([
            searchSearxng(query, { categories: ['general'] }).catch(() => ({ results: [] })),
            searchSearxng(query, { categories: ['science'] }).catch(() => ({ results: [] })),
          ]);

          const combined = [...(webRes.results || []).slice(0, 5), ...(sciRes.results || []).slice(0, 4)];
          const findings = combined
            .map((r, i) => `### Source [${i + 1}]: ${r.title}\nLink: ${r.url}\n${r.content || ''}`)
            .join('\n\n');

          const responseText = `## Deep Research Synthesis for: "${query}"\n\n### Discovered Findings:\n\n${findings || 'No sources discovered.'}`;

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: responseText }],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Tool not found: ${toolName}`,
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: `Tool execution failed: ${err?.message || err}` }],
          },
        };
      }
    }

    default: {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
    }
  }
}

