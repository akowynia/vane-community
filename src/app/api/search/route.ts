import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import APISearchAgent from '@/lib/agents/search/api';
import { validateApiKey, extractRawApiKey } from '@/lib/security/apiKeys';
import { resolveRequestUser } from '@/lib/security/rbac';
import db from '@/lib/db';
import { waypoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import providerQueueManager from '@/lib/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const modelRefSchema = z.union([
  z.object({
    providerId: z.string().optional(),
    provider: z.string().optional(),
    key: z.string().optional(),
    name: z.string().optional(),
    model: z.string().optional(),
  }),
  z.string(),
]);

const searchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  sources: z.array(z.string()).optional(),
  focusMode: z.string().optional(),
  chatModel: modelRefSchema.optional(),
  embeddingModel: modelRefSchema.optional(),
  chatModelKey: z.string().optional(),
  chatModelProviderId: z.string().optional(),
  embeddingModelKey: z.string().optional(),
  embeddingModelProviderId: z.string().optional(),
  optimizationMode: z
    .enum(['speed', 'balanced', 'quality'])
    .optional()
    .default('speed'),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  stream: z.boolean().optional().default(false),
  systemInstructions: z.string().nullable().optional().default(''),
  waypointId: z.string().nullable().optional(),
});

type SearchRequestBody = z.infer<typeof searchRequestSchema>;

const resolveModels = async (
  body: SearchRequestBody,
  registry: ModelRegistry,
): Promise<{ chatModel: ModelWithProvider; embeddingModel: ModelWithProvider }> => {
  let rawChatModel = body.chatModel;
  let chatKey: string | undefined = body.chatModelKey;
  let chatProviderId: string | undefined = body.chatModelProviderId;

  if (typeof rawChatModel === 'string') {
    chatKey = rawChatModel;
  } else if (rawChatModel && typeof rawChatModel === 'object') {
    chatKey =
      chatKey ||
      rawChatModel.key ||
      rawChatModel.name ||
      rawChatModel.model;
    chatProviderId =
      chatProviderId || rawChatModel.providerId || rawChatModel.provider;
  }

  let rawEmbeddingModel = body.embeddingModel;
  let embeddingKey: string | undefined = body.embeddingModelKey;
  let embeddingProviderId: string | undefined = body.embeddingModelProviderId;

  if (typeof rawEmbeddingModel === 'string') {
    embeddingKey = rawEmbeddingModel;
  } else if (rawEmbeddingModel && typeof rawEmbeddingModel === 'object') {
    embeddingKey =
      embeddingKey ||
      rawEmbeddingModel.key ||
      rawEmbeddingModel.name ||
      rawEmbeddingModel.model;
    embeddingProviderId =
      embeddingProviderId ||
      rawEmbeddingModel.providerId ||
      rawEmbeddingModel.provider;
  }

  const activeProviders = await registry.getActiveProviders();

  if (activeProviders.length === 0) {
    throw new Error(
      'No active model providers found. Please configure providers in Settings.',
    );
  }

  // Resolve chat provider by ID or type/name alias (e.g. "ollama", "openai")
  if (chatProviderId) {
    const target = chatProviderId.toLowerCase();
    const matched = activeProviders.find(
      (p) =>
        p.id === chatProviderId ||
        (p.type && p.type.toLowerCase() === target) ||
        (p.name && p.name.toLowerCase() === target),
    );
    if (matched) {
      chatProviderId = matched.id;
    }
  }

  if (!chatProviderId && chatKey) {
    const targetKey = chatKey.toLowerCase();
    const found = activeProviders.find((p) =>
      p.chatModels.some(
        (m) =>
          (m.key && m.key.toLowerCase() === targetKey) ||
          (m.name && m.name.toLowerCase() === targetKey),
      ),
    );
    if (found) {
      chatProviderId = found.id;
    }
  }

  if (!chatProviderId || !chatKey) {
    const defaultChatProvider =
      activeProviders.find((p) => p.chatModels.length > 0) ||
      activeProviders[0];
    if (!defaultChatProvider || defaultChatProvider.chatModels.length === 0) {
      throw new Error('No available chat models found.');
    }
    chatProviderId = defaultChatProvider.id;
    if (!chatKey) {
      chatKey = defaultChatProvider.chatModels[0].key;
    }
  }

  // Resolve embedding provider by ID or type/name alias
  if (embeddingProviderId) {
    const target = embeddingProviderId.toLowerCase();
    const matched = activeProviders.find(
      (p) =>
        p.id === embeddingProviderId ||
        (p.type && p.type.toLowerCase() === target) ||
        (p.name && p.name.toLowerCase() === target),
    );
    if (matched) {
      embeddingProviderId = matched.id;
    }
  }

  if (!embeddingProviderId && embeddingKey) {
    const targetKey = embeddingKey.toLowerCase();
    const found = activeProviders.find((p) =>
      p.embeddingModels.some(
        (m) =>
          (m.key && m.key.toLowerCase() === targetKey) ||
          (m.name && m.name.toLowerCase() === targetKey),
      ),
    );
    if (found) {
      embeddingProviderId = found.id;
    }
  }

  if (!embeddingProviderId || !embeddingKey) {
    const defaultEmbedProvider =
      activeProviders.find((p) => p.embeddingModels.length > 0) ||
      activeProviders[0];
    if (
      !defaultEmbedProvider ||
      defaultEmbedProvider.embeddingModels.length === 0
    ) {
      throw new Error('No available embedding models found.');
    }
    embeddingProviderId = defaultEmbedProvider.id;
    if (!embeddingKey) {
      embeddingKey = defaultEmbedProvider.embeddingModels[0].key;
    }
  }

  return {
    chatModel: { providerId: chatProviderId, key: chatKey },
    embeddingModel: { providerId: embeddingProviderId, key: embeddingKey },
  };
};

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
};

