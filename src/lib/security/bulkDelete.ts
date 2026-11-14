import { z } from 'zod';
import { AuthUser } from './rbac';

export const MAX_BULK_DELETE_IDS = 500;
export const SQLITE_IN_CHUNK_SIZE = 150;

const bulkDeletePayloadSchema = z.object({
  ids: z
    .array(z.string().trim().min(1, 'Identifier cannot be empty').max(200))
    .min(1, 'At least one identifier is required')
    .max(MAX_BULK_DELETE_IDS, `Maximum ${MAX_BULK_DELETE_IDS} items can be deleted at once`),
});

/**
 * Parse and validate bulk-delete request payload, returning deduplicated IDs.
 */
export async function parseBulkDeleteIds(
  req: Request,
): Promise<{ ids: string[] } | { errorResponse: Response }> {
  const body = await req.json().catch(() => null);
  const parsed = bulkDeletePayloadSchema.safeParse(body);

  if (!parsed.success) {
    return {
      errorResponse: Response.json(
        {
          message: 'Invalid bulk delete payload.',
          errors: parsed.error.format(),
        },
        { status: 400 },
      ),
    };
  }

  const uniqueIds = Array.from(new Set(parsed.data.ids));
  return { ids: uniqueIds };
}

/**
 * Split a list of IDs into chunks safe for SQLite IN (...) parameter limits.
 */
export function chunkIds(
  ids: string[],
  chunkSize: number = SQLITE_IN_CHUNK_SIZE,
): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Ensure caller is allowed to issue mutating delete operations in multi-user mode.
 */
export function requireDeleteActor(
  user: AuthUser | null,
  instanceMode: string,
): Response | null {
  if (instanceMode !== 'multi') {
    return null;
  }
  if (!user) {
    return Response.json({ message: 'Login required.' }, { status: 401 });
  }
  if (user.role === 'guest') {
    return Response.json(
      { message: 'Guest accounts cannot delete saved resources.' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Check whether the authenticated user owns or can delete a specific entity.
 * In multi-user mode, unowned/shared (null userId) entities may only be deleted by admins.
 */
export function canDeleteOwnedEntity(params: {
  user: AuthUser | null;
  instanceMode: string;
  ownerUserId: string | null | undefined;
  parentOwnerUserId?: string | null | undefined;
}): boolean {
  const { user, instanceMode, ownerUserId, parentOwnerUserId } = params;
  if (instanceMode !== 'multi') {
    return true;
  }
  if (!user || user.role === 'guest') {
    return false;
  }
  if (user.role === 'admin') {
    return true;
  }
  if (ownerUserId && ownerUserId === user.id) {
    return true;
  }
  if (parentOwnerUserId && parentOwnerUserId === user.id) {
    return true;
  }
  return false;
}

