/**
 * In-memory sliding-window rate limiter with exponential backoff for login attempts
 */

interface RateLimitEntry {
  failures: number;
  lastAttemptTime: number;
  blockedUntil: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const BASE_BACKOFF_SECONDS = [0, 1, 3, 5, 10]; // Exponential backoff for attempts 1..5

/**
 * Check if an IP is allowed to attempt login
 */
export function checkLoginRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
  delayMs?: number;
} {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    return { allowed: true, delayMs: 0 };
  }

  // If window expired, reset
  if (now - entry.lastAttemptTime > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true, delayMs: 0 };
  }

  // If currently blocked
  if (now < entry.blockedUntil) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
      delayMs: 0,
    };
  }

  // Calculate artificial delay (anti-automation backoff)
  const delayIndex = Math.min(entry.failures, BASE_BACKOFF_SECONDS.length - 1);
  const delayMs = BASE_BACKOFF_SECONDS[delayIndex] * 1000;

  return { allowed: true, delayMs };
}

/**
 * Record a failed login attempt for an IP
 */
export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip) || {
    failures: 0,
    lastAttemptTime: now,
    blockedUntil: 0,
  };

  entry.failures += 1;
  entry.lastAttemptTime = now;

  // If exceeded max attempts, block for 15 minutes
  if (entry.failures >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = now + WINDOW_MS;
  }

  loginAttempts.set(ip, entry);
}

/**
 * Reset rate limit after a successful login
 */
export function resetLoginRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}
