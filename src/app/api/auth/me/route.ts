export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { resolveRequestUser, checkTokenUsage } from '@/lib/security/rbac';
import configManager from '@/lib/config';

export const GET = async (req: NextRequest) => {
  try {
    const user = await resolveRequestUser(req);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    const exposeToNetwork = configManager.getConfig(
      'network.exposeToNetwork',
      false,
    );
    const hasAdminPassword = Boolean(
      configManager.getConfig('auth.adminPasswordHash'),
    );

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          instanceMode,
          exposeToNetwork,
          hasAdminPassword,
          user: null,
        },
        { status: 200 },
      );
    }

    const tokenStats = await checkTokenUsage(user);

    return NextResponse.json(
      {
        authenticated: user.role !== 'guest',
        instanceMode,
        exposeToNetwork,
        hasAdminPassword,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          allowedProviders: user.allowedProviders,
          allowedModels: user.allowedModels,
          tokenLimit5h: user.tokenLimit5h,
          tokenLimitWeekly: user.tokenLimitWeekly,
          tokenLimitPerDay: user.tokenLimitPerDay,
          tokenLimitPerMonth: user.tokenLimitPerMonth,
          maxTokensPerRequest: user.maxTokensPerRequest,
          tokenStats,
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
};
