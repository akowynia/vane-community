export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/security/rbac';
import { hashPassword } from '@/lib/security/password';
import crypto from 'node:crypto';

export const GET = async (req: NextRequest) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const allUsers = await db.query.users.findMany({
      columns: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        allowedProviders: true,
        allowedModels: true,
        tokenLimit5h: true,
        tokenLimitWeekly: true,
        tokenLimitPerDay: true,
        tokenLimitPerMonth: true,
        maxTokensPerRequest: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ users: allUsers }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return NextResponse.json(
      { message: 'Failed to fetch users' },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const body = await req.json();
    const {
      username,
      password,
      displayName,
      role = 'member',
      allowedProviders = ['*'],
      allowedModels = ['*'],
      tokenLimit5h,
      tokenLimitWeekly,
      tokenLimitPerDay,
      tokenLimitPerMonth,
      maxTokensPerRequest,
    } = body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { message: 'Username is required.' },
        { status: 400 },
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.username, trimmedUsername),
    });

    if (existing) {
      return NextResponse.json(
        { message: 'A user with this name already exists.' },
        { status: 409 },
      );
    }

    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(users).values({
      id: userId,
      username: trimmedUsername,
      passwordHash,
      displayName: displayName ? String(displayName).trim() : trimmedUsername,
      role: role === 'admin' ? 'admin' : 'member',
      status: 'active',
      allowedProviders,
      allowedModels,
      tokenLimit5h:
        tokenLimit5h !== undefined && tokenLimit5h !== null
          ? Number(tokenLimit5h)
          : null,
      tokenLimitWeekly:
        tokenLimitWeekly !== undefined && tokenLimitWeekly !== null
          ? Number(tokenLimitWeekly)
          : null,
      tokenLimitPerDay:
        tokenLimitPerDay !== undefined && tokenLimitPerDay !== null
          ? Number(tokenLimitPerDay)
          : null,
      tokenLimitPerMonth:
        tokenLimitPerMonth !== undefined && tokenLimitPerMonth !== null
          ? Number(tokenLimitPerMonth)
          : null,
      maxTokensPerRequest:
        maxTokensPerRequest !== undefined && maxTokensPerRequest !== null
          ? Number(maxTokensPerRequest)
          : null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        message: 'User created.',
        user: {
          id: userId,
          username: trimmedUsername,
          displayName: displayName || trimmedUsername,
          role,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json(
      { message: err.message || 'Error creating user' },
      { status: 500 },
    );
  }
};
