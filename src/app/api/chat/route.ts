import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { ChatTurnMessage } from '@/lib/types';
import { SearchSources } from '@/lib/agents/search/types';
import db from '@/lib/db';
import { eq } from 'drizzle-orm';
import { chats, messages, waypoints } from '@/lib/db/schema';
import UploadManager from '@/lib/uploads/manager';
import { NextRequest } from 'next/server';
import configManager from '@/lib/config';
import providerQueueManager from '@/lib/queue';
import {
  resolveRequestUser,
  canAccessProvider,
  canAccessModel,
  checkTokenUsage,
} from '@/lib/security/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  messageId: z.string().min(1, 'Message ID is required'),
  chatId: z.string().min(1, 'Chat ID is required'),
  content: z.string().min(1, 'Message content is required'),
});

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const embeddingModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({
    message: 'Embedding model provider id must be provided',
  }),
  key: z.string({ message: 'Embedding model key must be provided' }),
});

const bodySchema = z.object({
  message: messageSchema,
  optimizationMode: z.enum(['speed', 'balanced', 'quality'], {
    message: 'Optimization mode must be one of: speed, balanced, quality',
  }),
  sources: z.array(z.string()).optional().default([]),
  history: z
    .array(z.tuple([z.string(), z.string()]))
    .optional()
    .default([]),
  files: z.array(z.string()).optional().default([]),
  chatModel: chatModelSchema,
  embeddingModel: embeddingModelSchema,
  systemInstructions: z.string().nullable().optional().default(''),
  waypointId: z.string().nullable().optional(),
});

type Body = z.infer<typeof bodySchema>;

const safeValidateBody = (data: unknown) => {
  const result = bodySchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: any) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }

  return {
    success: true,
    data: result.data,
  };
};

const ensureChatExists = async (input: {
  id: string;
  sources: SearchSources[];
  query: string;
  fileIds: string[];
  userId?: string | null;
  waypointId?: string | null;
}) => {
  try {
    const exists = await db.query.chats
      .findFirst({
        where: eq(chats.id, input.id),
      })
      .execute();

    if (!exists) {
      await db.insert(chats).values({
        id: input.id,
        createdAt: new Date().toISOString(),
        userId: input.userId || null,
        waypointId: input.waypointId || null,
        sources: Array.isArray(input.sources) ? input.sources : [],
        title: input.query,
        files: Array.isArray(input.fileIds)
          ? input.fileIds.map((id) => {
              return {
                fileId: id,
                name: UploadManager.getFile(id)?.name || 'Uploaded File',
              };
            })
          : [],
      });
    } else if (input.waypointId !== undefined && exists.waypointId !== input.waypointId) {
      await db
        .update(chats)
        .set({ waypointId: input.waypointId || null })
        .where(eq(chats.id, input.id))
        .execute();
    }
  } catch (err) {
    console.error('Failed to check/save chat:', err);
  }
};

