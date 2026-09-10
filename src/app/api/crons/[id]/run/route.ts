export const dynamic = 'force-dynamic';

import db, { ensureWaypointCronsTable } from '@/lib/db';
import { waypointCrons, waypoints } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { executeCronJob } from '@/lib/cron/executor';

export const POST = async (
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
          { message: 'Login required to run the cron task.' },
          { status: 401 },
        );
      }
      if (!isOwner) {
        return Response.json(
          { message: 'You do not have permission to run this task.' },
          { status: 403 },
        );
      }
    }

    console.log(`[Manual Trigger] Executing cron job: "${cron.name}" (${cron.id})...`);
    const result = await executeCronJob(id);

    if (!result.success) {
      return Response.json(
        { message: result.error || 'An error occurred while running the task.' },
        { status: 500 },
      );
    }

    const updated = await db.query.waypointCrons.findFirst({
      where: eq(waypointCrons.id, id),
    });

    return Response.json(
      {
        message: 'Task was successfully executed.',
        chatId: result.chatId,
        cron: updated,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error triggering cron manually:', err);
    return Response.json(
      { message: err?.message || 'Failed to run the task.' },
      { status: 500 },
    );
  }
};
