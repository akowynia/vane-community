import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import {
  getSearchEnginesConfig,
  updateSearchEnginesConfig,
} from '@/lib/searxng/enginesManager';

export const GET = async (_req: NextRequest) => {
  try {
    const config = getSearchEnginesConfig();
    return NextResponse.json(config);
  } catch (err: any) {
    console.error('Error fetching search engines config:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch search engines configuration' },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    if (configManager.isSetupComplete()) {
      const adminCheck = await requireAdmin(req);
      if (adminCheck instanceof NextResponse) {
        return adminCheck;
      }
    }

    const body = await req.json().catch(() => ({}));
    const result = await updateSearchEnginesConfig(body);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error updating search engines config:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update search engines configuration' },
      { status: 500 },
    );
  }
};
