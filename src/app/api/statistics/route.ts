import { NextRequest } from 'next/server';
import { getStatsSummary, clearStats, StatsFilterOptions } from '@/lib/stats/tracker';
import { requireAdmin } from '@/lib/security/rbac';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (req: NextRequest) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof Response) {
    return adminCheck;
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const timeframe = (searchParams.get('timeframe') as StatsFilterOptions['timeframe']) || '7d';
    const model = searchParams.get('model') || undefined;
    const provider = searchParams.get('provider') || undefined;
    const step = searchParams.get('step') || undefined;
    const source = (searchParams.get('source') as StatsFilterOptions['source']) || undefined;
    const userId = searchParams.get('userId') || undefined;
    const apiKeyId = searchParams.get('apiKeyId') || undefined;

    const data = await getStatsSummary({
      timeframe,
      model,
      provider,
      step,
      source,
      userId,
      apiKeyId,
    });

    return Response.json(data, { status: 200 });
  } catch (err: any) {
    console.error('Failed to get model statistics:', err);
    return Response.json(
      { message: 'Failed to retrieve model statistics', error: err?.message },
      { status: 500 },
    );
  }
};

export const DELETE = async (req: NextRequest) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof Response) {
    return adminCheck;
  }

  try {
    await clearStats();
    return Response.json(
      { success: true, message: 'Model statistics cleared successfully' },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Failed to clear model statistics:', err);
    return Response.json(
      { message: 'Failed to clear model statistics', error: err?.message },
      { status: 500 },
    );
  }
};
