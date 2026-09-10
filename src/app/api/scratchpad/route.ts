export const dynamic = 'force-dynamic';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpads, scratchpadVersions, scratchpadMessages, scratchpadTemplates } from '@/lib/db/schema';
import { eq, or, isNull, desc, like } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';
import crypto from 'crypto';
import { getLocalizedBuiltinTemplate } from '@/lib/scratchpad/builtinTemplates';

const createScratchpadSchema = z.object({
  title: z.string().max(200).optional().default('Untitled'),
  content: z.string().optional().default(''),
  type: z.enum(['note', 'presentation']).optional().default('note'),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  templateId: z.string().optional().nullable(),
  waypointId: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
});

export const GET = async (req: Request) => {
  try {
    ensureScratchpadTables();
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const url = new URL(req.url);
    const search = url.searchParams.get('q')?.trim() || '';

    let items: any[] = [];
    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ scratchpads: [] }, { status: 200 });
      } else if (user.role === 'admin') {
        items = await db.query.scratchpads.findMany({
          orderBy: [desc(scratchpads.updatedAt)],
        });
      } else {
        items = await db.query.scratchpads.findMany({
          where: eq(scratchpads.userId, user.id),
          orderBy: [desc(scratchpads.updatedAt)],
        });
      }
    } else {
      items = await db.query.scratchpads.findMany({
        orderBy: [desc(scratchpads.updatedAt)],
      });
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      items = items.filter(
        (item) =>
          (item.title && item.title.toLowerCase().includes(lowerSearch)) ||
          (item.content && item.content.toLowerCase().includes(lowerSearch)),
      );
    }

    // Get versions count and messages count for each scratchpad
    const allVersions = await db.query.scratchpadVersions.findMany({
      columns: {
        scratchpadId: true,
        versionNumber: true,
      },
    });

    const allMessages = await db.query.scratchpadMessages.findMany({
      columns: {
        scratchpadId: true,
      },
    });

    const versionCountMap = new Map<string, number>();
    for (const v of allVersions) {
      versionCountMap.set(
        v.scratchpadId,
        (versionCountMap.get(v.scratchpadId) || 0) + 1,
      );
    }

    const messageCountMap = new Map<string, number>();
    for (const m of allMessages) {
      messageCountMap.set(
        m.scratchpadId,
        (messageCountMap.get(m.scratchpadId) || 0) + 1,
      );
    }

    const sanitized = items.map((item) => {
      let sourcesCount = 0;
      try {
        const parsedSources =
          typeof item.sources === 'string'
            ? JSON.parse(item.sources || '[]')
            : item.sources || [];
        sourcesCount = Array.isArray(parsedSources) ? parsedSources.length : 0;
      } catch {
        sourcesCount = 0;
      }

      // Stripped excerpt for preview
      const cleanExcerpt = (item.content || '')
        .replace(/[#*`_~>\-[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160);

      return {
        id: item.id,
        title: item.title || 'Untitled',
        excerpt: cleanExcerpt,
        type: item.type || 'note',
        metadata: typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {}),
        userId: item.userId,
        waypointId: item.waypointId,
        templateId: item.templateId,
        sourcesCount,
        versionsCount: versionCountMap.get(item.id) || 1,
        messagesCount: messageCountMap.get(item.id) || 0,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return Response.json({ scratchpads: sanitized }, { status: 200 });
  } catch (err: any) {
    console.error('Error fetching scratchpads:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch scratchpads', scratchpads: [] },
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
      return Response.json(
        { message: 'Login required to create a scratchpad.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = createScratchpadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request data', errors: parsed.error.issues },
        { status: 400 },
      );
    }

    let { title, content, type, metadata, templateId, waypointId } = parsed.data;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    // If template specified, fill initial content if empty
    if (templateId) {
      try {
        const acceptLang = req.headers.get('accept-language')?.slice(0, 2) || 'en';
        const builtinLoc = getLocalizedBuiltinTemplate(templateId, acceptLang);

        if (builtinLoc) {
          if (!content || content.trim() === '') {
            content = builtinLoc.content;
          }
          if (!title || title === 'Untitled' || title === 'New scratchpad') {
            title = builtinLoc.name;
          }
        } else {
          const tpl = await db.query.scratchpadTemplates.findFirst({
            where: eq(scratchpadTemplates.id, templateId),
          });
          if (tpl) {
            if (!content || content.trim() === '') {
              content = tpl.content;
            }
            if (!title || title === 'Untitled' || title === 'New scratchpad') {
              title = tpl.name;
            }
          }
        }
      } catch (tplErr) {
        console.warn('Failed to load template on create:', tplErr);
      }
    }

    const initialTitle = (title || '').trim() || (type === 'presentation' ? 'New presentation' : 'New scratchpad');
    const initialContent = content || '';

    await db.insert(scratchpads).values({
      id,
      title: initialTitle,
      content: initialContent,
      type: type || 'note',
      metadata: metadata || {},
      userId: user?.id || null,
      waypointId: waypointId || null,
      templateId: templateId || null,
      sources: [],
      createdAt: now,
      updatedAt: now,
    });

    // Create initial version #1
    await db.insert(scratchpadVersions).values({
      id: crypto.randomUUID(),
      scratchpadId: id,
      versionNumber: 1,
      title: initialTitle,
      content: initialContent,
      summary: templateId
        ? 'Created from template'
        : type === 'presentation'
          ? 'Presentation created'
          : 'Scratchpad created',
      prompt: parsed.data.prompt || null,
      sources: [],
      author: 'user',
      createdAt: now,
    });

    return Response.json(
      {
        success: true,
        scratchpad: {
          id,
          title: initialTitle,
          content: initialContent,
          type: type || 'note',
          metadata: metadata || {},
          waypointId,
          templateId,
          createdAt: now,
          updatedAt: now,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error('Error creating scratchpad:', err);
    return Response.json(
      { message: err?.message || 'Failed to create a new scratchpad.' },
      { status: 500 },
    );
  }
};
