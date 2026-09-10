import { NextRequest, NextResponse } from 'next/server';
import providerQueueManager from '@/lib/queue';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const user = await resolveRequestUser(req);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    const isAdmin = user?.role === 'admin' || (instanceMode === 'single' && !user);

    const { taskId } = await params;

    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || '';

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 },
      );
    }

    // In multi-user mode, non-admin users must be authenticated and own the task
    if (!isAdmin) {
      if (!user || user.role === 'guest') {
        return NextResponse.json(
          { error: 'Authentication required to cancel queue tasks' },
          { status: 401 },
        );
      }

      if (providerId) {
        const queueState = providerQueueManager.getQueueState(providerId);
        const allTasks = [
          ...(queueState?.activeTask ? [queueState.activeTask] : []),
          ...(queueState?.pendingTasks || []),
        ];
        const targetTask = allTasks.find((t) => t.id === taskId);
        if (targetTask && targetTask.userId && targetTask.userId !== user.id) {
          return NextResponse.json(
            { error: 'You do not have permission to cancel this task' },
            { status: 403 },
          );
        }
      }
    }

    const cancelled = providerQueueManager.cancelTask(
      providerId,
      taskId,
      'Cancelled by user',
    );

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Task not found or already completed' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message: 'Task cancelled successfully' });
  } catch (err: any) {
    console.error('Error cancelling task:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to cancel task' },
      { status: 500 },
    );
  }
}
