export const dynamic = 'force-dynamic';

import db from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, or, isNull, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
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

