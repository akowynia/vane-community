export const dynamic = 'force-dynamic';

import db, { ensureWaypointCronsTable } from '@/lib/db';
import { waypointCrons, waypoints } from '@/lib/db/schema';
import { eq, desc, and, or, inArray } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser, canAccessProvider, canAccessModel } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';
import crypto from 'crypto';
import { computeNextRun, isValidCron, normalizeCronExpression } from '@/lib/cron/parser';
import { SearchSources } from '@/lib/agents/search/types';

const createCronSchema = z.object({
  waypointId: z.string().min(1, 'Waypoint identifier is required'),
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
  timezone: z.string().optional().default('UTC'),
  enabled: z.boolean().optional().default(true),
});

export const GET = async (req: Request) => {
  try {
    ensureWaypointCronsTable();
    const { searchParams } = new URL(req.url);
    const filterWaypointId = searchParams.get('waypointId');

    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    // Guests in multi-user mode cannot view or execute crons
    if (instanceMode === 'multi' && !user) {
      return Response.json({ crons: [] }, { status: 200 });
    }

    // 1. Fetch accessible waypoints first
    const allWaypoints = await db.query.waypoints.findMany();
    const accessibleWaypointIds = new Set<string>();
    const waypointMap = new Map<string, any>();

    for (const wp of allWaypoints) {
      waypointMap.set(wp.id, wp);
      const isPublic = wp.userId === null;
      const canAccess =
        instanceMode === 'single' ||
        isPublic ||
        (user && (user.role === 'admin' || user.id === wp.userId));

      if (canAccess) {
        accessibleWaypointIds.add(wp.id);
      }
    }

    if (filterWaypointId && !accessibleWaypointIds.has(filterWaypointId)) {
      return Response.json({ crons: [] }, { status: 200 });
    }

    // 2. Fetch crons
    let conditions = [];
    if (filterWaypointId) {
      conditions.push(eq(waypointCrons.waypointId, filterWaypointId));
    }

    let cronsList = await db.query.waypointCrons.findMany({
      where: conditions.length > 0 ? conditions[0] : undefined,
      orderBy: [desc(waypointCrons.createdAt)],
    });

    // 3. Filter and enrich crons
    const sanitizedCrons = cronsList
      .filter((cron) => {
        if (!accessibleWaypointIds.has(cron.waypointId)) return false;
        if (instanceMode === 'single') return true;
        if (user && user.role === 'admin') return true;
        const wp = waypointMap.get(cron.waypointId);
        return Boolean(user && (user.id === cron.userId || (wp && wp.userId === user.id)));
      })
      .map((cron) => {
        const wp = waypointMap.get(cron.waypointId);
        let parsedSources = cron.sources;
        if (typeof parsedSources === 'string') {
          try {
            parsedSources = JSON.parse(parsedSources);
          } catch {
            parsedSources = [];
          }
        }

        const isOwner =
          instanceMode === 'single' ||
          Boolean(user && (user.role === 'admin' || user.id === cron.userId || (wp && wp.userId === user.id)));

        return {
          ...cron,
          sources: Array.isArray(parsedSources) ? parsedSources : [],
          waypointName: wp?.name || 'Unknown space',
          waypointIcon: wp?.icon || 'Waypoints',
          waypointIsPublic: wp?.userId === null,
          isOwner: Boolean(isOwner),
        };
      });

    return Response.json({ crons: sanitizedCrons }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching crons:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch the list of cron tasks.', crons: [] },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    ensureWaypointCronsTable();
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && !user) {
      return Response.json(
        { message: 'Login required to create a cron task.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = createCronSchema.safeParse(body);

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

    // Check target waypoint exists & permissions
    const waypoint = await db.query.waypoints.findFirst({
      where: eq(waypoints.id, data.waypointId),
    });

    if (!waypoint) {
      return Response.json(
        { message: 'The selected Waypoint space does not exist.' },
        { status: 404 },
      );
    }

    if (instanceMode === 'multi' && user) {
      const isPublic = waypoint.userId === null;
      if (!isPublic && waypoint.userId !== user.id && user.role !== 'admin') {
        return Response.json(
          { message: 'You do not have permission to add tasks in this private space.' },
          { status: 403 },
        );
      }

      if (user.role !== 'admin') {
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
    }

    const now = new Date();
    const targetTimezone = data.timezone || 'UTC';
    const nextRun = computeNextRun(normalizedSchedule, now, targetTimezone);
    const cronId = crypto.randomUUID();

    const newCron = {
      id: cronId,
      waypointId: data.waypointId,
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
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
      lastRunAt: null,
      nextRunAt: nextRun ? nextRun.toISOString() : null,
      lastStatus: null,
      lastError: null,
      lastChatId: null,
      userId: user?.id || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.insert(waypointCrons).values(newCron);

    return Response.json(
      {
        cron: {
          ...newCron,
          waypointName: waypoint.name,
          waypointIcon: waypoint.icon,
          waypointIsPublic: waypoint.userId === null,
          isOwner: true,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error creating cron:', err);
    return Response.json(
      { message: err?.message || 'Failed to create the cron task.' },
      { status: 500 },
    );
  }
};
