export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import { resolveRequestUser } from '@/lib/security/rbac';

export const GET = async (req: NextRequest) => {
  const isSetup = !configManager.isSetupComplete();
  const user = await resolveRequestUser(req);

  if (!isSetup && (!user || user.role !== 'admin')) {
    return NextResponse.json(
      { message: 'Administrator role required.' },
      { status: 403 },
    );
  }

  return NextResponse.json(
    {
      exposeToNetwork: configManager.getConfig('network.exposeToNetwork', false),
      hasAdminPassword: Boolean(
        configManager.getConfig('auth.adminPasswordHash'),
      ),
    },
    { status: 200 },
  );
};

export const POST = async (req: NextRequest) => {
  const isSetup = !configManager.isSetupComplete();
  const user = await resolveRequestUser(req);

  // If already setup, must be admin
  if (!isSetup && (!user || user.role !== 'admin')) {
    return NextResponse.json(
      { message: 'Administrator role required.' },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const exposeToNetwork =
      typeof body.exposeToNetwork === 'boolean'
        ? body.exposeToNetwork
        : typeof body.expose === 'boolean'
          ? body.expose
          : undefined;
    const { adminPassword } = body;

    if (typeof exposeToNetwork !== 'boolean') {
      return NextResponse.json(
        { message: 'exposeToNetwork must be a boolean value.' },
        { status: 400 },
      );
    }

    await configManager.setNetworkExposure(exposeToNetwork, {
      adminPassword,
    });

    return NextResponse.json(
      {
        message: 'Network configuration updated.',
        exposeToNetwork: configManager.getConfig('network.exposeToNetwork', false),
        hasAdminPassword: Boolean(
          configManager.getConfig('auth.adminPasswordHash'),
        ),
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error in /api/config/network-exposure:', err);
    return NextResponse.json(
      { message: err.message || 'Error updating network settings' },
      { status: 400 },
    );
  }
};