export const POST = async (req: Request) => {
  try {
    const reqBody = (await req.json()) as Body;

    const parseBody = safeValidateBody(reqBody);

    if (!parseBody.success) {
      return Response.json(
        { message: 'Invalid request body', error: parseBody.error },
        { status: 400 },
      );
    }

    const body = parseBody.data as Body;
    const { message } = body;

    // 1. Authenticate user & RBAC
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    if (instanceMode === 'multi' && !user) {
      return Response.json(
        { message: 'Login required to use chat.' },
        { status: 401 },
      );
    }

    if (user && user.role !== 'admin') {
      if (!canAccessProvider(user, body.chatModel?.providerId)) {
        return Response.json(
          { message: 'You do not have permission to use this AI provider.' },
          { status: 403 },
        );
      }
      if (!canAccessModel(user, body.chatModel?.key)) {
        return Response.json(
          { message: 'You do not have permission to use this AI model.' },
          { status: 403 },
        );
      }

      // Check rolling window limits (5h, weekly, daily, monthly)
      const usage = await checkTokenUsage(user);
      if (usage.limit5hExceeded) {
        return Response.json(
          {
            message: `5-hour token limit exceeded (${usage.tokensLast5h.toLocaleString()} / ${user.tokenLimit5h?.toLocaleString()}). Please try again later.`,
          },
          { status: 429 },
        );
      }
      if (usage.limitWeeklyExceeded) {
        return Response.json(
          {
            message: `Weekly token limit exceeded (${usage.tokensWeekly.toLocaleString()} / ${user.tokenLimitWeekly?.toLocaleString()}).`,
          },
          { status: 429 },
        );
      }
      if (usage.dayLimitExceeded) {
        return Response.json(
          {
            message: `Daily token limit exceeded (${usage.tokensLast24h.toLocaleString()} / ${user.tokenLimitPerDay?.toLocaleString()}).`,
          },
          { status: 429 },
        );
      }
    }

    if (message.content === '') {
      return Response.json(
        {
          message: 'Please provide a message to process',
        },
        { status: 400 },
      );
    }

    if (!body.chatModel?.providerId || !body.chatModel?.key) {
      return Response.json(
        {
          message:
            'Missing or invalid chat model configuration. Please select a valid chat model in Settings.',
        },
        { status: 400 },
      );
    }

    if (!body.embeddingModel?.providerId || !body.embeddingModel?.key) {
      return Response.json(
        {
          message:
            'Missing or invalid embedding model configuration. Please select a valid embedding model in Settings.',
        },
        { status: 400 },
      );
    }

    const registry = new ModelRegistry();
    let llm: any;
    let embedding: any;
    try {
      [llm, embedding] = await Promise.all([
        registry.loadChatModel(body.chatModel.providerId, body.chatModel.key),
        registry.loadEmbeddingModel(
          body.embeddingModel.providerId,
          body.embeddingModel.key,
        ),
      ]);
    } catch (loadErr: any) {
      console.error('Failed to load chat or embedding model:', loadErr);
      return Response.json(
        {
          message:
            loadErr?.message ||
            'Failed to load selected chat or embedding model. Please check your model settings.',
        },
        { status: 400 },
      );
    }

    const history: ChatTurnMessage[] = body.history.map((msg) => {
      if (msg[0] === 'human') {
        return {
          role: 'user',
          content: msg[1],
        };
      } else {
        return {
          role: 'assistant',
          content: msg[1],
        };
      }
    });

    const agent = new SearchAgent();
    const session = SessionManager.createSession();

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    let isClosed = false;
    const safeWrite = async (data: string) => {
      if (isClosed) return;
      try {
        await writer.write(encoder.encode(data));
      } catch {
        isClosed = true;
      }
    };

    const safeClose = async () => {
      if (isClosed) return;
      isClosed = true;
      try {
        await writer.close();
      } catch {}
    };

    // Heartbeat every 15 seconds to keep the SSE connection alive during long tasks (proxy, cloudflare, docker)
    const heartbeatInterval = setInterval(() => {
      if (isClosed) {
        clearInterval(heartbeatInterval);
        return;
      }
      safeWrite(JSON.stringify({ type: 'ping' }) + '\n');
    }, 15000);

    // Enqueue task in Provider Queue Manager
    const queueHandle = providerQueueManager.enqueue({
      providerId: body.chatModel.providerId,
      modelKey: body.chatModel.key,
      taskType: 'chat',
      title: body.message.content || 'Chat Query',
      chatId: body.message.chatId,
      messageId: body.message.messageId,
      userId: user?.id,
    });

    const cleanup = () => {
      clearInterval(heartbeatInterval);
      disconnect();
      safeClose();
    };

    const disconnect = session.subscribe((event: string, data: any) => {
      if (event === 'data') {
        if (data.type === 'block') {
          safeWrite(
            JSON.stringify({
              type: 'block',
              block: data.block,
            }) + '\n',
          );
        } else if (data.type === 'updateBlock') {
          safeWrite(
            JSON.stringify({
              type: 'updateBlock',
              blockId: data.blockId,
              patch: data.patch,
            }) + '\n',
          );
        } else if (data.type === 'researchComplete') {
          safeWrite(
            JSON.stringify({
              type: 'researchComplete',
            }) + '\n',
          );
        }
      } else if (event === 'end') {
        queueHandle.finish();
        safeWrite(
          JSON.stringify({
            type: 'messageEnd',
          }) + '\n',
        ).finally(() => {
          cleanup();
          session.removeAllListeners();
        });
      } else if (event === 'error') {
        queueHandle.finish(data.data);
        safeWrite(
          JSON.stringify({
            type: 'error',
            data: data.data,
          }) + '\n',
        ).finally(() => {
          cleanup();
          session.removeAllListeners();
        });
      }
    });

    // If currently queued, emit initial queue status chunk to the client and subscribe to position changes
    if (queueHandle.task.status === 'queued') {
      safeWrite(
        JSON.stringify({
          type: 'queueStatus',
          status: 'queued',
          position: queueHandle.task.position,
          modelKey: body.chatModel.key,
          providerId: body.chatModel.providerId,
        }) + '\n',
      );

      queueHandle.onPositionChange = (newPos: number) => {
        safeWrite(
          JSON.stringify({
            type: 'queueStatus',
            status: 'queued',
            position: newPos,
            modelKey: body.chatModel.key,
            providerId: body.chatModel.providerId,
          }) + '\n',
        );
      };
    }

    // Resolve active waypoint and its masterprompt (system instructions)
    let activeWaypointId = body.waypointId || null;
    if (!activeWaypointId && body.message.chatId) {
      try {
        const existingChat = await db.query.chats.findFirst({
          where: eq(chats.id, body.message.chatId),
        });
        if (existingChat?.waypointId) {
          activeWaypointId = existingChat.waypointId;
        }
      } catch (wpQueryErr) {
        console.warn('Failed to resolve existing chat waypoint:', wpQueryErr);
      }
    }

    let effectiveSystemInstructions = body.systemInstructions || '';
    if (activeWaypointId) {
      try {
        const waypoint = await db.query.waypoints.findFirst({
          where: eq(waypoints.id, activeWaypointId),
        });
        if (waypoint?.systemInstructions) {
          effectiveSystemInstructions = [
            waypoint.systemInstructions,
            body.systemInstructions,
          ]
            .filter(Boolean)
            .join('\n\n');
        }
      } catch (wpErr) {
        console.warn('Failed to load waypoint system instructions:', wpErr);
      }
    }

    // Execute when turn arrives in queue
    (async () => {
      try {
        await queueHandle.waitForTurn();

        // Emit running queueStatus
        safeWrite(
          JSON.stringify({
            type: 'queueStatus',
            status: 'running',
            modelKey: body.chatModel.key,
            providerId: body.chatModel.providerId,
          }) + '\n',
        );

        await agent.searchAsync(session, {
          chatHistory: history,
          followUp: message.content,
          chatId: body.message.chatId,
          messageId: body.message.messageId,
          signal: queueHandle.signal,
          config: {
            llm,
            embedding: embedding,
            sources: body.sources as SearchSources[],
            mode: body.optimizationMode,
            fileIds: body.files,
            systemInstructions: effectiveSystemInstructions || 'None',
            providerId: body.chatModel.providerId,
            modelKey: body.chatModel.key,
            qualityModeTokenLimit: user?.qualityModeTokenLimit ?? undefined,
          },
        });
      } catch (err: any) {
        if (
          req.signal.aborted ||
          err?.message === 'Client disconnected' ||
          err?.name === 'AbortError'
        ) {
          queueHandle.finish('Client disconnected');
          return;
        }
        console.error('Error during search execution:', err);
        queueHandle.finish(err);
        try {
          session.emit('error', {
            data: err?.message || 'An unexpected error occurred during search.',
          });
        } catch {}
      }
    })();

    await ensureChatExists({
      id: body.message.chatId,
      sources: body.sources as SearchSources[],
      fileIds: body.files,
      query: body.message.content,
      userId: user?.id || null,
      waypointId: activeWaypointId,
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err: any) {
    console.error('An error occurred while processing chat request:', err);
    return Response.json(
      {
        message:
          err?.message || 'An error occurred while processing chat request',
      },
      { status: 500 },
    );
  }
};
