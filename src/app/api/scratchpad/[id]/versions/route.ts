export const dynamic = 'force-dynamic';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpads, scratchpadVersions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';
import crypto from 'crypto';

const createVersionSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1, 'Version content is required'),
  summary: z.string().optional().default('Manual snapshot save'),
});

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const sketch = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!sketch) {
      return Response.json({ message: 'Scratchpad not found' }, { status: 404 });
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin' && sketch.userId !== user.id) {
      return Response.json({ message: 'You do not have permission to access this scratchpad' }, { status: 403 });
    }

    const versions = await db.query.scratchpadVersions.findMany({
      where: eq(scratchpadVersions.scratchpadId, id),
      orderBy: [desc(scratchpadVersions.versionNumber)],
    });

    return Response.json({
      versions: versions.map((v) => ({
        ...v,
        sources: Array.isArray(v.sources)
          ? v.sources
          : typeof v.sources === 'string'
            ? JSON.parse(v.sources || '[]')
            : [],
      })),
    });
  } catch (err: any) {
    console.error('Error fetching scratchpad versions:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch versions', versions: [] },
      { status: 500 },
    );
  }
};

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const sketch = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!sketch) {
      return Response.json({ message: 'Scratchpad not found' }, { status: 404 });
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin' && sketch.userId !== user.id) {
      return Response.json({ message: 'You do not have permission to access this scratchpad' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createVersionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid data', errors: parsed.error.issues },
        { status: 400 },
      );
    }

    const allVersions = await db.query.scratchpadVersions.findMany({
      where: eq(scratchpadVersions.scratchpadId, id),
      orderBy: [desc(scratchpadVersions.versionNumber)],
    });

    const nextNumber = (allVersions[0]?.versionNumber || 0) + 1;
    const now = new Date().toISOString();
    const title = parsed.data.title || sketch.title;
    const content = parsed.data.content;

    const newVersion = {
      id: crypto.randomUUID(),
      scratchpadId: id,
      versionNumber: nextNumber,
      title,
      content,
      summary: parsed.data.summary || 'Manual snapshot',
      prompt: null,
      sources: sketch.sources || [],
      author: 'user',
      createdAt: now,
    };

    await db.insert(scratchpadVersions).values(newVersion);

    return Response.json({ success: true, version: newVersion }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating scratchpad version:', err);
    return Response.json(
      { message: err?.message || 'Failed to create version' },
      { status: 500 },
    );
  }
};
