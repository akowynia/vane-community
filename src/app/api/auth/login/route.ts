export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
} from '@/lib/security/rateLimiter';
import { verifyPassword } from '@/lib/security/password';
import { createSessionToken } from '@/lib/security/token';
import configManager from '@/lib/config';
import db from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

function resolveClientIp(req: NextRequest): string {
  const socketIp = (
    (req as any).ip ||
    (req as any).socket?.remoteAddress ||
    ''
  ).trim();

  const trustedProxies =
    process.env.TRUSTED_PROXY_IPS || process.env.TRUSTED_PROXIES;
  if (trustedProxies) {
    const list = trustedProxies.split(',').map((s) => s.trim());
    if (list.includes(socketIp)) {
      const xff = req.headers.get('x-forwarded-for');
      if (xff) {
        return xff.split(',')[0].trim();
      }
    }
  }

  return socketIp || '127.0.0.1';
}

export const POST = async (req: NextRequest) => {
  const clientIp = resolveClientIp(req);
  const rateLimit = checkLoginRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        message: `Too many failed login attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds || 60),
        },
      },
    );
  }

  // Artificial anti-brute-force delay
  if (rateLimit.delayMs && rateLimit.delayMs > 0) {
    await new Promise((res) => setTimeout(res, rateLimit.delayMs));
  }

  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      recordLoginFailure(clientIp);
      return NextResponse.json(
        { message: 'Username and password are required.' },
        { status: 400 },
      );
    }

    const trimmedUsername = String(username).trim().toLowerCase();
    const trimmedPassword = String(password).trim();
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    const adminPasswordHash = configManager.getConfig(
      'auth.adminPasswordHash',
      null,
    );

    let authSuccess = false;
    let userId = 'admin';
    let role: 'admin' | 'member' | 'guest' = 'admin';
    let userDisplayName = 'Administrator';

    // Check Single-User Admin password if set
    if (
      instanceMode === 'single' ||
      (trimmedUsername === 'admin' && adminPasswordHash)
    ) {
      if (adminPasswordHash) {
        authSuccess = verifyPassword(trimmedPassword, adminPasswordHash);
      } else {
        // If single user mode has no password configured yet, allow initial access
        authSuccess = true;
      }
    }

    // Check Multi-User DB
    if (!authSuccess && instanceMode === 'multi') {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.username, trimmedUsername),
      });

      if (dbUser && dbUser.status === 'active') {
        const passwordMatches = verifyPassword(
          trimmedPassword,
          dbUser.passwordHash,
        );
        if (passwordMatches) {
          authSuccess = true;
          userId = dbUser.id;
          role = dbUser.role as 'admin' | 'member' | 'guest';
          userDisplayName = dbUser.displayName || dbUser.username;
        }
      }
    }

    if (!authSuccess) {
      recordLoginFailure(clientIp);
      return NextResponse.json(
        { message: 'Invalid username or password.' },
        { status: 401 },
      );
    }

    // Reset rate limiter on successful auth
    resetLoginRateLimit(clientIp);

    const token = await createSessionToken({
      userId,
      username: trimmedUsername,
      role,
    });

    const response = NextResponse.json(
      {
        message: 'Login successful.',
        user: {
          id: userId,
          username: trimmedUsername,
          displayName: userDisplayName,
          role,
        },
      },
      { status: 200 },
    );

    // Set secure HTTP-only cookie
    response.cookies.set('vane_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: any) {
    console.error('Error during login:', err);
    return NextResponse.json(
      { message: 'An error occurred during login.' },
      { status: 500 },
    );
  }
};
