export const dynamic = 'force-dynamic';

import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import { requireRole } from '@/lib/security/middleware';
import configManager from '@/lib/config';

export const POST = async (req: NextRequest) => {
  try {
    const user = await resolveRequestUser(req);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi') {
      requireRole(req, ['admin']);
      // Delete all chats (messages are cascade deleted)
      const deleted = await db.delete(chats).returning({ id: chats.id });
      return Response.json({
        message: `Cleared ${deleted.length} chats.`,
        cleared: deleted.length,
      }, { status: 200 });
    }

    // Single-user mode: all chats belong to this user
    const deleted = await db.delete(chats).returning({ id: chats.id });
    return Response.json({
      message: `Cleared ${deleted.length} chats.`,
      cleared: deleted.length,
    }, { status: 200 });
  } catch (err: any) {
    console.error('Error in clearing all chats:', err);
    return Response.json(
      { message: err?.message || 'An error has occurred.' },
      { status: 500 },
    );
  }
};
