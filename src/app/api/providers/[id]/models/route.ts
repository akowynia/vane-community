import ModelRegistry from '@/lib/models/registry';
import { Model } from '@/lib/models/types';
import { NextRequest } from 'next/server';

export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const providerId = decodeURIComponent(id || '').trim();

    const body: Partial<Model> & { type: 'embedding' | 'chat' } =
      await req.json();

    if (!body.key || !body.name) {
      return Response.json(
        {
          message: 'Key and name must be provided',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    await registry.addProviderModel(providerId, body.type, body);

    return Response.json(
      {
        message: 'Model added successfully',
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while adding provider model', err);
    return Response.json(
      {
        message: err?.message || 'An error has occurred.',
      },
      {
        status: 400,
      },
    );
  }
};

export const DELETE = async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const providerId = decodeURIComponent(id || '').trim();

    const body: { key: string; type: 'embedding' | 'chat' } = await req.json();

    if (!body.key) {
      return Response.json(
        {
          message: 'Key must be provided',
        },
        {
          status: 400,
        },
      );
    }

    const registry = new ModelRegistry();

    await registry.removeProviderModel(providerId, body.type, body.key);

    return Response.json(
      {
        message: 'Model deleted successfully',
      },
      {
        status: 200,
      },
    );
  } catch (err: any) {
    console.error('An error occurred while deleting provider model', err);
    return Response.json(
      {
        message: err?.message || 'An error has occurred.',
      },
      {
        status: 400,
      },
    );
  }
};
