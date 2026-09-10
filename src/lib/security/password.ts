import crypto from 'node:crypto';

/**
 * OWASP recommended parameters for scrypt password hashing:
 * N = 32768 (2^15), r = 8, p = 1, output length = 64 bytes.
 * maxmem = 64MB (64 * 1024 * 1024)
 */
const SCRYPT_CONFIG = {
  N: 32768,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
};

/**
 * Hash a password using OWASP-compliant scrypt parameters
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_CONFIG.keyLength, {
    N: SCRYPT_CONFIG.N,
    r: SCRYPT_CONFIG.r,
    p: SCRYPT_CONFIG.p,
    maxmem: SCRYPT_CONFIG.maxmem,
  });

  return `scrypt$N=${SCRYPT_CONFIG.N},r=${SCRYPT_CONFIG.r},p=${SCRYPT_CONFIG.p}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored scrypt hash using constant-time comparison
 */
export function verifyPassword(password?: string, storedHash?: string): boolean {
  if (!password || !storedHash || typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }

    const paramStr = parts[1]; // e.g. "N=32768,r=8,p=1"
    const salt = parts[2];
    const expectedHashHex = parts[3];

    // Parse params
    const params: Record<string, number> = {};
    for (const kv of paramStr.split(',')) {
      const [k, v] = kv.split('=');
      if (k && v) {
        params[k] = parseInt(v, 10);
      }
    }

    const N = params.N || SCRYPT_CONFIG.N;
    const r = params.r || SCRYPT_CONFIG.r;
    const p = params.p || SCRYPT_CONFIG.p;

    const expectedBuffer = Buffer.from(expectedHashHex, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, expectedBuffer.length, {
      N,
      r,
      p,
      maxmem: SCRYPT_CONFIG.maxmem,
    });

    if (derivedKey.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedBuffer);
  } catch (err) {
    console.error('Error during password verification:', err);
    return false;
  }
}
