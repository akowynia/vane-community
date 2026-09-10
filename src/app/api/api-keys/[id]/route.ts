import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { resolveRequestUser } from '@/lib/security/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Login required' },
        { status: 401 },
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing key ID' },
        { status: 400 },
      );
    }

    const existingKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    });

    if (!existingKey) {
      return NextResponse.json(
        { error: 'Not Found', message: 'API key does not exist' },
        { status: 404 },
      );
    }

    const isAdmin = user.role === 'admin';
    if (!isAdmin && existingKey.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to delete this key' },
        { status: 403 },
      );
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id)).execute();

    return NextResponse.json({
      success: true,
      message: 'API key deleted successfully.',
    });
  } catch (err: any) {
    console.error('Failed to delete API key:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err?.message },
      { status: 500 },
    );
  }
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Login required' },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const existingKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    });

    if (!existingKey) {
      return NextResponse.json(
        { error: 'Not Found', message: 'API key does not exist' },
        { status: 404 },
      );
    }

    const isAdmin = user.role === 'admin';
    if (!isAdmin && existingKey.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have permission to edit this key' },
        { status: 403 },
      );
    }

    const updates: Partial<typeof apiKeys.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
    }

    if (body.status === 'active' || body.status === 'disabled') {
      updates.status = body.status;
    }

    const rateLimit =
      typeof body.rateLimitPerMinute === 'number' && body.rateLimitPerMinute > 0
        ? body.rateLimitPerMinute
        : typeof body.rateLimitPerMin === 'number' && body.rateLimitPerMin > 0
        ? body.rateLimitPerMin
        : undefined;
    if (rateLimit !== undefined) {
      updates.rateLimitPerMinute = Math.min(1000, rateLimit);
    }

    if (body.tokenLimitPerDay !== undefined || body.dailyTokenLimit !== undefined) {
      const dailyVal =
        body.tokenLimitPerDay !== undefined ? body.tokenLimitPerDay : body.dailyTokenLimit;
      updates.tokenLimitPerDay =
        typeof dailyVal === 'number' && dailyVal > 0
          ? dailyVal
          : null;
    }

    if (body.defaultWaypointId !== undefined) {
      updates.defaultWaypointId =
        typeof body.defaultWaypointId === 'string' && body.defaultWaypointId.trim()
          ? body.defaultWaypointId.trim()
          : null;
    }

    if (Array.isArray(body.allowedProviders)) {
      updates.allowedProviders = body.allowedProviders;
    }

    if (Array.isArray(body.allowedModels)) {
      updates.allowedModels = body.allowedModels;
    }

    await db.update(apiKeys).set(updates).where(eq(apiKeys.id, id)).execute();

    return NextResponse.json({
      success: true,
      message: 'API key updated.',
    });
  } catch (err: any) {
    console.error('Failed to update API key:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err?.message },
      { status: 500 },
    );
  }
};
