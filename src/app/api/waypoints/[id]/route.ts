export const dynamic = 'force-dynamic';

import db, { ensureWaypointsTable } from '@/lib/db';
import { waypoints, chats } from '@/lib/db/schema';
import { eq, desc, and, or, isNull } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';

const updateWaypointSchema = z.object({
  name: z.string().min(1, 'Waypoint name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  systemInstructions: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
});

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureWaypointsTable();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, id),
    });

    if (!waypoint) {
      return Response.json(
        { message: 'Waypoint space not found.' },
        { status: 404 },
      );
    }

    const isPublic = waypoint.userId === null;
    const isOwner =
      instanceMode === 'single' ||
      Boolean(user && (user.role === 'admin' || user.id === waypoint.userId));
    const canEdit =
      instanceMode === 'single' ||
      Boolean(
        user &&
          (user.role === 'admin' ||
            (!isPublic && user.id === waypoint.userId)),
      );

    if (instanceMode === 'multi' && !isPublic) {
      if (!user) {
        return Response.json(
          { message: 'Login required to access this private space.' },
          { status: 401 },
        );
      }
      if (user.role !== 'admin' && waypoint.userId !== user.id) {
        return Response.json(
          { message: 'You do not have permission to view this private space.' },
          { status: 403 },
        );
      }
    }

    // Load chats belonging to this waypoint according to visibility
    let waypointChats: any[] = [];
    if (instanceMode === 'multi') {
      if (!user) {
        waypointChats = await db.query.chats.findMany({
          where: and(eq(chats.waypointId, id), isNull(chats.userId)),
          orderBy: [desc(chats.createdAt)],
        });
      } else if (user.role === 'admin') {
        waypointChats = await db.query.chats.findMany({
          where: eq(chats.waypointId, id),
          orderBy: [desc(chats.createdAt)],
        });
      } else {
        waypointChats = await db.query.chats.findMany({
          where: and(
            eq(chats.waypointId, id),
            or(eq(chats.userId, user.id), isNull(chats.userId)),
          ),
          orderBy: [desc(chats.createdAt)],
        });
      }
    } else {
      waypointChats = await db.query.chats.findMany({
        where: eq(chats.waypointId, id),
        orderBy: [desc(chats.createdAt)],
      });
    }

    const sanitizedChats = (waypointChats || []).map((chat: any) => {
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

    return Response.json(
      {
        waypoint: {
          ...waypoint,
          isPublic,
          isOwner,
          canEdit,
          chatsCount: sanitizedChats.length,
        },
        chats: sanitizedChats,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error fetching waypoint details:', err);
    return Response.json(
      { message: err?.message || 'An error occurred while fetching the waypoint.' },
      { status: 500 },
    );
  }
};

export const PUT = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureWaypointsTable();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, id),
    });

    if (!waypoint) {
      return Response.json({ message: 'Waypoint not found.' }, { status: 404 });
    }

    const isPublic = waypoint.userId === null;

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (isPublic && user.role !== 'admin') {
        return Response.json(
          { message: 'Only an administrator can modify the shared space.' },
          { status: 403 },
        );
      }
      if (!isPublic && user.role !== 'admin' && waypoint.userId !== user.id) {
        return Response.json(
          { message: 'You do not have permission to edit this waypoint.' },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const parsed = updateWaypointSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request data', errors: parsed.error.format() },
        { status: 400 },
      );
    }

    let newUserId = waypoint.userId;
    if (instanceMode === 'multi' && user?.role === 'admin' && parsed.data.isPublic !== undefined) {
      newUserId = parsed.data.isPublic ? null : waypoint.userId || user.id;
    }

    const now = new Date().toISOString();
    await db
      .update(waypoints)
      .set({
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        icon: parsed.data.icon?.trim() || waypoint.icon || 'Waypoints',
        systemInstructions: parsed.data.systemInstructions?.trim() || '',
        userId: newUserId,
        updatedAt: now,
      })
      .where(eq(waypoints.id, id));

    const updated = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, id),
    });

    return Response.json(
      {
        waypoint: {
          ...updated,
          isPublic: updated?.userId === null,
          isOwner: true,
          canEdit: true,
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error updating waypoint:', err);
    return Response.json(
      { message: err?.message || 'Failed to update the waypoint.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureWaypointsTable();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, id),
    });

    if (!waypoint) {
      return Response.json({ message: 'Waypoint not found.' }, { status: 404 });
    }

    const isPublic = waypoint.userId === null;

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (isPublic && user.role !== 'admin') {
        return Response.json(
          { message: 'Only an administrator can delete the shared space.' },
          { status: 403 },
        );
      }
      if (!isPublic && user.role !== 'admin' && waypoint.userId !== user.id) {
        return Response.json(
          { message: 'You do not have permission to delete this waypoint.' },
          { status: 403 },
        );
      }
    }

    // Unlink chats associated with this waypoint
    await db
      .update(chats)
      .set({ waypointId: null })
      .where(eq(chats.waypointId, id));

    // Delete the waypoint itself
    await db.delete(waypoints).where(eq(waypoints.id, id));

    return Response.json({ message: 'Waypoint deleted successfully.' }, { status: 200 });
  } catch (err: any) {
    console.error('Error deleting waypoint:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete the waypoint.' },
      { status: 500 },
    );
  }
};
