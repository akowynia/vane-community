export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/security/password';
import { createSessionToken } from '@/lib/security/token';
import configManager from '@/lib/config';
import crypto from 'node:crypto';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password, confirmPassword, displayName } = body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return NextResponse.json(
        { message: 'Username is required.' },
        { status: 400 },
      );
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Enforce custom username rule: Cannot be default "admin"
    if (trimmedUsername === 'admin') {
      return NextResponse.json(
        {
          message:
            'For security reasons, the administrator username cannot be "admin". Please choose your own unique username.',
        },
        { status: 400 },
      );
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
      return NextResponse.json(
        { message: 'Username must be between 3 and 32 characters.' },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9_-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        {
          message:
            'Username may only contain lowercase letters, digits, and the characters "_" and "-".',
        },
        { status: 400 },
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: 'Passwords do not match. Make sure you entered the same password in both fields.' },
        { status: 400 },
      );
    }

    // Check if user with that name already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.username, trimmedUsername),
    });

    if (existing) {
      return NextResponse.json(
        { message: `A user named "${trimmedUsername}" already exists.` },
        { status: 409 },
      );
    }

    const passwordHash = hashPassword(password);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 1. Create administrator account in DB
    await db.insert(users).values({
      id: userId,
      username: trimmedUsername,
      passwordHash,
      displayName: displayName?.trim() || trimmedUsername,
      role: 'admin',
      status: 'active',
      allowedProviders: ['*'],
      allowedModels: ['*'],
      createdAt: now,
      updatedAt: now,
    });

    // 2. Set admin password hash in configuration
    configManager.setAdminPassword(password);

    // 3. Switch instance mode to multi-user
    configManager.setInstanceMode('multi');

    // 4. Create session token so admin is immediately authenticated
    const token = await createSessionToken({
      userId,
      username: trimmedUsername,
      role: 'admin',
    });

    const response = NextResponse.json(
      {
        message: `Administrator account "${trimmedUsername}" has been created. Multi-User mode has been successfully activated.`,
        user: {
          id: userId,
          username: trimmedUsername,
          displayName: displayName?.trim() || trimmedUsername,
          role: 'admin',
        },
      },
      { status: 200 },
    );

    // Set vane_session cookie
    response.cookies.set({
      name: 'vane_session',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Error in /api/users/setup-multiuser-admin:', err);
    return NextResponse.json(
      { message: err.message || 'An error occurred while configuring the Multi-User administrator.' },
      { status: 500 },
    );
  }
};
