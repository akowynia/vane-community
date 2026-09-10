export const dynamic = 'force-dynamic';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpadTemplates } from '@/lib/db/schema';
import { eq, or, isNull, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';
import crypto from 'crypto';
import { getLocalizedBuiltinTemplate } from '@/lib/scratchpad/builtinTemplates';

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  description: z.string().max(300).optional().nullable(),
  icon: z.string().max(50).optional().default('FileText'),
  content: z.string().min(1, 'Template content is required'),
  systemInstructions: z.string().optional().nullable(),
});

export const GET = async (req: Request) => {
  try {
    ensureScratchpadTables();
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    let templates: any[] = [];
    if (instanceMode === 'multi') {
      if (!user) {
        templates = await db.query.scratchpadTemplates.findMany({
          where: eq(scratchpadTemplates.isBuiltin, true),
          orderBy: [desc(scratchpadTemplates.isBuiltin), desc(scratchpadTemplates.createdAt)],
        });
      } else if (user.role === 'admin') {
        templates = await db.query.scratchpadTemplates.findMany({
          orderBy: [desc(scratchpadTemplates.isBuiltin), desc(scratchpadTemplates.createdAt)],
        });
      } else {
        templates = await db.query.scratchpadTemplates.findMany({
          where: or(
            eq(scratchpadTemplates.isBuiltin, true),
            eq(scratchpadTemplates.userId, user.id),
          ),
          orderBy: [desc(scratchpadTemplates.isBuiltin), desc(scratchpadTemplates.createdAt)],
        });
      }
    } else {
      templates = await db.query.scratchpadTemplates.findMany({
        orderBy: [desc(scratchpadTemplates.isBuiltin), desc(scratchpadTemplates.createdAt)],
      });
    }

    const acceptLang = req.headers.get('accept-language')?.slice(0, 2) || 'en';

    const sanitized = templates.map((t) => {
      let localized = { ...t };
      if (t.isBuiltin) {
        const builtin = getLocalizedBuiltinTemplate(t.id, acceptLang);
        if (builtin) {
          localized = {
            ...localized,
            name: builtin.name,
            description: builtin.description,
            content: builtin.content,
            systemInstructions: builtin.systemInstructions,
          };
        }
      }

      return {
        ...localized,
        isOwner:
          !t.isBuiltin &&
          (instanceMode === 'single' ||
            (user && (user.role === 'admin' || user.id === t.userId))),
      };
    });

    return Response.json({ templates: sanitized });
  } catch (err: any) {
    console.error('Error fetching scratchpad templates:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch templates', templates: [] },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    ensureScratchpadTables();
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && !user) {
      return Response.json({ message: 'Login required.' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid data', errors: parsed.error.issues },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.insert(scratchpadTemplates).values({
      id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      icon: parsed.data.icon || 'FileText',
      content: parsed.data.content,
      systemInstructions: parsed.data.systemInstructions || null,
      isBuiltin: false,
      userId: user?.id || null,
      createdAt: now,
      updatedAt: now,
    });

    return Response.json(
      {
        success: true,
        template: {
          id,
          name: parsed.data.name,
          description: parsed.data.description,
          icon: parsed.data.icon || 'FileText',
          content: parsed.data.content,
          systemInstructions: parsed.data.systemInstructions,
          isBuiltin: false,
          isOwner: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error creating scratchpad template:', err);
    return Response.json(
      { message: err?.message || 'Failed to create template' },
      { status: 500 },
    );
  }
};
