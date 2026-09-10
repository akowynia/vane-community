export const dynamic = 'force-dynamic';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpadTemplates } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(300).optional().nullable(),
  icon: z.string().max(50).optional(),
  content: z.string().min(1).optional(),
  systemInstructions: z.string().optional().nullable(),
});

export const PUT = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const tpl = await db.query.scratchpadTemplates.findFirst({
      where: eq(scratchpadTemplates.id, id),
    });

    if (!tpl) {
      return Response.json({ message: 'Template not found.' }, { status: 404 });
    }

    if (tpl.isBuiltin) {
      return Response.json({ message: 'Built-in templates cannot be modified.' }, { status: 403 });
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin' && tpl.userId !== user.id) {
      return Response.json({ message: 'You do not have permission to edit this template.' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ message: 'Invalid data', errors: parsed.error.issues }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db
      .update(scratchpadTemplates)
      .set({
        name: parsed.data.name !== undefined ? parsed.data.name : tpl.name,
        description: parsed.data.description !== undefined ? parsed.data.description : tpl.description,
        icon: parsed.data.icon !== undefined ? parsed.data.icon : tpl.icon,
        content: parsed.data.content !== undefined ? parsed.data.content : tpl.content,
        systemInstructions:
          parsed.data.systemInstructions !== undefined
            ? parsed.data.systemInstructions
            : tpl.systemInstructions,
        updatedAt: now,
      })
      .where(eq(scratchpadTemplates.id, id));

    return Response.json({ success: true, message: 'Template updated successfully.' });
  } catch (err: any) {
    console.error('Error updating template:', err);
    return Response.json(
      { message: err?.message || 'Failed to update template' },
      { status: 500 },
    );
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const tpl = await db.query.scratchpadTemplates.findFirst({
      where: eq(scratchpadTemplates.id, id),
    });

    if (!tpl) {
      return Response.json({ message: 'Template not found.' }, { status: 404 });
    }

    if (tpl.isBuiltin) {
      return Response.json({ message: 'Built-in templates cannot be deleted.' }, { status: 403 });
    }

    if (instanceMode === 'multi' && user && user.role !== 'admin' && tpl.userId !== user.id) {
      return Response.json({ message: 'You do not have permission to delete this template.' }, { status: 403 });
    }

    await db.delete(scratchpadTemplates).where(eq(scratchpadTemplates.id, id));

    return Response.json({ success: true, message: 'Template deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting template:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete template' },
      { status: 500 },
    );
  }
};
