export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users, userSessions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/security/rbac';
import { hashPassword } from '@/lib/security/password';

function sanitizeTokenLimit(
  val: unknown,
  fieldName: string,
): { valid: true; value: number | null } | { valid: false; error: string } {
  if (val === null || val === undefined || val === '') {
    return { valid: true, value: null };
  }
  const num = Number(val);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
    return {
      valid: false,
      error: `Invalid value for ${fieldName}. Must be a non-negative integer or null.`,
    };
  }
  return { valid: true, value: num };
}

const updateUserHandler = async (
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
      if (userId === adminCheck.user.id && body.role !== 'admin') {
        return NextResponse.json(
          { message: 'You cannot change your own administrator role.' },
          { status: 400 },
        );
      }
      updateValues.role = body.role === 'admin' ? 'admin' : 'member';
    }

    if (body.status !== undefined) {
      if (userId === adminCheck.user.id && body.status === 'disabled') {
        return NextResponse.json(
          { message: 'You cannot disable your own administrator account.' },
          { status: 400 },
        );
      }
      updateValues.status = body.status === 'disabled' ? 'disabled' : 'active';
    }

    if (body.allowedProviders !== undefined && Array.isArray(body.allowedProviders)) {
      updateValues.allowedProviders = body.allowedProviders;
    }

    if (body.allowedModels !== undefined && Array.isArray(body.allowedModels)) {
      updateValues.allowedModels = body.allowedModels;
    }

    if (body.tokenLimit5h !== undefined) {
      const parsed = sanitizeTokenLimit(body.tokenLimit5h, 'tokenLimit5h');
      if (!parsed.valid) {
        return NextResponse.json({ message: parsed.error }, { status: 400 });
      }
      updateValues.tokenLimit5h = parsed.value;
    }

    if (body.tokenLimitWeekly !== undefined) {
      const parsed = sanitizeTokenLimit(body.tokenLimitWeekly, 'tokenLimitWeekly');
      if (!parsed.valid) {
        return NextResponse.json({ message: parsed.error }, { status: 400 });
      }
      updateValues.tokenLimitWeekly = parsed.value;
    }

    if (body.tokenLimitPerDay !== undefined) {
      const parsed = sanitizeTokenLimit(body.tokenLimitPerDay, 'tokenLimitPerDay');
      if (!parsed.valid) {
        return NextResponse.json({ message: parsed.error }, { status: 400 });
      }
      updateValues.tokenLimitPerDay = parsed.value;
    }

    if (body.tokenLimitPerMonth !== undefined) {
      const parsed = sanitizeTokenLimit(body.tokenLimitPerMonth, 'tokenLimitPerMonth');
      if (!parsed.valid) {
        return NextResponse.json({ message: parsed.error }, { status: 400 });
      }
      updateValues.tokenLimitPerMonth = parsed.value;
    }

    if (body.maxTokensPerRequest !== undefined) {
      const parsed = sanitizeTokenLimit(body.maxTokensPerRequest, 'maxTokensPerRequest');
      if (!parsed.valid) {
        return NextResponse.json({ message: parsed.error }, { status: 400 });
      }
      updateValues.maxTokensPerRequest = parsed.value;
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

export const PATCH = updateUserHandler;
export const PUT = updateUserHandler;

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
