import { NextRequest, NextResponse } from 'next/server';
import providerQueueManager from '@/lib/queue';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId');

    if (providerId) {
      const state = providerQueueManager.getQueueState(providerId);
      if (!state) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 },
        );
      }
      return NextResponse.json({ queue: state });
    }

    const states = providerQueueManager.getAllQueuesState();
    return NextResponse.json({ queues: states });
  } catch (err: any) {
    console.error('Error fetching queue states:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch queue state' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await resolveRequestUser(req);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    const isAdmin = user?.role === 'admin' || (instanceMode === 'single' && !user);

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Administrator permissions required to change queue settings' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { providerId, enabled } = body;

    if (!providerId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required parameters: providerId (string), enabled (boolean)' },
        { status: 400 },
      );
    }

    const updated = providerQueueManager.toggleQueue(providerId, enabled);
    return NextResponse.json({ success: true, queue: updated });
  } catch (err: any) {
    console.error('Error toggling queue state:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to toggle queue state' },
      { status: 500 },
    );
  }
}
