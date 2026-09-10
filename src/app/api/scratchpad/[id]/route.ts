export const dynamic = 'force-dynamic';

import db, { ensureScratchpadTables } from '@/lib/db';
import { scratchpads, scratchpadVersions, scratchpadMessages, waypoints, scratchpadTemplates } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { z } from 'zod';
import crypto from 'crypto';
import { getLocalizedBuiltinTemplate } from '@/lib/scratchpad/builtinTemplates';

const updateScratchpadSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  type: z.enum(['note', 'presentation']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  waypointId: z.string().optional().nullable(),
  templateId: z.string().optional().nullable(),
  createVersionSnapshot: z.boolean().optional().default(false),
  versionSummary: z.string().optional(),
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

    const item = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!item) {
      return Response.json({ message: 'Scratchpad not found.' }, { status: 404 });
    }

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (user.role !== 'admin' && item.userId && item.userId !== user.id) {
        return Response.json({ message: 'You do not have permission to access this scratchpad.' }, { status: 403 });
      }
    }

    // Fetch versions
    const versions = await db.query.scratchpadVersions.findMany({
      where: eq(scratchpadVersions.scratchpadId, id),
      orderBy: [desc(scratchpadVersions.versionNumber)],
    });

    // Fetch messages
    const messagesList = await db.query.scratchpadMessages.findMany({
      where: eq(scratchpadMessages.scratchpadId, id),
      orderBy: [scratchpadMessages.id],
    });

    // Fetch associated waypoint if any
    let waypointInfo: any = null;
    if (item.waypointId) {
      try {
        waypointInfo = await db.query.waypoints.findFirst({
          where: eq(waypoints.id, item.waypointId),
          columns: {
            id: true,
            name: true,
            icon: true,
            description: true,
          },
        });
      } catch {}
    }

    // Fetch associated template if any
    let templateInfo: any = null;
    if (item.templateId) {
      try {
        const acceptLang = req.headers.get('accept-language')?.slice(0, 2) || 'en';
        const builtinLoc = getLocalizedBuiltinTemplate(item.templateId, acceptLang);
        if (builtinLoc) {
          templateInfo = {
            id: item.templateId,
            name: builtinLoc.name,
            icon: builtinLoc.icon || 'FileText',
            isBuiltin: true,
          };
        } else {
          templateInfo = await db.query.scratchpadTemplates.findFirst({
            where: eq(scratchpadTemplates.id, item.templateId),
            columns: {
              id: true,
              name: true,
              icon: true,
            },
          });
        }
      } catch {}
    }

    const safeJsonArray = (val: any) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const parsedMetadata =
      typeof item.metadata === 'string'
        ? (() => {
            try {
              return JSON.parse(item.metadata || '{}');
            } catch {
              return {};
            }
          })()
        : item.metadata || {};

    return Response.json({
      scratchpad: {
        ...item,
        type: item.type || 'note',
        metadata: parsedMetadata,
        sources: safeJsonArray(item.sources),
        versions,
        messages: messagesList.map((m) => ({
          ...m,
          responseBlocks: safeJsonArray(m.responseBlocks),
          sources: safeJsonArray(m.sources),
          metrics:
            typeof m.metrics === 'string'
              ? (() => {
                  try {
                    return JSON.parse(m.metrics);
                  } catch {
                    return null;
                  }
                })()
              : m.metrics || null,
        })),

        waypoint: waypointInfo,
        template: templateInfo,
        canEdit: true,
      },
    });
  } catch (err: any) {
    console.error('Error fetching scratchpad detail:', err);
    return Response.json(
      { message: err?.message || 'Failed to fetch the scratchpad.' },
      { status: 500 },
    );
  }
};

export const PUT = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    ensureScratchpadTables();
    const { id } = await params;
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    const existing = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!existing) {
      return Response.json({ message: 'Scratchpad not found.' }, { status: 404 });
    }

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (user.role !== 'admin' && existing.userId && existing.userId !== user.id) {
        return Response.json({ message: 'You do not have permission to edit this scratchpad.' }, { status: 403 });
      }
    }

    const body = await req.json();
    const parsed = updateScratchpadSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: 'Invalid request data', errors: parsed.error.issues },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const newTitle = parsed.data.title !== undefined ? parsed.data.title : existing.title;
    const newContent = parsed.data.content !== undefined ? parsed.data.content : existing.content;
    const newType = parsed.data.type !== undefined ? parsed.data.type : existing.type;
    const newMetadata = parsed.data.metadata !== undefined ? parsed.data.metadata : existing.metadata;
    const newWaypointId = parsed.data.waypointId !== undefined ? parsed.data.waypointId : existing.waypointId;
    const newTemplateId = parsed.data.templateId !== undefined ? parsed.data.templateId : existing.templateId;

    await db
      .update(scratchpads)
      .set({
        title: newTitle,
        content: newContent,
        type: newType,
        metadata: newMetadata,
        waypointId: newWaypointId,
        templateId: newTemplateId,
        updatedAt: now,
      })
      .where(eq(scratchpads.id, id));

    // Check if a manual version snapshot is requested
    if (parsed.data.createVersionSnapshot) {
      const allVersions = await db.query.scratchpadVersions.findMany({
        where: eq(scratchpadVersions.scratchpadId, id),
        orderBy: [desc(scratchpadVersions.versionNumber)],
      });

      const nextVersionNumber = (allVersions[0]?.versionNumber || 0) + 1;
      await db.insert(scratchpadVersions).values({
        id: crypto.randomUUID(),
        scratchpadId: id,
        versionNumber: nextVersionNumber,
        title: newTitle,
        content: newContent,
        summary: parsed.data.versionSummary || 'Manual version save',
        prompt: null,
        sources: existing.sources || [],
        author: 'user',
        createdAt: now,
      });
    }

    return Response.json({
      success: true,
      scratchpad: {
        ...existing,
        title: newTitle,
        content: newContent,
        type: newType,
        metadata: newMetadata,
        waypointId: newWaypointId,
        templateId: newTemplateId,
        updatedAt: now,
      },
    });
  } catch (err: any) {
    console.error('Error updating scratchpad:', err);
    return Response.json(
      { message: err?.message || 'Failed to update the scratchpad.' },
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

    const existing = await db.query.scratchpads.findFirst({
      where: eq(scratchpads.id, id),
    });

    if (!existing) {
      return Response.json({ message: 'Scratchpad not found.' }, { status: 404 });
    }

    if (instanceMode === 'multi') {
      if (!user) {
        return Response.json({ message: 'Login required.' }, { status: 401 });
      }
      if (user.role !== 'admin' && existing.userId && existing.userId !== user.id) {
        return Response.json({ message: 'You do not have permission to delete this scratchpad.' }, { status: 403 });
      }
    }

    // Delete associated versions and messages
    await db.delete(scratchpadVersions).where(eq(scratchpadVersions.scratchpadId, id));
    await db.delete(scratchpadMessages).where(eq(scratchpadMessages.scratchpadId, id));
    await db.delete(scratchpads).where(eq(scratchpads.id, id));

    return Response.json({ success: true, message: 'Scratchpad deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting scratchpad:', err);
    return Response.json(
      { message: err?.message || 'Failed to delete the scratchpad.' },
      { status: 500 },
    );
  }
};
