import db from '@/lib/db';
import { chats, messages, modelStats, waypoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';

import SessionManager from '@/lib/session';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
      if (user.role !== 'admin' && chatExists.userId && chatExists.userId !== user.id) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    const chatMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, id),
    });

    const chatStats = await db.query.modelStats.findMany({
      where: eq(modelStats.chatId, id),
    });

    // Auto-recovery: if a message in the database has status 'answering' but the in-memory session
    // no longer exists, mark it as 'error' so the user doesn't end up with a stuck thread after refreshing.
    const reconciledMessages = await Promise.all(
      chatMessages.map(async (msg) => {
        let finalStatus = msg.status;
        if (msg.status === 'answering') {
          const activeSession = SessionManager.getSession(msg.backendId);
          if (!activeSession) {
            try {
              await db
                .update(messages)
                .set({ status: 'error' })
                .where(eq(messages.id, msg.id))
                .execute();
              finalStatus = 'error' as const;
            } catch (updateErr) {
              console.warn('Failed to reconcile message status:', updateErr);
            }
          }
        }

        const blocks = Array.isArray(msg.responseBlocks) ? [...msg.responseBlocks] : [];
        if (!blocks.some((b: any) => b.type === 'metrics')) {
          const stat = chatStats.find(
            (s) => s.messageId === msg.messageId && s.step === 'answer',
          );
          if (stat) {
            blocks.push({
              id: `stat-${stat.id}`,
              type: 'metrics',
              data: {
                modelKey: stat.modelKey,
                providerId: stat.providerId,
                durationMs: stat.durationMs,
                promptTokens: stat.promptTokens,
                completionTokens: stat.completionTokens,
                totalTokens: stat.totalTokens,
              },
            } as any);
          }
        }

        return {
          ...msg,
          status: finalStatus,
          responseBlocks: blocks,
        };
      }),
    );

    let sources = chatExists.sources;
    if (typeof sources === 'string') {
      try {
        sources = JSON.parse(sources);
      } catch {
        sources = [];
      }
    }
    let files = chatExists.files;
    if (typeof files === 'string') {
      try {
        files = JSON.parse(files);
      } catch {
        files = [];
      }
    }

    let waypointInfo = null;
    if (chatExists.waypointId) {
      try {
        waypointInfo = await db.query.waypoints.findFirst({
          where: eq(waypoints.id, chatExists.waypointId),
        });
      } catch (wpErr) {
        console.warn('Failed to load waypoint for chat:', wpErr);
      }
    }

    const sanitizedChat = {
      ...chatExists,
      sources: Array.isArray(sources) ? sources : [],
      files: Array.isArray(files) ? files : [],
      waypoint: waypointInfo,
    };

    return Response.json(
      {
        chat: sanitizedChat,
        messages: reconciledMessages,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in getting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
      if (user.role !== 'admin' && chatExists.userId && chatExists.userId !== user.id) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const waypointId = body.waypointId !== undefined ? body.waypointId : undefined;

    if (waypointId !== undefined) {
      if (waypointId) {
        const wp = await db.query.waypoints.findFirst({
          where: eq(waypoints.id, waypointId),
        });
        if (!wp) {
          return Response.json({ message: 'Waypoint not found' }, { status: 404 });
        }
      }

      await db
        .update(chats)
        .set({ waypointId: waypointId || null })
        .where(eq(chats.id, id))
        .execute();
    }

    return Response.json(
      { success: true, waypointId: waypointId || null },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in patching chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
      if (user.role !== 'admin' && chatExists.userId && chatExists.userId !== user.id) {
        return Response.json({ message: 'Forbidden' }, { status: 403 });
      }
    }

    await db.delete(chats).where(eq(chats.id, id)).execute();
    await db.delete(messages).where(eq(messages.chatId, id)).execute();

    return Response.json(
      { message: 'Chat deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting chat by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
