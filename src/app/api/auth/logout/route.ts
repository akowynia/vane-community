export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export const POST = async (req: NextRequest) => {
  const response = NextResponse.json(
    { message: 'Logged out successfully.' },
    { status: 200 },
  );

  response.cookies.set('vane_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
};
