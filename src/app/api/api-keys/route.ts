import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { apiKeys, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { resolveRequestUser } from '@/lib/security/rbac';
import { generateApiKey } from '@/lib/security/apiKeys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (req: NextRequest) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Login required' },
        { status: 401 },
      );
    }

    const isAdmin = user.role === 'admin';
    const viewAll = req.nextUrl.searchParams.get('all') === 'true';

    // EXPLICIT ADMIN ROLE GUARD:
    if (viewAll && !isAdmin) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Only an administrator can view all users\' keys.',
        },
        { status: 403 },
      );
    }

    const keys =
      isAdmin && viewAll
        ? await db.query.apiKeys.findMany({
            orderBy: [desc(apiKeys.createdAt)],
          })
        : await db.query.apiKeys.findMany({
            where: eq(apiKeys.userId, user.id),
            orderBy: [desc(apiKeys.createdAt)],
          });

    // Fetch user map if admin viewing all keys
    let usersMap: Record<string, { username: string; displayName?: string | null }> = {};
    if (isAdmin && viewAll) {
      const allUsers = await db.query.users.findMany();
      for (const u of allUsers) {
        usersMap[u.id] = {
          username: u.username,
          displayName: u.displayName,
        };
      }
    }

    const sanitizedKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      userId: k.userId,
      username:
        usersMap[k.userId]?.username ||
        (k.userId === user.id ? user.username : k.userId),
      displayName: usersMap[k.userId]?.displayName || null,
      status: k.status,
      rateLimitPerMinute: k.rateLimitPerMinute,
      rateLimitPerMin: k.rateLimitPerMinute,
      tokenLimitPerDay: k.tokenLimitPerDay,
      dailyTokenLimit: k.tokenLimitPerDay,
      allowedProviders: k.allowedProviders || ['*'],
      allowedModels: k.allowedModels || ['*'],
      defaultWaypointId: k.defaultWaypointId,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));

    return NextResponse.json({ keys: sanitizedKeys });
  } catch (err: any) {
    console.error('Failed to fetch API keys:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err?.message },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    const user = await resolveRequestUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Login required' },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = (body.name || '').trim();

    if (!name) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Key name is required.' },
        { status: 400 },
      );
    }

    const isAdmin = user.role === 'admin';
    // If admin, can generate for specific target userId, otherwise only for self
    const targetUserId =
      isAdmin && body.userId && typeof body.userId === 'string'
        ? body.userId.trim()
        : user.id;

    const rateLimitPerMinute =
      typeof body.rateLimitPerMinute === 'number' && body.rateLimitPerMinute > 0
        ? Math.min(1000, body.rateLimitPerMinute)
        : typeof body.rateLimitPerMin === 'number' && body.rateLimitPerMin > 0
        ? Math.min(1000, body.rateLimitPerMin)
        : 60;

    const tokenLimitPerDay =
      typeof body.tokenLimitPerDay === 'number' && body.tokenLimitPerDay > 0
        ? body.tokenLimitPerDay
        : typeof body.dailyTokenLimit === 'number' && body.dailyTokenLimit > 0
        ? body.dailyTokenLimit
        : null;

    const allowedProviders = Array.isArray(body.allowedProviders)
      ? body.allowedProviders
      : ['*'];

    const allowedModels = Array.isArray(body.allowedModels)
      ? body.allowedModels
      : ['*'];

    const defaultWaypointId =
      typeof body.defaultWaypointId === 'string' && body.defaultWaypointId.trim()
        ? body.defaultWaypointId.trim()
        : null;

    const expiresAt =
      typeof body.expiresAt === 'string' && body.expiresAt.trim()
        ? body.expiresAt.trim()
        : null;

    const createdKey = await generateApiKey({
      name,
      userId: targetUserId,
      rateLimitPerMinute,
      tokenLimitPerDay,
      allowedProviders,
      allowedModels,
      defaultWaypointId,
      expiresAt,
    });

    return NextResponse.json(
      {
        message: 'API key generated successfully.',
        key: createdKey,
        rawKey: createdKey.rawKey,
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Failed to create API key:', err);
    return NextResponse.json(
      { error: 'Internal server error', message: err?.message },
      { status: 500 },
    );
  }
};
