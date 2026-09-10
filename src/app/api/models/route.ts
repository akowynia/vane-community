import ModelRegistry from '@/lib/models/registry';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const registry = new ModelRegistry();
    const activeProviders = await registry.getActiveProviders();

    const filteredProviders = activeProviders.filter((p) => {
      return !p.chatModels.some((m) => m.key === 'error');
    });

    const chatModelProviders: Record<string, Record<string, string>> = {};
    const embeddingModelProviders: Record<string, Record<string, string>> = {};

    for (const provider of filteredProviders) {
      const providerKey = provider.type || provider.name.toLowerCase();

      if (!chatModelProviders[providerKey]) {
        chatModelProviders[providerKey] = {};
      }
      for (const model of provider.chatModels) {
        chatModelProviders[providerKey][model.key] = model.name;
      }

      if (!embeddingModelProviders[providerKey]) {
        embeddingModelProviders[providerKey] = {};
      }
      for (const model of provider.embeddingModels) {
        embeddingModelProviders[providerKey][model.key] = model.name;
      }
    }

    return Response.json(
      {
        providers: filteredProviders,
        chatModelProviders,
        embeddingModelProviders,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        },
      },
    );
  } catch (err: any) {
    console.error('An error occurred in /api/models route:', err);
    return Response.json(
      {
        message: err?.message || 'Failed to fetch models.',
        chatModelProviders: {},
        embeddingModelProviders: {},
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
};

export const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    },
  });
};
