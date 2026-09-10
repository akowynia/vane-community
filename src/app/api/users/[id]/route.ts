export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, userSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/security/rbac';
import { hashPassword } from '@/lib/security/password';

export const PATCH = async (
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const params = await props.params;
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!existing) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const body = await req.json();
    const updateValues: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.displayName !== undefined) {
      updateValues.displayName = String(body.displayName).trim();
    }

    if (body.role !== undefined) {
      updateValues.role = body.role === 'admin' ? 'admin' : 'member';
    }

    if (body.status !== undefined) {
      updateValues.status = body.status === 'disabled' ? 'disabled' : 'active';
    }

    if (body.allowedProviders !== undefined && Array.isArray(body.allowedProviders)) {
      updateValues.allowedProviders = body.allowedProviders;
    }

    if (body.allowedModels !== undefined && Array.isArray(body.allowedModels)) {
      updateValues.allowedModels = body.allowedModels;
    }

    if (body.tokenLimit5h !== undefined) {
      updateValues.tokenLimit5h =
        body.tokenLimit5h === null ? null : Number(body.tokenLimit5h);
    }

    if (body.tokenLimitWeekly !== undefined) {
      updateValues.tokenLimitWeekly =
        body.tokenLimitWeekly === null ? null : Number(body.tokenLimitWeekly);
    }

    if (body.tokenLimitPerDay !== undefined) {
      updateValues.tokenLimitPerDay =
        body.tokenLimitPerDay === null ? null : Number(body.tokenLimitPerDay);
    }

    if (body.tokenLimitPerMonth !== undefined) {
      updateValues.tokenLimitPerMonth =
        body.tokenLimitPerMonth === null ? null : Number(body.tokenLimitPerMonth);
    }

    if (body.maxTokensPerRequest !== undefined) {
      updateValues.maxTokensPerRequest =
        body.maxTokensPerRequest === null ? null : Number(body.maxTokensPerRequest);
    }

    if (body.password && typeof body.password === 'string' && body.password.length >= 8) {
      updateValues.passwordHash = hashPassword(body.password);
    }

    await db.update(users).set(updateValues).where(eq(users.id, userId));

    return NextResponse.json(
      { message: 'User updated.' },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error updating user:', err);
    return NextResponse.json(
      { message: err.message || 'Error updating user' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const params = await props.params;
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    // Do not allow deleting self
    if (adminCheck.user.id === userId) {
      return NextResponse.json(
        { message: 'You cannot delete your own administrator account.' },
        { status: 400 },
      );
    }

    // Delete user sessions first
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
    // Delete user
    await db.delete(users).where(eq(users.id, userId));

    return NextResponse.json(
      { message: 'User deleted.' },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error deleting user:', err);
    return NextResponse.json(
      { message: err.message || 'Error deleting user' },
      { status: 500 },
    );
  }
};
