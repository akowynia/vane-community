import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { and, eq, gte } from 'drizzle-orm';

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) => {
  try {
    const { id, messageId } = await params;

    const targetMessage = await db.query.messages.findFirst({
      where: and(eq(messages.chatId, id), eq(messages.messageId, messageId)),
    });

    if (!targetMessage) {
      return Response.json({ message: 'Message not found' }, { status: 404 });
    }

    // Delete this message and any later messages in this thread
    await db
      .delete(messages)
      .where(
        and(eq(messages.chatId, id), gte(messages.id, targetMessage.id)),
      )
      .execute();

    // If the chat no longer has any messages, delete the chat record as well
    const remainingMessages = await db.query.messages.findMany({
      where: eq(messages.chatId, id),
    });

    if (remainingMessages.length === 0) {
      await db.delete(chats).where(eq(chats.id, id)).execute();
    }

    return Response.json(
      { message: 'Message deleted successfully' },
      { status: 200 },
    );
  } catch (err) {
    console.error('Error in deleting message by id: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
