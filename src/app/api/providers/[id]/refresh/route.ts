export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import ModelRegistry from '@/lib/models/registry';
import { requireAdmin } from '@/lib/security/rbac';

export const POST = async (
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) => {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const params = await props.params;
    const providerId = params.id;

    if (!providerId) {
      return NextResponse.json(
        { message: 'Provider ID is required' },
        { status: 400 },
      );
    }

    const modelRegistry = new ModelRegistry();
    const activeProviders = await modelRegistry.getActiveProviders();
    const provider = activeProviders.find((p) => p.id === providerId);

    if (!provider) {
      return NextResponse.json(
        { message: 'Provider not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: 'Models refreshed successfully',
        chatModels: provider.chatModels || [],
        embeddingModels: provider.embeddingModels || [],
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error refreshing provider models:', err);
    return NextResponse.json(
      { message: err.message || 'Failed to refresh models' },
      { status: 500 },
    );
  }
};
