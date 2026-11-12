export const dynamic = 'force-dynamic';

import db, { ensureWaypointsTable } from '@/lib/db';
import { waypoints, chats } from '@/lib/db/schema';
import { eq, or, isNull, desc, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import {
  canDeleteOwnedEntity,
  chunkIds,
  parseBulkDeleteIds,
  requireDeleteActor,
} from '@/lib/security/bulkDelete';
import configManager from '@/lib/config';
import { z } from 'zod';
import crypto from 'crypto';

const createWaypointSchema = z.object({
  name: z.string().min(1, 'Waypoint name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  systemInstructions: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const GET = async (req: Request) => {
  try {
    ensureWaypointsTable();
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    let waypointsList: any[] = [];
    if (instanceMode === 'multi') {
      if (!user) {
        // Unauthenticated users in multi-user mode can browse public/shared waypoints
        waypointsList = await db.query.waypoints.findMany({
          where: isNull(waypoints.userId),
          orderBy: [desc(waypoints.updatedAt)],
        });
      } else if (user.role === 'admin') {
        // Admin sees all waypoints
        waypointsList = await db.query.waypoints.findMany({
          orderBy: [desc(waypoints.updatedAt)],
        });
      } else {
        // Regular user sees their own + public/shared waypoints
        waypointsList = await db.query.waypoints.findMany({
          where: or(eq(waypoints.userId, user.id), isNull(waypoints.userId)),
          orderBy: [desc(waypoints.updatedAt)],
        });
      }
    } else {
      // Single user mode: all waypoints
      waypointsList = await db.query.waypoints.findMany({
        orderBy: [desc(waypoints.updatedAt)],
      });
    }

    // Get all chats to compute count per waypoint
    const allChats = await db.query.chats.findMany({
      columns: {
        id: true,
        waypointId: true,
        userId: true,
      },
    });

    const chatCountMap = new Map<string, number>();
    for (const chat of allChats) {
      if (chat.waypointId) {
        // Count only chats accessible to this user
        const canCountChat =
          instanceMode === 'single' ||
          !user ||
          user.role === 'admin' ||
          chat.userId === user.id ||
          !chat.userId;

        if (canCountChat) {
          chatCountMap.set(
            chat.waypointId,
            (chatCountMap.get(chat.waypointId) || 0) + 1,
          );
        }
      }
    }

    const sanitizedWaypoints = (waypointsList || []).map((wp) => {
      const isPublic = wp.userId === null;
      const isOwner =
        instanceMode === 'single' ||
        (user && (user.role === 'admin' || user.id === wp.userId));

      return {
        ...wp,
        isPublic,
        isOwner: Boolean(isOwner),
        chatsCount: chatCountMap.get(wp.id) || 0,
      };
    });

    return Response.json({ waypoints: sanitizedWaypoints }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching waypoints:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch the waypoint list.', waypoints: [] },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    ensureWaypointsTable();
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && !user) {
      return Response.json(
        { message: 'Login required to create a Waypoint space.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = createWaypointSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request data', errors: parsed.error.format() },
        { status: 400 },
      );
    }

    let assignedUserId: string | null = null;
    if (instanceMode === 'multi' && user) {
      if (user.role === 'admin' && parsed.data.isPublic) {
        assignedUserId = null; // Admin can create public space
      } else {
        assignedUserId = user.id;
      }
    }

    const now = new Date().toISOString();
    const newWaypoint = {
      id: crypto.randomUUID(),
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      icon: parsed.data.icon?.trim() || 'Waypoints',
      systemInstructions: parsed.data.systemInstructions?.trim() || '',
      userId: assignedUserId,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(waypoints).values(newWaypoint);

    return Response.json(
      {
        waypoint: {
          ...newWaypoint,
          isPublic: assignedUserId === null,
          isOwner: true,
          chatsCount: 0,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error creating waypoint:', err);
    return Response.json(
      { message: err?.message || 'Failed to create the waypoint.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (req: Request) => {
  try {
    ensureWaypointsTable();
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
    const existingWaypoints: { id: string; userId: string | null }[] = [];

    for (const chunk of chunkIds(ids)) {
      const rows = await db.query.waypoints.findMany({
        where: inArray(waypoints.id, chunk),
        columns: {
          id: true,
          userId: true,
        },
      });
      existingWaypoints.push(...rows);
    }

    if (existingWaypoints.length === 0) {
      return Response.json(
        { message: 'No matching waypoints found.', deletedIds: [], deletedCount: 0 },
        { status: 404 },
      );
    }

    const deletableIds = existingWaypoints
      .filter((wp) =>
        canDeleteOwnedEntity({
          user,
          instanceMode,
          ownerUserId: wp.userId,
        }),
      )
      .map((wp) => wp.id);

    if (deletableIds.length === 0) {
      return Response.json(
        {
          message: 'You do not have permission to delete the selected waypoints.',
          deletedIds: [],
          deletedCount: 0,
        },
        { status: 403 },
      );
    }

    db.transaction((tx) => {
      for (const chunk of chunkIds(deletableIds)) {
        tx.update(chats)
          .set({ waypointId: null })
          .where(inArray(chats.waypointId, chunk))
          .run();
        tx.delete(waypoints).where(inArray(waypoints.id, chunk)).run();
      }
    });

    const deletedSet = new Set(deletableIds);
    const skippedIds = ids.filter((id) => !deletedSet.has(id));

    return Response.json(
      {
        message: 'Waypoints deleted successfully.',
        deletedIds: deletableIds,
        skippedIds,
        deletedCount: deletableIds.length,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error bulk deleting waypoints:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete waypoints.' },
      { status: 500 },
    );
  }
};
