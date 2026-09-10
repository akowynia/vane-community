import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from './token';
import { validateApiKey, extractRawApiKey } from './apiKeys';
import db from '@/lib/db';
import { users, modelStats } from '@/lib/db/schema';
import { eq, gte, and, sql } from 'drizzle-orm';
import configManager from '@/lib/config';

export interface AuthUser {
  id: string;
  username: string;
  displayName?: string | null;
  role: 'admin' | 'member' | 'guest';
  allowedProviders?: string[];
  allowedModels?: string[];
  tokenLimit5h?: number | null;
  tokenLimitWeekly?: number | null;
  tokenLimitPerDay?: number | null;
  tokenLimitPerMonth?: number | null;
  maxTokensPerRequest?: number | null;
  qualityModeTokenLimit?: number | null;
  apiKeyId?: string;
}

/**
 * Resolve authenticated user from request cookie, bearer token, API Key, or single-user virtual admin
 */
export async function resolveRequestUser(req: NextRequest | Request): Promise<AuthUser | null> {
  const instanceMode = configManager.getConfig('instanceMode', 'single');
  const globalQualityLimit = configManager.getConfig('globalLimits.qualityModeMaxTokens', 75000);

  // Check if request is authenticated using an API Key (vane_sk_...)
  const rawApiKey = extractRawApiKey(req);
  if (rawApiKey) {
    const keyValidation = await validateApiKey(rawApiKey);
    if (keyValidation.success && keyValidation.user && keyValidation.key) {
      const u = keyValidation.user;
      const k = keyValidation.key;
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: (u.role as any) || 'member',
        allowedProviders: k.allowedProviders || u.allowedProviders || ['*'],
        allowedModels: k.allowedModels || u.allowedModels || ['*'],
        tokenLimit5h: u.tokenLimit5h,
        tokenLimitWeekly: u.tokenLimitWeekly,
        tokenLimitPerDay: k.tokenLimitPerDay ?? u.tokenLimitPerDay,
        tokenLimitPerMonth: u.tokenLimitPerMonth,
        maxTokensPerRequest: u.maxTokensPerRequest,
        qualityModeTokenLimit: globalQualityLimit,
        apiKeyId: k.id,
      };
    }
  }

  // In Single-User mode, the local caller acts as administrator
  if (instanceMode === 'single') {
    return {
      id: 'admin',
      username: 'admin',
      displayName: 'Administrator',
      role: 'admin',
      allowedProviders: ['*'],
      allowedModels: ['*'],
      tokenLimit5h: null,
      tokenLimitWeekly: null,
      tokenLimitPerDay: null,
      tokenLimitPerMonth: null,
      maxTokensPerRequest: null,
      qualityModeTokenLimit: globalQualityLimit,
    };
  }

  // Multi-User mode: check session cookie first
  let token: string | undefined;
  if ('cookies' in req && typeof (req as any).cookies?.get === 'function') {
    token = (req as any).cookies.get('vane_session')?.value;
  } else if (req.headers && typeof req.headers.get === 'function') {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(/vane_session=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  // If not found in cookie, check Authorization header
  if (!token && req.headers && typeof req.headers.get === 'function') {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (token) {
    const payload = await verifySessionToken(token);
    if (payload && payload.userId) {
      if (payload.userId === 'admin' || payload.role === 'admin') {
        return {
          id: 'admin',
          username: payload.username || 'admin',
          displayName: 'Administrator',
          role: 'admin',
          allowedProviders: ['*'],
          allowedModels: ['*'],
          tokenLimit5h: null,
          tokenLimitWeekly: null,
          tokenLimitPerDay: null,
          tokenLimitPerMonth: null,
          maxTokensPerRequest: null,
          qualityModeTokenLimit: globalQualityLimit,
        };
      }

      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, payload.userId),
      });

      if (dbUser && dbUser.status === 'active') {
        return {
          id: dbUser.id,
          username: dbUser.username,
          displayName: dbUser.displayName,
          role: dbUser.role as 'admin' | 'member' | 'guest',
          allowedProviders: dbUser.allowedProviders || ['*'],
          allowedModels: dbUser.allowedModels || ['*'],
          tokenLimit5h: dbUser.tokenLimit5h,
          tokenLimitWeekly: dbUser.tokenLimitWeekly,
          tokenLimitPerDay: dbUser.tokenLimitPerDay,
          tokenLimitPerMonth: dbUser.tokenLimitPerMonth,
          maxTokensPerRequest: dbUser.maxTokensPerRequest,
          qualityModeTokenLimit: globalQualityLimit,
        };
      }
    }
  }

  // If unauthenticated, check if guest access is enabled
  const allowGuests = configManager.getConfig('guestSettings.allowGuestAccess', false);
  if (allowGuests) {
    const guestLimit5h = configManager.getConfig('guestSettings.tokenLimit5h', 20000);
    const guestLimitWeekly = configManager.getConfig('guestSettings.tokenLimitWeekly', 100000);
    const guestLimitDay = configManager.getConfig('guestSettings.tokenLimitPerDay', 50000);
    const guestMaxPerReq = configManager.getConfig('guestSettings.maxTokensPerRequest', 4096);
    const guestQualityLimit = configManager.getConfig('guestSettings.qualityModeMaxTokens', 35000);
    const guestProviders = configManager.getConfig('guestSettings.allowedProviders', ['*']);
    const guestModels = configManager.getConfig('guestSettings.allowedModels', ['*']);

    return {
      id: 'guest',
      username: 'guest',
      displayName: 'Guest',
      role: 'guest',
      allowedProviders: guestProviders,
      allowedModels: guestModels,
      tokenLimit5h: guestLimit5h,
      tokenLimitWeekly: guestLimitWeekly,
      tokenLimitPerDay: guestLimitDay,
      tokenLimitPerMonth: null,
      maxTokensPerRequest: guestMaxPerReq,
      qualityModeTokenLimit: guestQualityLimit,
    };
  }

  return null;
}

