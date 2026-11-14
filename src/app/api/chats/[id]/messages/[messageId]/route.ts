import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { and, eq, gte } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import {
  canDeleteOwnedEntity,
  requireDeleteActor,
} from '@/lib/security/bulkDelete';
import configManager from '@/lib/config';

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) => {
  try {
    const { id, messageId } = await params;

    const chatExists = await db.query.chats.findFirst({
      where: eq(chats.id, id),
    });

    if (!chatExists) {
      return Response.json({ message: 'Chat not found' }, { status: 404 });
    }

    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');
    const authError = requireDeleteActor(user, instanceMode);
    if (authError) {
      return authError;
    }

    if (
      !canDeleteOwnedEntity({
        user,
        instanceMode,
        ownerUserId: chatExists.userId,
      })
    ) {
      return Response.json({ message: 'Forbidden' }, { status: 403 });
    }

    const targetMessage = await db.query.messages.findFirst({
      where: and(eq(messages.chatId, id), eq(messages.messageId, messageId)),
    });

    if (!targetMessage) {
      return Response.json({ message: 'Message not found' }, { status: 404 });
    }

    // Delete this message and any later messages in this thread
    db.transaction((tx) => {
      tx.delete(messages)
        .where(
          and(eq(messages.chatId, id), gte(messages.id, targetMessage.id)),
        )
        .run();

      const remainingMessages = tx
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.chatId, id))
        .all();

      if (remainingMessages.length === 0) {
        tx.delete(chats).where(eq(chats.id, id)).run();
      }
    });

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
