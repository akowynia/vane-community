export const dynamic = 'force-dynamic';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpads, scratchpadVersions } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import crypto from 'crypto';

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id, versionId } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const sketch = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!sketch) {
      return Response.json({ message: 'Scratchpad not found.' }, { status: 404 });
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin' && sketch.userId !== user.id) {
      return Response.json({ message: 'You do not have permission to access this scratchpad.' }, { status: 403 });
    }

    const targetVersion = await db.query.scratchpadVersions.findFirst({
      where: and(
        eq(scratchpadVersions.id, versionId),
        eq(scratchpadVersions.scratchpadId, id),
      ),
    });

    if (!targetVersion) {
      return Response.json({ message: 'The specified version does not exist.' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Update scratchpad with reverted content and title
    await db
      .update(scratchpads)
      .set({
        title: targetVersion.title,
        content: targetVersion.content,
        sources: targetVersion.sources || [],
        updatedAt: now,
      })
      .where(eq(scratchpads.id, id));

    // Append a new version snapshot indicating the revert
    const allVersions = await db.query.scratchpadVersions.findMany({
      where: eq(scratchpadVersions.scratchpadId, id),
      orderBy: [desc(scratchpadVersions.versionNumber)],
    });

    const nextNumber = (allVersions[0]?.versionNumber || 0) + 1;
    const revertVersion = {
      id: crypto.randomUUID(),
      scratchpadId: id,
      versionNumber: nextNumber,
      title: targetVersion.title,
      content: targetVersion.content,
      summary: `Restored version #${targetVersion.versionNumber}`,
      prompt: null,
      sources: targetVersion.sources || [],
      author: 'user',
      createdAt: now,
    };

    await db.insert(scratchpadVersions).values(revertVersion);

    return Response.json({
      success: true,
      scratchpad: {
        ...sketch,
        title: targetVersion.title,
        content: targetVersion.content,
        sources: targetVersion.sources || [],
        updatedAt: now,
      },
      revertedToVersion: targetVersion.versionNumber,
    });
  } catch (err: any) {
    console.error('Error reverting scratchpad version:', err);
    return Response.json(
      { message: err?.message || 'Failed to restore the version.' },
      { status: 500 },
    );
  }
};
