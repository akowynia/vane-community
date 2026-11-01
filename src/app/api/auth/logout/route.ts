export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isSecureCookie } from '@/lib/security/token';

export const POST = async (req: NextRequest) => {
  const response = NextResponse.json(
    { message: 'Logged out successfully.' },
    { status: 200 },
  );

  response.cookies.set('vane_session', '', {
    httpOnly: true,
    secure: isSecureCookie(req),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
};