/**
 * Require administrator privileges for an API route handler (Defense-in-depth)
 */
export async function requireAdmin(
  req: NextRequest,
): Promise<{ user: AuthUser } | NextResponse> {
  const instanceMode = configManager.getConfig('instanceMode', 'single');

  // Single-user mode has inherent admin rights locally
  if (instanceMode === 'single') {
    return {
      user: {
        id: 'admin',
        username: 'admin',
        displayName: 'Administrator',
        role: 'admin',
      },
    };
  }

  const user = await resolveRequestUser(req);
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Access requires administrator privileges.',
      },
      { status: 403 },
    );
  }

  return { user };
}

/**
 * Verify if user is permitted to use a specific provider
 */
export function canAccessProvider(user: AuthUser, providerId?: string): boolean {
  if (!providerId) return false;
  if (user.role === 'admin') return true;
  if (!user.allowedProviders || user.allowedProviders.length === 0) return false;
  return (
    user.allowedProviders.includes('*') ||
    user.allowedProviders.includes(providerId)
  );
}

/**
 * Verify if user is permitted to use a specific model
 */
export function canAccessModel(user: AuthUser, modelKey?: string): boolean {
  if (!modelKey) return false;
  if (user.role === 'admin') return true;
  if (!user.allowedModels || user.allowedModels.length === 0) return false;
  return (
    user.allowedModels.includes('*') ||
    user.allowedModels.includes(modelKey)
  );
}

/**
 * Calculate token usage for user across multiple rolling windows: 5h, 7d (weekly), 24h, 30d
 */
export async function checkTokenUsage(user: AuthUser): Promise<{
  tokensLast5h: number;
  tokensWeekly: number;
  tokensLast24h: number;
  tokensThisMonth: number;
  limit5hExceeded: boolean;
  limitWeeklyExceeded: boolean;
  dayLimitExceeded: boolean;
  monthLimitExceeded: boolean;
}> {
  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  let tokensLast5h = 0;
  let tokensWeekly = 0;
  let tokensLast24h = 0;
  let tokensThisMonth = 0;

  try {
    const isSingleUserOrAdmin = user.role === 'admin' || user.id === 'admin';
    const whereClause = isSingleUserOrAdmin
      ? gte(modelStats.createdAt, startOfMonth)
      : and(
          eq(modelStats.userId, user.id),
          gte(modelStats.createdAt, startOfMonth),
        );

    const records = await db.query.modelStats.findMany({
      where: whereClause,
      columns: {
        totalTokens: true,
        createdAt: true,
      },
    });

    for (const record of records) {
      const tokens = record.totalTokens || 0;
      const createdAt = record.createdAt;

      if (createdAt >= fiveHoursAgo) {
        tokensLast5h += tokens;
      }
      if (createdAt >= sevenDaysAgo) {
        tokensWeekly += tokens;
      }
      if (createdAt >= twentyFourHoursAgo) {
        tokensLast24h += tokens;
      }
      tokensThisMonth += tokens;
    }
  } catch (err) {
    console.error('Error calculating token usage:', err);
  }

  const isAdmin = user.role === 'admin';
  const globalLimits = configManager.getConfig('globalLimits', null);

  const effectiveLimit5h = user.tokenLimit5h ?? (isAdmin ? null : globalLimits?.tokenLimit5h);
  const effectiveLimitWeekly = user.tokenLimitWeekly ?? (isAdmin ? null : globalLimits?.tokenLimitWeekly);
  const effectiveLimitPerDay = user.tokenLimitPerDay ?? (isAdmin ? null : globalLimits?.tokenLimitPerDay);
  const effectiveLimitPerMonth = user.tokenLimitPerMonth ?? (isAdmin ? null : globalLimits?.tokenLimitPerMonth);

  const limit5hExceeded = Boolean(
    !isAdmin && effectiveLimit5h && tokensLast5h >= effectiveLimit5h,
  );
  const limitWeeklyExceeded = Boolean(
    !isAdmin && effectiveLimitWeekly && tokensWeekly >= effectiveLimitWeekly,
  );
  const dayLimitExceeded = Boolean(
    !isAdmin && effectiveLimitPerDay && tokensLast24h >= effectiveLimitPerDay,
  );
  const monthLimitExceeded = Boolean(
    !isAdmin && effectiveLimitPerMonth && tokensThisMonth >= effectiveLimitPerMonth,
  );

  return {
    tokensLast5h,
    tokensWeekly,
    tokensLast24h,
    tokensThisMonth,
    limit5hExceeded,
    limitWeeklyExceeded,
    dayLimitExceeded,
    monthLimitExceeded,
  };
}
