import ModelRegistry from '@/lib/models/registry';
import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import {
  resolveRequestUser,
  requireAdmin,
  canAccessProvider,
  canAccessModel,
} from '@/lib/security/rbac';

export const GET = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const registry = new ModelRegistry();

    const activeProviders = await registry.getActiveProviders();

    let filteredProviders = (activeProviders || []).filter((p) => {
      return (
        p &&
        Array.isArray(p.chatModels) &&
        !p.chatModels.some((m) => m && m.key === 'error')
      );
    });

    // If user has restricted permissions, filter providers and models
    if (user && user.role !== 'admin') {
      filteredProviders = filteredProviders
        .filter(
          (p) =>
            canAccessProvider(user, p.id) ||
            (p.type ? canAccessProvider(user, p.type) : false),
        )
        .map((p) => ({
          ...p,
          chatModels: (p.chatModels || []).filter((m) => canAccessModel(user, m.key)),
          embeddingModels: (p.embeddingModels || []).filter((m) => canAccessModel(user, m.key)),
        }))
        .filter((p) => p.chatModels.length > 0 || p.embeddingModels.length > 0);
    }

    return Response.json(
      {
        providers: filteredProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching providers', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};

export const POST = async (req: NextRequest) => {
  if (configManager.isSetupComplete()) {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) {
      return adminCheck;
    }
  }

  try {
    const body = await req.json();
    const { type, name, config } = body;

    if (!type || !name || !config) {
      return Response.json(
        {
          message: 'Missing required fields.',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    const newProvider = await registry.addProvider(type, name, config);

    return Response.json(
      {
        provider: newProvider,
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while creating provider:', err?.message || err);
    const message = err?.message || 'An error has occurred.';
    const isClientError =
      message.includes('SSRF Protection') ||
      message.includes('Invalid') ||
      message.includes('Missing') ||
      message.includes('required');

    return Response.json(
      {
        message,
      },
      {
        status: isClientError ? 400 : 500,
      },
    );
  }
};

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
};
