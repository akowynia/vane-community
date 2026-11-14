export const dynamic = 'force-dynamic';

import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq, or, isNull, and, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import {
  canDeleteOwnedEntity,
  chunkIds,
  parseBulkDeleteIds,
  requireDeleteActor,
} from '@/lib/security/bulkDelete';
import configManager from '@/lib/config';

export const GET = async (req: Request) => {
  try {
    const url = new URL(req.url);
    const waypointId = url.searchParams.get('waypointId');
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    let chatsList: any[] = [];
    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ chats: [] }, { status: 200 });
      }

      if (user.role === 'admin') {
        chatsList = await db.query.chats.findMany({
          where: waypointId ? eq(chats.waypointId, waypointId) : undefined,
        });
      } else {
        const userCondition = or(eq(chats.userId, user.id), isNull(chats.userId));
        chatsList = await db.query.chats.findMany({
          where: waypointId ? and(userCondition, eq(chats.waypointId, waypointId)) : userCondition,
        });
      }
    } else {
      chatsList = await db.query.chats.findMany({
        where: waypointId ? eq(chats.waypointId, waypointId) : undefined,
      });
    }

    const sanitizedChats = (chatsList || []).map((chat: any) => {
      let sources = chat.sources;
      if (typeof sources === 'string') {
        try {
          sources = JSON.parse(sources);
        } catch {
          sources = [];
        }
      }
      let files = chat.files;
      if (typeof files === 'string') {
        try {
          files = JSON.parse(files);
        } catch {
          files = [];
        }
      }
      return {
        ...chat,
        sources: Array.isArray(sources) ? sources : [],
        files: Array.isArray(files) ? files : [],
      };
    });

    return Response.json({ chats: sanitizedChats.reverse() }, { status: 200 });
  } catch (err: any) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: err?.message || 'An error has occurred.', chats: [] },
      { status: 500 },
    );
  }
};

export const DELETE = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const authError = requireDeleteActor(user, instanceMode);
    if (authError) {
      return authError;
    }

    const parsed = await parseBulkDeleteIds(req);
    if ('errorResponse' in parsed) {
      return parsed.errorResponse;
    }

    const { ids } = parsed;
    const existingChats: { id: string; userId: string | null }[] = [];

    for (const chunk of chunkIds(ids)) {
      const rows = await db.query.chats.findMany({
        where: inArray(chats.id, chunk),
        columns: {
          id: true,
          userId: true,
        },
      });
      existingChats.push(...rows);
    }

    if (existingChats.length === 0) {
      return Response.json(
        { message: 'No matching chats found.', deletedIds: [], deletedCount: 0 },
        { status: 404 },
      );
    }

    const deletableIds = existingChats
      .filter((chat) =>
        canDeleteOwnedEntity({
          user,
          instanceMode,
          ownerUserId: chat.userId,
        }),
      )
      .map((chat) => chat.id);

    if (deletableIds.length === 0) {
      return Response.json(
        {
          message: 'You do not have permission to delete the selected chats.',
          deletedIds: [],
          deletedCount: 0,
        },
        { status: 403 },
      );
    }

    // Preserve model_stats rows so usage telemetry and token limits cannot be bypassed.
    db.transaction((tx) => {
      for (const chunk of chunkIds(deletableIds)) {
        tx.delete(messages).where(inArray(messages.chatId, chunk)).run();
        tx.delete(chats).where(inArray(chats.id, chunk)).run();
      }
    });

    const deletedSet = new Set(deletableIds);
    const skippedIds = ids.filter((id) => !deletedSet.has(id));

    return Response.json(
      {
        message: 'Chats deleted successfully.',
        deletedIds: deletableIds,
        skippedIds,
        deletedCount: deletableIds.length,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error in bulk deleting chats:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete chats.' },
      { status: 500 },
    );
  }
};

