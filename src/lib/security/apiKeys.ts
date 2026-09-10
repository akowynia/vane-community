import crypto from 'crypto';
import db from '@/lib/db';
import { apiKeys, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';

export interface GeneratedApiKeyResult {
  id: string;
  name: string;
  rawKey: string;
  keyPrefix: string;
  userId: string;
  status: 'active' | 'disabled' | 'revoked';
  rateLimitPerMinute: number;
  tokenLimitPerDay: number | null;
  allowedProviders: string[];
  allowedModels: string[];
  defaultWaypointId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ValidatedApiKeyResult {
  success: boolean;
  status?: number;
  error?: string;
  retryAfterSeconds?: number;
  remainingRequests?: number;
  key?: typeof apiKeys.$inferSelect;
  user?: typeof users.$inferSelect;
}

// In-memory sliding window store for rate limiting (keyId -> timestamps in ms)
const rateLimitMap = new Map<string, number[]>();

// Periodically clean up old timestamps (every 2 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const windowMs = 60 * 1000;
    for (const [keyId, timestamps] of rateLimitMap.entries()) {
      const validTimestamps = timestamps.filter((t) => now - t < windowMs);
      if (validTimestamps.length === 0) {
        rateLimitMap.delete(keyId);
      } else {
        rateLimitMap.set(keyId, validTimestamps);
      }
    }
  }, 120 * 1000);
}

/**
 * Check if request for apiKey exceeds sliding-window rate limit
 */
export function checkApiKeyRateLimit(
  keyId: string,
  limitPerMinute: number = 60,
): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = (rateLimitMap.get(keyId) || []).filter(
    (t) => now - t < windowMs,
  );

  const effectiveLimit = Math.max(1, limitPerMinute);
  const currentCount = timestamps.length;

  if (currentCount >= effectiveLimit) {
    const oldestTimestamp = timestamps[0] || now;
    const resetSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + windowMs - now) / 1000),
    );
    return {
      allowed: false,
      remaining: 0,
      resetSeconds,
    };
  }

  timestamps.push(now);
  rateLimitMap.set(keyId, timestamps);

  const oldestTimestamp = timestamps[0] || now;
  const resetSeconds = Math.max(
    1,
    Math.ceil((oldestTimestamp + windowMs - now) / 1000),
  );

  return {
    allowed: true,
    remaining: Math.max(0, effectiveLimit - timestamps.length),
    resetSeconds,
  };
}

/**
 * Hash raw API key with SHA-256
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

/**
 * Generate cryptographically secure API key with 256-bit entropy
 */
export async function generateApiKey(params: {
  name: string;
  userId: string;
  rateLimitPerMinute?: number;
  tokenLimitPerDay?: number | null;
  allowedProviders?: string[];
  allowedModels?: string[];
  defaultWaypointId?: string | null;
  expiresAt?: string | null;
}): Promise<GeneratedApiKeyResult> {
  // 32 random bytes = 256 bits of pure entropy
  const randomBytes = crypto.randomBytes(32);
  const rawKey = `vane_sk_${randomBytes.toString('hex')}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 16); // e.g. "vane_sk_7f8a9c2b"
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newKeyRecord = {
    id,
    name: params.name.trim(),
    keyHash,
    keyPrefix,
    userId: params.userId,
    status: 'active' as const,
    rateLimitPerMinute: params.rateLimitPerMinute ?? 60,
    tokenLimitPerDay: params.tokenLimitPerDay ?? null,
    allowedProviders: params.allowedProviders || ['*'],
    allowedModels: params.allowedModels || ['*'],
    defaultWaypointId: params.defaultWaypointId || null,
    lastUsedAt: null,
    expiresAt: params.expiresAt || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(apiKeys).values(newKeyRecord);

  return {
    ...newKeyRecord,
    rawKey,
  };
}

/**
 * Extract raw API key string from Request or string
 */
export function extractRawApiKey(
  reqOrKey: NextRequest | Request | string,
): string | null {
  if (typeof reqOrKey === 'string') {
    return reqOrKey.trim().startsWith('vane_sk_') ? reqOrKey.trim() : null;
  }

  // Check Authorization header (Bearer vane_sk_...)
  const authHeader = reqOrKey.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (candidate.startsWith('vane_sk_')) {
      return candidate;
    }
  }

  // Check x-api-key header
  const xApiKey = reqOrKey.headers.get('x-api-key');
  if (xApiKey && xApiKey.trim().startsWith('vane_sk_')) {
    return xApiKey.trim();
  }

  return null;
}

/**
 * Validate API Key against database and enforce Rate Limiting
 */
export async function validateApiKey(
  reqOrKey: NextRequest | Request | string,
): Promise<ValidatedApiKeyResult> {
  const rawKey = extractRawApiKey(reqOrKey);
  if (!rawKey) {
    return {
      success: false,
      status: 401,
      error: 'Missing or invalid API key format (must start with vane_sk_)',
    };
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const key = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyHash, keyHash),
    });

    if (!key) {
      return {
        success: false,
        status: 401,
        error: 'Invalid API key',
      };
    }

    if (key.status !== 'active') {
      return {
        success: false,
        status: 403,
        error: `API key is ${key.status}`,
      };
    }

    if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
      return {
        success: false,
        status: 403,
        error: 'API key has expired',
      };
    }

    // Check sliding window rate limit
    const rateLimit = checkApiKeyRateLimit(key.id, key.rateLimitPerMinute);
    if (!rateLimit.allowed) {
      return {
        success: false,
        status: 429,
        error: `Rate limit exceeded (${key.rateLimitPerMinute} requests/minute). Please retry in ${rateLimit.resetSeconds}s.`,
        retryAfterSeconds: rateLimit.resetSeconds,
        remainingRequests: 0,
        key,
      };
    }

    // Resolve owner user
    let user = await db.query.users.findFirst({
      where: eq(users.id, key.userId),
    });

    if (!user && (key.userId === 'admin' || key.userId === 'solo-admin')) {
      user = {
        id: key.userId,
        username: 'admin',
        displayName: 'Administrator',
        role: 'admin',
        status: 'active',
        passwordHash: '',
        allowedProviders: ['*'],
        allowedModels: ['*'],
        tokenLimit5h: null,
        tokenLimitWeekly: null,
        tokenLimitPerDay: null,
        tokenLimitPerMonth: null,
        maxTokensPerRequest: null,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      };
    }

    if (!user || user.status !== 'active') {
      return {
        success: false,
        status: 403,
        error: 'User associated with this API key is disabled or not found',
      };
    }

    // Update lastUsedAt asynchronously
    db.update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, key.id))
      .execute()
      .catch((err) => console.warn('Failed to update apiKey lastUsedAt:', err));

    return {
      success: true,
      key,
      user,
      remainingRequests: rateLimit.remaining,
    };
  } catch (err: any) {
    console.error('Error during API key validation:', err);
    return {
      success: false,
      status: 500,
      error: 'Internal server error validating API key',
    };
  }
}
