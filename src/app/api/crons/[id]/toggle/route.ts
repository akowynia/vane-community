export const dynamic = 'force-dynamic';

import db, { ensureWaypointCronsTable } from '@/lib/db';
import { waypointCrons, waypoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { computeNextRun } from '@/lib/cron/parser';

export const PATCH = async (
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
        return Response.json(
          { message: 'Login required to manage the cron task.' },
          { status: 401 },
        );
      }
      if (!isOwner) {
        return Response.json(
          { message: "You do not have permission to change this task's state." },
          { status: 403 },
        );
      }
    }

    const newEnabled = !cron.enabled;
    const now = new Date();
    const nextRun = newEnabled ? computeNextRun(cron.schedule, now, cron.timezone || 'UTC') : null;

    await db
      .update(waypointCrons)
      .set({
        enabled: newEnabled,
        nextRunAt: nextRun ? nextRun.toISOString() : null,
        updatedAt: now.toISOString(),
      })
      .where(eq(waypointCrons.id, id));

    const updated = await db.query.waypointCrons.findFirst({
      where: eq(waypointCrons.id, id),
    });

    return Response.json(
      {
        message: newEnabled ? 'Task was enabled.' : 'Task was paused.',
        enabled: newEnabled,
        cron: updated,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error toggling cron:', err);
    return Response.json(
      { message: err?.message || "Failed to change the task's state." },
      { status: 500 },
    );
  }
};
