export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import { requireAdmin } from '@/lib/security/rbac';

export const POST = async (req: NextRequest) => {
  try {
    const isSetup = !configManager.isSetupComplete();
    const hasAdminPassword = Boolean(
      configManager.getConfig('auth.adminPasswordHash'),
    );

    // In multi-user mode, or in single-user mode when password is already set, require admin role
    if (!isSetup && hasAdminPassword) {
      const adminCheck = await requireAdmin(req);
      if (adminCheck instanceof NextResponse) {
        return adminCheck;
      }
    }

    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { message: 'The administrator password must be at least 8 characters long.' },
        { status: 400 },
      );
    }

    configManager.setAdminPassword(password);

    return NextResponse.json(
      {
        message: 'Administrator password updated successfully.',
        hasAdminPassword: true,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error updating admin password:', err);
    return NextResponse.json(
      { message: err.message || 'Error updating the administrator password.' },
      { status: 500 },
    );
  }
};
