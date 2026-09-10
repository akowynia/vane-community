import { NextRequest } from 'next/server';
import providerQueueManager from '@/lib/queue';
import { QueueManagerEvent } from '@/lib/queue/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let isClosed = false;

  const safeWrite = async (text: string) => {
    if (isClosed) return;
    try {
      await writer.write(encoder.encode(text));
    } catch {
      isClosed = true;
    }
  };

  const safeClose = async () => {
    if (isClosed) return;
    isClosed = true;
    try {
      await writer.close();
    } catch {}
  };

  // 1. Send initial state immediately
  const initialQueues = providerQueueManager.getAllQueuesState();
  await safeWrite(
    `data: ${JSON.stringify({ type: 'initial_state', queues: initialQueues, timestamp: Date.now() })}\n\n`,
  );

  // 2. Heartbeat interval
  const heartbeat = setInterval(() => {
    if (isClosed) {
      clearInterval(heartbeat);
      return;
    }
    safeWrite(`: ping\n\n`);
  }, 10000);

  // 3. Subscribe to queue events
  const onQueueEvent = (event: QueueManagerEvent) => {
    const allQueues = providerQueueManager.getAllQueuesState();
    safeWrite(
      `data: ${JSON.stringify({ ...event, allQueues })}\n\n`,
    );
  };

  providerQueueManager.on('queue_event', onQueueEvent);

  const cleanup = () => {
    clearInterval(heartbeat);
    providerQueueManager.off('queue_event', onQueueEvent);
    safeClose();
  };

  req.signal.addEventListener('abort', cleanup);

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
