/**
 * Session Token implementation using Web Crypto API (crypto.subtle)
 * Completely compatible across Node.js runtime and Edge runtime.
 */

export interface SessionPayload {
  userId: string;
  username: string;
  role: 'admin' | 'member' | 'guest';
  exp: number; // UNIX timestamp (seconds)
  iat: number; // UNIX timestamp (seconds)
}

const DEFAULT_SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecretKey(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.API_KEY ||
    process.env.SESSION_SECRET ||
    'vane-community-default-session-secret-key-replace-in-prod'
  );
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Create a cryptographically signed HMAC-SHA256 session token
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, 'exp' | 'iat'> & { exp?: number },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: payload.exp || now + DEFAULT_SESSION_DURATION_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const key = await getCryptoKey(getSecretKey());
  const enc = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(dataToSign),
  );

  const encodedSignature = Buffer.from(signature)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${encodedSignature}`;
}

/**
 * Verify and decode an HMAC-SHA256 session token
 */
export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToVerify = `${encodedHeader}.${encodedPayload}`;

    const key = await getCryptoKey(getSecretKey());
    const enc = new TextEncoder();

    // Convert signature from base64url back to Buffer
    let sigBase64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    while (sigBase64.length % 4 !== 0) {
      sigBase64 += '=';
    }
    const signatureBytes = Buffer.from(sigBase64, 'base64');

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes as unknown as BufferSource,
      enc.encode(dataToVerify),
    );

    if (!isValid) return null;

    const payload: SessionPayload = JSON.parse(
      base64UrlDecode(encodedPayload),
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
}
