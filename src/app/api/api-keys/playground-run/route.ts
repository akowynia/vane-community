import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import APISearchAgent from '@/lib/agents/search/api';
import { resolveRequestUser } from '@/lib/security/rbac';
import { checkApiKeyRateLimit, validateApiKey } from '@/lib/security/apiKeys';
import db from '@/lib/db';
import { apiKeys, waypoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import providerQueueManager from '@/lib/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const playgroundRequestSchema = z.object({
  keyId: z.string().optional(),
  apiKeyId: z.string().optional(),
  rawApiKey: z.string().optional(),
  query: z.string().min(1, 'Search query is required'),
  sources: z.array(z.string()).optional(),
  focusMode: z.string().optional(),
  chatModel: z.union([
    z.object({
      providerId: z.string().optional(),
      provider: z.string().optional(),
      key: z.string().optional(),
      name: z.string().optional(),
      model: z.string().optional(),
    }),
    z.string(),
  ]).optional(),
  embeddingModel: z.union([
    z.object({
      providerId: z.string().optional(),
      provider: z.string().optional(),
      key: z.string().optional(),
      name: z.string().optional(),
      model: z.string().optional(),
    }),
    z.string(),
  ]).optional(),
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

type PlaygroundRequestBody = z.infer<typeof playgroundRequestSchema>;

const resolveModels = async (
  body: PlaygroundRequestBody,
  registry: ModelRegistry,
): Promise<{ chatModel: ModelWithProvider; embeddingModel: ModelWithProvider }> => {
  let rawChatModel = body.chatModel;
  let chatKey: string | undefined;
  let chatProviderId: string | undefined;

  if (typeof rawChatModel === 'string') {
    chatKey = rawChatModel;
  } else if (rawChatModel && typeof rawChatModel === 'object') {
    chatKey = rawChatModel.key || rawChatModel.name || rawChatModel.model;
    chatProviderId = rawChatModel.providerId || rawChatModel.provider;
  }

  let rawEmbeddingModel = body.embeddingModel;
  let embeddingKey: string | undefined;
  let embeddingProviderId: string | undefined;

  if (typeof rawEmbeddingModel === 'string') {
    embeddingKey = rawEmbeddingModel;
  } else if (rawEmbeddingModel && typeof rawEmbeddingModel === 'object') {
    embeddingKey = rawEmbeddingModel.key || rawEmbeddingModel.name || rawEmbeddingModel.model;
    embeddingProviderId = rawEmbeddingModel.providerId || rawEmbeddingModel.provider;
  }

  const activeProviders = await registry.getActiveProviders();

  if (activeProviders.length === 0) {
    throw new Error('No active model providers found.');
  }

  if (chatProviderId) {
    const target = chatProviderId.toLowerCase();
    const matched = activeProviders.find(
      (p) =>
        p.id === chatProviderId ||
        (p.type && p.type.toLowerCase() === target) ||
        (p.name && p.name.toLowerCase() === target),
    );
    if (matched) chatProviderId = matched.id;
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
    if (found) chatProviderId = found.id;
  }

  if (!chatProviderId || !chatKey) {
    const defaultChatProvider =
      activeProviders.find((p) => p.chatModels.length > 0) || activeProviders[0];
    if (!defaultChatProvider || defaultChatProvider.chatModels.length === 0) {
      throw new Error('No available chat models found.');
    }
    chatProviderId = defaultChatProvider.id;
    if (!chatKey) chatKey = defaultChatProvider.chatModels[0].key;
  }

  if (embeddingProviderId) {
    const target = embeddingProviderId.toLowerCase();
    const matched = activeProviders.find(
      (p) =>
        p.id === embeddingProviderId ||
        (p.type && p.type.toLowerCase() === target) ||
        (p.name && p.name.toLowerCase() === target),
    );
    if (matched) embeddingProviderId = matched.id;
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
    if (found) embeddingProviderId = found.id;
  }

  if (!embeddingProviderId || !embeddingKey) {
    const defaultEmbedProvider =
      activeProviders.find((p) => p.embeddingModels.length > 0) || activeProviders[0];
    if (!defaultEmbedProvider || defaultEmbedProvider.embeddingModels.length === 0) {
      throw new Error('No available embedding models found.');
    }
    embeddingProviderId = defaultEmbedProvider.id;
    if (!embeddingKey) embeddingKey = defaultEmbedProvider.embeddingModels[0].key;
  }

  return {
    chatModel: { providerId: chatProviderId, key: chatKey },
    embeddingModel: { providerId: embeddingProviderId, key: embeddingKey },
  };
};

export const POST = async (req: NextRequest): Promise<Response> => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return Response.json(
        { message: 'Login required to use the Playground.' },
        { status: 401 },
      );
    }

    let rawJson: any;
    try {
      rawJson = await req.json();
    } catch {
      return Response.json(
        { message: 'Invalid JSON format in request' },
        { status: 400 },
      );
    }

    const parseResult = playgroundRequestSchema.safeParse(rawJson);
    if (!parseResult.success) {
      return Response.json(
        {
          message: 'Request validation error',
          errors: parseResult.error.issues.map((i) => i.message),
        },
        { status: 400 },
      );
    }

    const body = parseResult.data;
    let effectiveApiKeyId: string | undefined;
    const targetKeyId = body.keyId || body.apiKeyId;
    let rateLimitInfo: { limit: number; remaining: number; resetSeconds: number } | null = null;

    // 1. Verify and rate-limit API Key if keyId or rawApiKey provided
    if (targetKeyId) {
      const keyRecord = await db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, targetKeyId),
      });

      if (!keyRecord) {
        return Response.json(
          { message: 'The selected API key does not exist' },
          { status: 404 },
        );
      }

      const isAdmin = user.role === 'admin';
      if (!isAdmin && keyRecord.userId !== user.id) {
        return Response.json(
          { message: 'You do not have permission to use this API key' },
          { status: 403 },
        );
      }

      if (keyRecord.status !== 'active') {
        return Response.json(
          { message: `API key is inactive (${keyRecord.status})` },
          { status: 403 },
        );
      }

      const rateLimit = checkApiKeyRateLimit(keyRecord.id, keyRecord.rateLimitPerMinute);
      rateLimitInfo = {
        limit: keyRecord.rateLimitPerMinute,
        remaining: rateLimit.remaining,
        resetSeconds: rateLimit.resetSeconds,
      };

      if (!rateLimit.allowed) {
        return Response.json(
          {
            message: `Request limit exceeded for this key (${keyRecord.rateLimitPerMinute} req/min). Try again in ${rateLimit.resetSeconds}s.`,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.resetSeconds),
              'X-RateLimit-Limit': String(keyRecord.rateLimitPerMinute),
              'X-RateLimit-Remaining': String(rateLimit.remaining),
              'X-RateLimit-Reset': String(rateLimit.resetSeconds),
            },
          },
        );
      }

      effectiveApiKeyId = keyRecord.id;
      db.update(apiKeys)
        .set({ lastUsedAt: new Date().toISOString() })
        .where(eq(apiKeys.id, keyRecord.id))
        .execute()
        .catch(() => {});
    } else if (body.rawApiKey) {
      const validation = await validateApiKey(body.rawApiKey);
      if (!validation.success) {
        return Response.json(
          { message: validation.error || 'Invalid API key' },
          {
            status: validation.status || 401,
            headers: validation.retryAfterSeconds
              ? { 'Retry-After': String(validation.retryAfterSeconds) }
              : undefined,
          },
        );
      }
      effectiveApiKeyId = validation.key?.id;
    }

    // 2. Resolve models
    const registry = new ModelRegistry();
    let resolvedModels: {
      chatModel: ModelWithProvider;
      embeddingModel: ModelWithProvider;
    };

    try {
      resolvedModels = await resolveModels(body, registry);
    } catch (err: any) {
      return Response.json(
        { message: err?.message || 'Error resolving models' },
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

    const history: ChatTurnMessage[] = body.history.map((msg) => ({
      role: msg[0] === 'human' ? 'user' : 'assistant',
      content: msg[1],
    }));

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

    const startTime = Date.now();
    const chatId = crypto.randomUUID();
    const messageId = crypto.randomUUID();

    const queueHandle = providerQueueManager.enqueue({
      providerId: resolvedModels.chatModel.providerId,
      modelKey: resolvedModels.chatModel.key,
      taskType: 'playground',
      title: `Playground: ${body.query.slice(0, 40)}`,
      userId: user.id,
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
          },
          followUp: body.query,
          chatId,
          messageId,
          apiKeyId: effectiveApiKeyId,
          userId: user.id,
          source: 'api',
        });
      } catch (err: any) {
        queueHandle.finish(err);
        session.emit('error', {
          data: err?.message || 'Playground execution failed in queue',
        });
      }
    })();

    const responseHeaders: Record<string, string> = {};
    if (rateLimitInfo) {
      responseHeaders['X-RateLimit-Limit'] = String(rateLimitInfo.limit);
      responseHeaders['X-RateLimit-Remaining'] = String(rateLimitInfo.remaining);
      responseHeaders['X-RateLimit-Reset'] = String(rateLimitInfo.resetSeconds);
    }

    if (!body.stream) {
      return new Promise<Response>((resolve) => {
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
            } catch (err) {
              queueHandle.finish(err);
              resolve(
                Response.json(
                  { message: 'Error parsing response' },
                  { status: 500, headers: responseHeaders },
                ),
              );
            }
          }

          if (event === 'end') {
            queueHandle.finish();
            const durationMs = Date.now() - startTime;
            resolve(
              Response.json(
                {
                  message,
                  sources,
                  metadata: {
                    durationMs,
                    chatModel: resolvedModels.chatModel,
                    apiKeyId: effectiveApiKeyId,
                    sources: resolvedSources,
                  },
                },
                { status: 200, headers: responseHeaders },
              ),
            );
          }

          if (event === 'error') {
            queueHandle.finish(data);
            resolve(
              Response.json(
                { message: 'Search agent error', error: data },
                { status: 500, headers: responseHeaders },
              ),
            );
          }
        });
      });
    }

    // Streaming SSE
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const { signal } = abortController;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: 'init',
              data: 'Playground stream connected',
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
          } catch {}
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
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({
                      type: 'sources',
                      data: data.data,
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
                  durationMs: Date.now() - startTime,
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
        ...responseHeaders,
      },
    });
  } catch (err: any) {
    console.error('Playground run error:', err);
    return Response.json(
      { message: err?.message || 'Query execution error' },
      { status: 500 },
    );
  }
};
