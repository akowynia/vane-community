export const dynamic = 'force-dynamic';

import db, { ensureWaypointCronsTable } from '@/lib/db';
import { waypointCrons, waypoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser, canAccessProvider, canAccessModel } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';
import { computeNextRun, isValidCron, normalizeCronExpression } from '@/lib/cron/parser';
import { SearchSources } from '@/lib/agents/search/types';

const updateCronSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(100),
  schedule: z.string().min(1, 'Schedule is required'),
  prompt: z.string().min(1, 'Prompt content is required'),
  sources: z.array(z.string()).optional().default(['web']),
  optimizationMode: z.enum(['speed', 'balanced', 'quality']).optional().default('balanced'),
  chatModelProvider: z.string().min(1, 'Chat model provider is required'),
  chatModelKey: z.string().min(1, 'Chat model key is required'),
  embeddingModelProvider: z.string().optional().nullable(),
  embeddingModelKey: z.string().optional().nullable(),
  systemInstructions: z.string().optional().nullable(),
  timezone: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureWaypointCronsTable();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const cron = await db.query.waypointCrons.findFirst({
      where: eq(waypointCrons.id, id),
    });

    if (!cron) {
      return Response.json(
        { message: 'Cron task was not found.' },
        { status: 404 },
      );
    }

    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, cron.waypointId),
    });

    const isPublic = waypoint?.userId === null;
    const isOwner =
      instanceMode === 'single' ||
      Boolean(user && (user.role === 'admin' || user.id === cron.userId || (waypoint && waypoint.userId === user.id)));

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json(
          { message: 'Login required to access the cron task.' },
          { status: 401 },
        );
      }
      if (!isOwner) {
        return Response.json(
          { message: 'You do not have permission to access this cron task.' },
          { status: 403 },
        );
      }
    }

    let parsedSources = cron.sources;
    if (typeof parsedSources === 'string') {
      try {
        parsedSources = JSON.parse(parsedSources);
      } catch {
        parsedSources = [];
      }
    }

    return Response.json(
      {
        cron: {
          ...cron,
          sources: Array.isArray(parsedSources) ? parsedSources : [],
          waypointName: waypoint?.name || 'Unknown space',
          waypointIcon: waypoint?.icon || 'Waypoints',
          waypointIsPublic: isPublic,
          isOwner,
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error fetching cron:', err);
    return Response.json(
      { message: err?.message || 'An error occurred while fetching the task.' },
      { status: 500 },
    );
  }
};

export const PUT = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureWaypointCronsTable();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const cron = await db.query.waypointCrons.findFirst({
      where: eq(waypointCrons.id, id),
    });

    if (!cron) {
      return Response.json(
        { message: 'Cron task was not found.' },
        { status: 404 },
      );
    }

    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, cron.waypointId),
    });

    const isPublic = waypoint?.userId === null;
    const isOwner =
      instanceMode === 'single' ||
      Boolean(user && (user.role === 'admin' || user.id === cron.userId || (waypoint && waypoint.userId === user.id)));

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (!isOwner) {
        return Response.json(
          { message: 'You do not have permission to edit this cron task.' },
          { status: 403 },
        );
      }
    }

    const body = await req.json();
    const parsed = updateCronSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request data', errors: parsed.error.format() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const normalizedSchedule = normalizeCronExpression(data.schedule);

    if (!isValidCron(normalizedSchedule)) {
      return Response.json(
        { message: 'Invalid schedule format (cron expression).' },
        { status: 400 },
      );
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin') {
      if (!canAccessProvider(user, data.chatModelProvider)) {
        return Response.json(
          { message: 'You do not have permission to use the selected AI provider.' },
          { status: 403 },
        );
      }
      if (!canAccessModel(user, data.chatModelKey)) {
        return Response.json(
          { message: 'You do not have permission to use the selected AI model.' },
          { status: 403 },
        );
      }
    }

    const now = new Date();
    const targetTimezone = data.timezone || cron.timezone || 'UTC';
    const nextRun = computeNextRun(normalizedSchedule, now, targetTimezone);

    await db
      .update(waypointCrons)
      .set({
        name: data.name.trim(),
        schedule: normalizedSchedule,
        prompt: data.prompt.trim(),
        sources: (data.sources || ['web']) as SearchSources[],
        optimizationMode: data.optimizationMode || 'balanced',
        chatModelProvider: data.chatModelProvider.trim(),
        chatModelKey: data.chatModelKey.trim(),
        embeddingModelProvider: data.embeddingModelProvider?.trim() || null,
        embeddingModelKey: data.embeddingModelKey?.trim() || null,
        systemInstructions: data.systemInstructions?.trim() || null,
        timezone: targetTimezone,
        enabled: data.enabled !== undefined ? Boolean(data.enabled) : cron.enabled,
        nextRunAt: nextRun ? nextRun.toISOString() : null,
        updatedAt: now.toISOString(),
      })
      .where(eq(waypointCrons.id, id));

    const updated = await db.query.waypointCrons.findFirst({
      where: eq(waypointCrons.id, id),
    });

    return Response.json(
      {
        cron: {
          ...updated,
          waypointName: waypoint?.name || 'Unknown space',
          waypointIcon: waypoint?.icon || 'Waypoints',
          waypointIsPublic: isPublic,
          isOwner: true,
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error updating cron:', err);
    return Response.json(
      { message: err?.message || 'Failed to update the task.' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureWaypointCronsTable();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const cron = await db.query.waypointCrons.findFirst({
      where: eq(waypointCrons.id, id),
    });

    if (!cron) {
      return Response.json(
        { message: 'Cron task was not found.' },
        { status: 404 },
      );
    }

    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, cron.waypointId),
    });

    const isOwner =
      instanceMode === 'single' ||
      Boolean(user && (user.role === 'admin' || user.id === cron.userId || (waypoint && waypoint.userId === user.id)));

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (!isOwner) {
        return Response.json(
          { message: 'You do not have permission to delete this cron task.' },
          { status: 403 },
        );
      }
    }

    await db.delete(waypointCrons).where(eq(waypointCrons.id, id));

    return Response.json(
      { message: 'Cron task was successfully deleted.' },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error deleting cron:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete the task.' },
      { status: 500 },
    );
  }
};
