import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import { NextRequest, NextResponse } from 'next/server';
import { ConfigModelProvider } from '@/lib/config/types';

import { requireAdmin } from '@/lib/security/rbac';

type SaveConfigBody = {
  key: string;
  value: any;
};

export const GET = async () => {
  try {
    // Return sanitized configuration where all secrets/API keys are masked
    const values = configManager.getSanitizedConfig();
    const fields = configManager.getUIConfigSections();

    const modelRegistry = new ModelRegistry();
    const modelProviders = await modelRegistry.getActiveProviders();

    values.modelProviders = values.modelProviders.map(
      (mp: ConfigModelProvider) => {
        const activeProvider = modelProviders.find((p) => p.id === mp.id);

        return {
          ...mp,
          chatModels: activeProvider?.chatModels ?? mp.chatModels,
          embeddingModels:
            activeProvider?.embeddingModels ?? mp.embeddingModels,
        };
      },
    );

    return NextResponse.json({
      values,
      fields,
    });
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async (req: NextRequest) => {
  try {
    if (configManager.isSetupComplete()) {
      const adminCheck = await requireAdmin(req);
      if (adminCheck instanceof NextResponse) {
        return adminCheck;
      }
    }

    const body: SaveConfigBody = await req.json();

    if (!body.key || body.value === undefined) {
      return Response.json(
        {
          message: 'Key and value are required.',
        },
        {
          status: 400,
        },
      );
    }

    try {
      await configManager.updateConfig(body.key, body.value);
    } catch (validationErr: any) {
      return Response.json(
        {
          message: validationErr.message || 'Invalid configuration value.',
        },
        {
          status: 400,
        },
      );
    }

    return Response.json(
      {
        message: 'Config updated successfully.',
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('Error in updating config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
