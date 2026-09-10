import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import { providers } from '@/lib/models/providers';
import { createProviderInstance } from '@/lib/models/base/provider';
import { validateProviderBaseURL } from '@/lib/security/ssrf';
import { ConfigModelProvider } from '@/lib/config/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sanitizeErrorMessage(err: any): string {
  if (!err) return 'Failed to connect to provider';
  const msg = typeof err === 'string' ? err : err.message || '';
  if (!msg) return 'Failed to connect to provider';

  const lower = msg.toLowerCase();
  if (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<head') ||
    lower.includes('<body') ||
    lower.includes('unexpected token') ||
    lower.includes('is not valid json') ||
    lower.includes('json.parse') ||
    lower.includes('syntaxerror')
  ) {
    return 'Failed to connect to model provider: received invalid non-JSON response';
  }

  if (msg.length > 200) {
    return 'Failed to connect to model provider or received invalid response';
  }

  return msg;
}

export const POST = async (req: NextRequest) => {
  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const { providerId, type, config } = body || {};

    const configuredProviders: ConfigModelProvider[] =
      configManager.getConfig('modelProviders', []);

    let providerType = type;
    let providerName = type || 'Provider';
    let effectiveConfig = { ...(config || {}) };

    if (providerId) {
      const existing = configuredProviders.find((p) => p.id === providerId);
      if (existing) {
        providerType = providerType || existing.type;
        providerName = existing.name || providerName;
        // Merge config preserving existing unmasked secrets
        for (const key of Object.keys(existing.config || {})) {
          const incomingVal = effectiveConfig[key];
          if (
            incomingVal === undefined ||
            incomingVal === '' ||
            incomingVal === '[CONFIGURED]' ||
            (typeof incomingVal === 'string' && incomingVal.startsWith('***'))
          ) {
            effectiveConfig[key] = existing.config[key];
          }
        }
      }
    }

    if (!providerType || !providers[providerType]) {
      return NextResponse.json(
        {
          success: false,
          latencyMs: Date.now() - startTime,
          error: `Unknown or unsupported provider type: "${providerType}".`,
        },
        { status: 400 },
      );
    }

    // SSRF Validation for custom baseURL
    if (effectiveConfig.baseURL && typeof effectiveConfig.baseURL === 'string') {
      const trimmedUrl = effectiveConfig.baseURL.trim();
      if (trimmedUrl) {
        const validation = await validateProviderBaseURL(trimmedUrl, providerType);
        if (!validation.valid) {
          return NextResponse.json(
            {
              success: false,
              latencyMs: Date.now() - startTime,
              error: `SSRF Validation: ${validation.reason}`,
            },
            { status: 400 },
          );
        }
      }
    }

    const providerClass = providers[providerType];
    const instance = createProviderInstance(
      providerClass,
      providerId || crypto.randomUUID(),
      providerName,
      effectiveConfig,
    );

    const modelList = await instance.getModelList();
    const latencyMs = Date.now() - startTime;

    const chatCount = Array.isArray(modelList?.chat) ? modelList.chat.length : 0;
    const embeddingCount = Array.isArray(modelList?.embedding)
      ? modelList.embedding.length
      : 0;

    return NextResponse.json({
      success: true,
      latencyMs,
      chatModelsCount: chatCount,
      embeddingModelsCount: embeddingCount,
      chatModels: (modelList.chat || []).slice(0, 10).map((m) => m.name || m.key),
      embeddingModels: (modelList.embedding || [])
        .slice(0, 10)
        .map((m) => m.name || m.key),
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      latencyMs,
      error: sanitizeErrorMessage(err),
    });
  }
};
