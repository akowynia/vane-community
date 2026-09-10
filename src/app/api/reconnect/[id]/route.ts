import SessionManager from '@/lib/session';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;

    const session = SessionManager.getSession(id);

    if (!session) {
      return Response.json({ message: 'Session not found' }, { status: 404 });
    }

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    let isClosed = false;
    const safeWrite = async (data: string) => {
      if (isClosed) return;
      try {
        await writer.write(encoder.encode(data));
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

    const heartbeatInterval = setInterval(() => {
      if (isClosed) {
        clearInterval(heartbeatInterval);
        return;
      }
      safeWrite(JSON.stringify({ type: 'ping' }) + '\n');
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeatInterval);
      disconnect();
      safeClose();
    };

    const disconnect = session.subscribe((event, data) => {
      if (event === 'data') {
        if (data.type === 'block') {
          safeWrite(
            JSON.stringify({
              type: 'block',
              block: data.block,
            }) + '\n',
          );
        } else if (data.type === 'updateBlock') {
          safeWrite(
            JSON.stringify({
              type: 'updateBlock',
              blockId: data.blockId,
              patch: data.patch,
            }) + '\n',
          );
        } else if (data.type === 'researchComplete') {
          safeWrite(
            JSON.stringify({
              type: 'researchComplete',
            }) + '\n',
          );
        }
      } else if (event === 'end') {
        safeWrite(
          JSON.stringify({
            type: 'messageEnd',
          }) + '\n',
        ).finally(() => {
          cleanup();
        });
      } else if (event === 'error') {
        safeWrite(
          JSON.stringify({
            type: 'error',
            data: data.data,
          }) + '\n',
        ).finally(() => {
          cleanup();
        });
      }
    });

    req.signal.addEventListener('abort', () => {
      cleanup();
    });

    return new Response(responseStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error('Error in reconnecting to session stream: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
