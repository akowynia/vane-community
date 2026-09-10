import db, { ensureWaypointCronsTable } from '@/lib/db';
import { waypointCrons, waypoints, chats, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import SearchAgent from '@/lib/agents/search';
import SessionManager from '@/lib/session';
import { SearchSources } from '@/lib/agents/search/types';
import { computeNextRun } from './parser';
import configManager from '@/lib/config';
import crypto from 'crypto';
import providerQueueManager from '@/lib/queue';

export interface ExecuteCronResult {
  success: boolean;
  chatId?: string;
  error?: string;
}

export async function executeCronJob(cronId: string): Promise<ExecuteCronResult> {
  ensureWaypointCronsTable();
  const now = new Date();

  const cron = await db.query.waypointCrons.findFirst({
    where: eq(waypointCrons.id, cronId),
  });

  if (!cron) {
    return { success: false, error: 'Scheduled task not found.' };
  }

  // Set running status
  await db
    .update(waypointCrons)
    .set({
      lastStatus: 'running',
      updatedAt: now.toISOString(),
    })
    .where(eq(waypointCrons.id, cronId));

  const nextRunDate = computeNextRun(cron.schedule, now, cron.timezone || 'UTC');
  const nextRunAtIso = nextRunDate ? nextRunDate.toISOString() : null;

  try {
    // 1. Fetch waypoint
    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, cron.waypointId),
    });

    if (!waypoint) {
      throw new Error(`Associated waypoint (${cron.waypointId}) does not exist.`);
    }

    // 2. Multi-user & User validation if applicable
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    let user = null;
    if (instanceMode === 'multi' && cron.userId) {
      user = await db.query.users.findFirst({
        where: eq(users.id, cron.userId),
      });
      if (user && user.status === 'disabled') {
        throw new Error('The user account associated with this task is disabled.');
      }
    }

    // 3. Load Models
    const registry = new ModelRegistry();
    let llm: any;
    let embedding: any;

    try {
      llm = await registry.loadChatModel(cron.chatModelProvider, cron.chatModelKey);
    } catch (err: any) {
      throw new Error(`Failed to load LLM model (${cron.chatModelProvider}/${cron.chatModelKey}): ${err?.message || err}`);
    }

    try {
      if (cron.embeddingModelProvider && cron.embeddingModelKey) {
        embedding = await registry.loadEmbeddingModel(
          cron.embeddingModelProvider,
          cron.embeddingModelKey,
        );
      } else {
        // Fallback to active embedding providers
        const active = registry.activeProviders;
        let loaded = false;
        for (const p of active) {
          const mList = p.embeddingModels || [];
          if (mList.length > 0) {
            try {
              embedding = await registry.loadEmbeddingModel(p.id, mList[0].key);
              loaded = true;
              break;
            } catch {}
          }
        }
        if (!loaded) {
          // If no embedding model found, try default
          try {
            embedding = await registry.loadEmbeddingModel('default', 'default');
          } catch {}
        }
      }
    } catch (embErr) {
      console.warn('Embedding model loading warning during cron:', embErr);
    }

    // 4. Resolve effective system instructions (Masterprompt)
    const effectiveSystemInstructions = [
      waypoint.systemInstructions,
      cron.systemInstructions,
    ]
      .filter(Boolean)
      .join('\n\n');

    // 5. Create new chat record for this cron execution
    const chatId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const safeSources = Array.isArray(cron.sources) ? cron.sources : ['web'];

    const chatTitle = cron.name
      ? `${cron.name} - ${now.toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      : cron.prompt;

    await db.insert(chats).values({
      id: chatId,
      title: chatTitle,
      createdAt: now.toISOString(),
      userId: cron.userId || null,
      waypointId: cron.waypointId,
      sources: safeSources as SearchSources[],
      files: [],
    });

    // 6. Enqueue & Run SearchAgent
    const queueHandle = providerQueueManager.enqueue({
      providerId: cron.chatModelProvider,
      modelKey: cron.chatModelKey,
      taskType: 'cron',
      title: cron.name ? `Cron: ${cron.name}` : `Cron: ${cron.prompt}`,
      chatId: chatId,
      messageId: messageId,
      userId: cron.userId || undefined,
    });

    try {
      await queueHandle.waitForTurn();

      const agent = new SearchAgent();
      const session = SessionManager.createSession();

      await agent.searchAsync(session, {
        chatHistory: [],
        followUp: cron.prompt,
        chatId: chatId,
        messageId: messageId,
        signal: queueHandle.signal,
        config: {
          llm,
          embedding,
          sources: safeSources as SearchSources[],
          mode: (cron.optimizationMode as 'speed' | 'balanced' | 'quality') || 'balanced',
          fileIds: [],
          systemInstructions: effectiveSystemInstructions || 'None',
          providerId: cron.chatModelProvider,
          modelKey: cron.chatModelKey,
        },
      });

      // Clean up session listeners and finish queue task
      session.removeAllListeners();
      queueHandle.finish();
    } catch (execErr: any) {
      queueHandle.finish(execErr);
      throw execErr;
    }

    // 7. Update cron on success
    await db
      .update(waypointCrons)
      .set({
        lastRunAt: now.toISOString(),
        nextRunAt: nextRunAtIso,
        lastStatus: 'success',
        lastError: null,
        lastChatId: chatId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(waypointCrons.id, cronId));

    return { success: true, chatId };
  } catch (err: any) {
    console.error(`Error executing cron job (${cronId}):`, err);
    const errorMessage = err?.message || 'Unexpected error while executing the task.';

    await db
      .update(waypointCrons)
      .set({
        lastRunAt: now.toISOString(),
        nextRunAt: nextRunAtIso,
        lastStatus: 'error',
        lastError: errorMessage,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(waypointCrons.id, cronId));

    return { success: false, error: errorMessage };
  }
}
