import { NextResponse, type NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifySessionToken } from './lib/security/token';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Max-Age': '86400',
};

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function getExpectedApiKey(): string | undefined {
  return (
    process.env.API_KEY ||
    process.env.AUTH_SECRET ||
    process.env.VANE_API_KEY
  );
}

function isApiKeyAuthorized(request: NextRequest, expectedKey: string): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      if (constantTimeCompare(parts[1], expectedKey)) return true;
    }
  }

  const customKeyHeader = request.headers.get('x-api-key');
  if (customKeyHeader && constantTimeCompare(customKeyHeader, expectedKey)) {
    return true;
  }

  const cookieKey = request.cookies.get('vane_api_key')?.value;
  if (cookieKey && constantTimeCompare(cookieKey, expectedKey)) {
    return true;
  }

  return false;
}

function getRuntimeConfig(): {
  setupComplete: boolean;
  instanceMode: 'single' | 'multi';
  exposeToNetwork: boolean;
  trustedProxies: string[];
} {
  try {
    const configPath = path.join(process.env.DATA_DIR || process.cwd(), '/data/config.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        setupComplete: Boolean(parsed.setupComplete),
        instanceMode: parsed.instanceMode || 'single',
        exposeToNetwork: Boolean(parsed.network?.exposeToNetwork),
        trustedProxies: Array.isArray(parsed.network?.trustedProxies) ? parsed.network.trustedProxies : [],
      };
    }
  } catch {
    // Return safe default if reading fails
  }
  return {
    setupComplete: false,
    instanceMode: 'single',
    exposeToNetwork: false,
    trustedProxies: [],
  };
}

function getClientIp(req: NextRequest, trustedProxies: string[]): {
  ip: string;
  isDirectSocket: boolean;
  isTrustedProxy: boolean;
} {
  const directSocketIp =
    (req as any).ip ||
    (req as any).socket?.remoteAddress ||
    '';

  const envTrusted = (process.env.TRUSTED_PROXY_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allTrustedProxies = new Set([...trustedProxies, ...envTrusted]);

  const isTrusted = Boolean(directSocketIp && allTrustedProxies.has(directSocketIp));

  // Anti-spoofing: only trust x-forwarded-for if direct socket connection comes from trusted reverse proxy
  if (isTrusted) {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
      const clientIp = forwardedFor.split(',')[0].trim();
      return { ip: clientIp, isDirectSocket: false, isTrustedProxy: true };
    }
    const realIp = req.headers.get('x-real-ip');
    if (realIp) {
      return { ip: realIp.trim(), isDirectSocket: false, isTrustedProxy: true };
    }
  }

  return { ip: directSocketIp, isDirectSocket: true, isTrustedProxy: false };
}

function isLoopbackOrLocalHost(req: NextRequest, clientIp: string): boolean {
  const host = (req.headers.get('host') || '').toLowerCase();
  const hostName = host.split(':')[0];
  if (
    hostName === 'localhost' ||
    hostName === '127.0.0.1' ||
    hostName === '::1' ||
    hostName === '[::1]'
  ) {
    return true;
  }

  if (
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    clientIp === 'localhost'
  ) {
    return true;
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  // Handle CORS preflight for API routes
  if (isApiRoute && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        ...SECURITY_HEADERS,
        ...CORS_HEADERS,
      },
    });
  }

  const runtimeConfig = getRuntimeConfig();
  const expectedKey = getExpectedApiKey();
  const clientInfo = getClientIp(request, runtimeConfig.trustedProxies);
  const isLocal = isLoopbackOrLocalHost(request, clientInfo.ip);

  // 1. FRESH START / SETUP WIZARD:
  // If configuration is not yet completed, NEVER block access with 403 network access error!
  // The user must be allowed to configure the instance on first start.
  if (!runtimeConfig.setupComplete) {
    const response = NextResponse.next();
    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(header, value);
    }
    if (isApiRoute) {
      for (const [header, value] of Object.entries(CORS_HEADERS)) {
        response.headers.set(header, value);
      }
    }
    return response;
  }

  // 2. Resolve session token if present
  let sessionUserRole: string | null = null;
  const sessionCookie = request.cookies.get('vane_session')?.value;
  let authBearerToken: string | null = null;
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    authBearerToken = authHeader.slice(7).trim();
  }

  const tokenToVerify = sessionCookie || authBearerToken;
  if (tokenToVerify) {
    const payload = await verifySessionToken(tokenToVerify);
    if (payload) {
      sessionUserRole = payload.role;
    }
  }

  // Check whether request has valid API key
  const hasValidApiKey = expectedKey ? isApiKeyAuthorized(request, expectedKey) : false;

  // 3. SINGLE-USER MODE: Network Exposure Enforcement (Ollama-style)
  if (runtimeConfig.instanceMode === 'single') {
    if (!isLocal) {
      // Remote request in single-user mode
      if (!runtimeConfig.exposeToNetwork) {
        return NextResponse.json(
          {
            error: 'Network Access Disabled',
            message:
              'Access from external network devices is disabled. Enable "Expose instance to network" in settings to allow connections.',
          },
          {
            status: 403,
            headers: {
              ...SECURITY_HEADERS,
              ...CORS_HEADERS,
            },
          },
        );
      }

      // If exposed to network, remote requests require valid authentication (API Key or Admin session)
      const isAuthenticated = hasValidApiKey || sessionUserRole === 'admin';
      if (!isAuthenticated && isApiRoute) {
        // Exclude /api/auth/login and /api/auth/me from initial 401 so users can authenticate
        if (!pathname.startsWith('/api/auth/')) {
          return NextResponse.json(
            {
              error: 'Unauthorized',
              message:
                'Network access requires authorization. Provide an API key or log in as an administrator.',
            },
            {
              status: 401,
              headers: {
                ...SECURITY_HEADERS,
                ...CORS_HEADERS,
                'WWW-Authenticate': 'Bearer',
              },
            },
          );
        }
      }
    }
  }

  // 4. MULTI-USER MODE: Administrative Route Guards (Defense-in-depth)
  if (runtimeConfig.instanceMode === 'multi') {
    // Redirect non-admins trying to access /statistics page
    if (pathname === '/statistics') {
      const isAdmin = sessionUserRole === 'admin' || hasValidApiKey;
      if (!isAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    const isSensitiveAdminRoute =
      pathname.startsWith('/api/config') ||
      pathname.startsWith('/api/users') ||
      pathname.startsWith('/api/statistics') ||
      (pathname.startsWith('/api/providers') &&
        (pathname.includes('/refresh') || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)));

    if (isSensitiveAdminRoute) {
      const isAdmin = sessionUserRole === 'admin' || hasValidApiKey;
      if (!isAdmin) {
        return NextResponse.json(
          {
            error: 'Forbidden',
            message: 'Access to this resource requires administrator privileges.',
          },
          {
            status: 403,
            headers: {
              ...SECURITY_HEADERS,
              ...CORS_HEADERS,
            },
          },
        );
      }
    }
  }

  // 5. Explicit API Key enforcement if configured globally in environment
  if (expectedKey && isApiRoute && !hasValidApiKey && !sessionUserRole) {
    if (!pathname.startsWith('/api/auth/')) {
      return NextResponse.json(
        { message: 'Unauthorized. A valid API key or Bearer token is required.' },
        {
          status: 401,
          headers: {
            ...SECURITY_HEADERS,
            ...CORS_HEADERS,
            'WWW-Authenticate': 'Bearer',
          },
        },
      );
    }
  }

  const response = NextResponse.next();

  for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }

  if (isApiRoute) {
    for (const [header, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(header, value);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