export const POST = async (req: Request): Promise<Response> => {
  try {
    // 1. Authenticate via API Key or session
    const rawApiKey = extractRawApiKey(req);
    let effectiveUserId: string | undefined;
    let effectiveApiKeyId: string | undefined;

    if (rawApiKey) {
      const keyValidation = await validateApiKey(rawApiKey);
      if (!keyValidation.success) {
        return Response.json(
          { message: keyValidation.error || 'Invalid API key' },
          {
            status: keyValidation.status || 401,
            headers: keyValidation.retryAfterSeconds
              ? {
                  'Retry-After': String(keyValidation.retryAfterSeconds),
                  'X-RateLimit-Remaining': '0',
                }
              : undefined,
          },
        );
      }
      effectiveApiKeyId = keyValidation.key?.id;
      effectiveUserId = keyValidation.user?.id;
    } else {
      const user = await resolveRequestUser(req);
      effectiveUserId = user?.id;
      effectiveApiKeyId = user?.apiKeyId;
    }

    let rawJson: any;
    try {
      rawJson = await req.json();
    } catch {
      return Response.json(
        { message: 'Invalid JSON payload in request body' },
        { status: 400 },
      );
    }

    const parseResult = searchRequestSchema.safeParse(rawJson);

    if (!parseResult.success) {
      return Response.json(
        {
          message: 'Invalid request body',
          errors: parseResult.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const body = parseResult.data;
    const registry = new ModelRegistry();

    let resolvedModels: {
      chatModel: ModelWithProvider;
      embeddingModel: ModelWithProvider;
    };

    try {
      resolvedModels = await resolveModels(body, registry);
    } catch (modelResolutionErr: any) {
      return Response.json(
        { message: modelResolutionErr?.message || 'Error resolving models' },
        { status: 400 },
      );
    }

    const [llm, embeddings] = await Promise.all([
      registry.loadChatModel(
        resolvedModels.chatModel.providerId,
        resolvedModels.chatModel.key,
      ),
      registry.loadEmbeddingModel(
        resolvedModels.embeddingModel.providerId,
        resolvedModels.embeddingModel.key,
      ),
    ]);

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      return msg[0] === 'human'
        ? { role: 'user', content: msg[1] }
        : { role: 'assistant', content: msg[1] };
    });

    const session = SessionManager.createSession();
    const agent = new APISearchAgent();

    let resolvedSources: SearchSources[] = ['web'];
    if (body.sources && body.sources.length > 0) {
      resolvedSources = body.sources as SearchSources[];
    } else if (body.focusMode) {
      const mode = body.focusMode.toLowerCase();
      if (mode.includes('academic')) resolvedSources = ['academic'];
      else if (mode.includes('writing') || mode.includes('assistant')) resolvedSources = [];
      else if (mode.includes('reddit') || mode.includes('discussion')) resolvedSources = ['discussions'];
      else resolvedSources = ['web'];
    }

    let effectiveSystemInstructions = body.systemInstructions || '';
    if (body.waypointId) {
      try {
        const wp = await db.query.waypoints.findFirst({
          where: eq(waypoints.id, body.waypointId),
        });
        if (wp?.systemInstructions) {
          effectiveSystemInstructions = [
            wp.systemInstructions,
            effectiveSystemInstructions,
          ]
            .filter(Boolean)
            .join('\n\n');
        }
      } catch {}
    }

    const userForLimit = await resolveRequestUser(req);
    const resolvedQualityLimit = userForLimit?.qualityModeTokenLimit ?? undefined;

    const queueHandle = providerQueueManager.enqueue({
      providerId: resolvedModels.chatModel.providerId,
      modelKey: resolvedModels.chatModel.key,
      taskType: 'search',
      title: body.query || 'Search Query',
      userId: effectiveUserId,
    });

    (async () => {
      try {
        await queueHandle.waitForTurn();

        agent.searchAsync(session, {
          chatHistory: history,
          signal: queueHandle.signal,
          config: {
            embedding: embeddings,
            llm: llm,
            sources: resolvedSources,
            mode: body.optimizationMode,
            fileIds: [],
            systemInstructions: effectiveSystemInstructions,
            providerId: resolvedModels.chatModel.providerId,
            modelKey: resolvedModels.chatModel.key,
            qualityModeTokenLimit: resolvedQualityLimit,
          },
          followUp: body.query,
          chatId: crypto.randomUUID(),
          messageId: crypto.randomUUID(),
          apiKeyId: effectiveApiKeyId,
          userId: effectiveUserId,
          source: 'api',
        });
      } catch (err: any) {
        queueHandle.finish(err);
        session.emit('error', {
          data: err?.message || 'Search execution failed in queue',
        });
      }
    })();

    if (!body.stream) {
      return new Promise(
        (
          resolve: (value: Response) => void,
          reject: (value: Response) => void,
        ) => {
          let message = '';
          let sources: any[] = [];

          session.subscribe((event: string, data: Record<string, any>) => {
            if (event === 'data') {
              try {
                if (data.type === 'response') {
                  message += data.data;
                } else if (data.type === 'searchResults') {
                  sources = data.data;
                }
              } catch (error) {
                queueHandle.finish(error);
                reject(
                  Response.json(
                    { message: 'Error parsing data' },
                    { status: 500 },
                  ),
                );
              }
            }

            if (event === 'end') {
              queueHandle.finish();
              resolve(Response.json({ message, sources }, { status: 200 }));
            }

            if (event === 'error') {
              queueHandle.finish(data);
              reject(
                Response.json(
                  { message: 'Search error', error: data },
                  { status: 500 },
                ),
              );
            }
          });
        },
      );
    }

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const { signal } = abortController;

    const stream = new ReadableStream({
      start(controller) {
        let sources: any[] = [];

        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'init',
              data: 'Stream connected',
              queueStatus: queueHandle.task.status,
              queuePosition: queueHandle.task.position,
            }) + '\n',
          ),
        );

        signal.addEventListener('abort', () => {
          // A disconnected client never cancels the task itself — it keeps
          // running (or waiting its turn) and gets persisted by
          // agent.searchAsync, so it's there when revisited. We only stop
          // writing to this now-dead stream; removeAllListeners() here would
          // prevent 'end' from ever reaching finish(), leaving the queue
          // slot stuck as "active" forever.
          try {
            controller.close();
          } catch (error) {}
        });

        session.subscribe((event: string, data: Record<string, any>) => {
          if (event === 'data') {
            if (signal.aborted) return;

            try {
              if (data.type === 'response') {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'response',
                      data: data.data,
                    }) + '\n',
                  ),
                );
              } else if (data.type === 'searchResults') {
                sources = data.data;
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'sources',
                      data: sources,
                    }) + '\n',
                  ),
                );
              }
            } catch (error) {
              queueHandle.finish(error);
              controller.error(error);
            }
          }

          if (event === 'end') {
            queueHandle.finish();
            if (signal.aborted) return;

            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'done',
                }) + '\n',
              ),
            );
            controller.close();
          }

          if (event === 'error') {
            queueHandle.finish(data);
            if (signal.aborted) return;

            controller.error(data);
          }
        });
      },
      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error(`Error in getting search results: ${err.message}`);
    return Response.json(
      { message: err?.message || 'An error has occurred.' },
      { status: 500 },
    );
  }
};
