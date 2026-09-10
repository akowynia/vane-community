import { ConfigModelProvider } from '../config/types';
import BaseModelProvider, { createProviderInstance } from './base/provider';
import { getConfiguredModelProviders } from '../config/serverRegistry';
import { providers } from './providers';
import { MinimalProvider, ModelList } from './types';
import configManager from '../config';
import { validateProviderBaseURL } from '../security/ssrf';

function sanitizeErrorMessage(err: any): string {
  if (!err) return 'Failed to connect to provider';
  const msg = typeof err === 'string' ? err : err.message || '';
  if (!msg) return 'Failed to connect to provider';

  const lower = msg.toLowerCase();
  // If the error contains raw HTML, JSON parse errors containing body snippets, or unexpected tokens:
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

  // If the error message is too long (possibly leaking body or stack trace), sanitize:
  if (msg.length > 200) {
    return 'Failed to connect to model provider or received invalid response';
  }

  return msg;
}

class ModelRegistry {
  activeProviders: (ConfigModelProvider & {
    provider: BaseModelProvider<any>;
  })[] = [];

  constructor() {
    this.initializeActiveProviders();
  }

  private initializeActiveProviders() {
    const configuredProviders = getConfiguredModelProviders();

    configuredProviders.forEach((p) => {
      try {
        const provider = providers[p.type];
        if (!provider) throw new Error('Invalid provider type');

        this.activeProviders.push({
          ...p,
          provider: createProviderInstance(provider, p.id, p.name, p.config),
        });
      } catch (err) {
        console.error(
          `Failed to initialize provider. Type: ${p.type}, ID: ${p.id}, Error: ${err}`,
        );
      }
    });
  }

  async getActiveProviders() {
    const providers: MinimalProvider[] = [];

    await Promise.all(
      this.activeProviders.map(async (p) => {
        let m: ModelList = { chat: [], embedding: [] };

        try {
          m = await p.provider.getModelList();
        } catch (err: any) {
          console.error(
            `Failed to get model list. Type: ${p.type}, ID: ${p.id}, Error: ${err.message}`,
          );

          m = {
            chat: [
              {
                key: 'error',
                name: sanitizeErrorMessage(err),
              },
            ],
            embedding: [],
          };
        }

        providers.push({
          id: p.id,
          name: p.name,
          type: p.type,
          chatModels: m.chat,
          embeddingModels: m.embedding,
        });
      }),
    );

    return providers;
  }

  async loadChatModel(providerId: string, modelName: string) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadChatModel(modelName);

    return model;
  }

  async loadEmbeddingModel(providerId: string, modelName: string) {
    const provider = this.activeProviders.find((p) => p.id === providerId);

    if (!provider) throw new Error('Invalid provider id');

    const model = await provider.provider.loadEmbeddingModel(modelName);

    return model;
  }

  async addProvider(
    type: string,
    name: string,
    config: Record<string, any>,
  ): Promise<ConfigModelProvider> {
    const provider = providers[type];
    if (!provider) throw new Error('Invalid provider type');

    // SSRF Validation for baseURL if provided
    if (config?.baseURL && typeof config.baseURL === 'string') {
      const validation = await validateProviderBaseURL(config.baseURL, type);
      if (!validation.valid) {
        throw new Error(
          `SSRF Protection: Invalid base URL - ${validation.reason}`,
        );
      }
    }

    const newProvider = configManager.addModelProvider(type, name, config);

    const instance = createProviderInstance(
      provider,
      newProvider.id,
      newProvider.name,
      newProvider.config,
    );

    let m: ModelList = { chat: [], embedding: [] };

    try {
      m = await instance.getModelList();
    } catch (err: any) {
      console.error(
        `Failed to get model list for newly added provider. Type: ${type}, ID: ${newProvider.id}, Error: ${err.message}`,
      );

      m = {
        chat: [
          {
            key: 'error',
            name: sanitizeErrorMessage(err),
          },
        ],
        embedding: [],
      };
    }

    this.activeProviders.push({
      ...newProvider,
      provider: instance,
    });

    const sanitized = configManager.sanitizeModelProvider(newProvider);

    return {
      ...sanitized,
      chatModels: m.chat || [],
      embeddingModels: m.embedding || [],
    };
  }

  async removeProvider(providerId: string): Promise<void> {
    configManager.removeModelProvider(providerId);
    this.activeProviders = this.activeProviders.filter(
      (p) => p.id !== providerId,
    );

    return;
  }

  async updateProvider(
    providerId: string,
    name: string,
    config: any,
  ): Promise<ConfigModelProvider> {
    const providerEntry = this.activeProviders.find((p) => p.id === providerId);
    const providerType = providerEntry?.type;

    // SSRF Validation for baseURL if provided
    if (config?.baseURL && typeof config.baseURL === 'string') {
      const validation = await validateProviderBaseURL(config.baseURL, providerType);
      if (!validation.valid) {
        throw new Error(
          `SSRF Protection: Invalid base URL - ${validation.reason}`,
        );
      }
    }

    const updated = await configManager.updateModelProvider(
      providerId,
      name,
      config,
    );
    const instance = createProviderInstance(
      providers[updated.type],
      providerId,
      name,
      updated.config,
    );

    let m: ModelList = { chat: [], embedding: [] };

    try {
      m = await instance.getModelList();
    } catch (err: any) {
      console.error(
        `Failed to get model list for updated provider. Type: ${updated.type}, ID: ${updated.id}, Error: ${err.message}`,
      );

      m = {
        chat: [
          {
            key: 'error',
            name: sanitizeErrorMessage(err),
          },
        ],
        embedding: [],
      };
    }

    const existingIndex = this.activeProviders.findIndex(
      (p) => p.id === providerId,
    );
    if (existingIndex !== -1) {
      this.activeProviders[existingIndex] = {
        ...updated,
        provider: instance,
      };
    } else {
      this.activeProviders.push({
        ...updated,
        provider: instance,
      });
    }

    const sanitized = configManager.sanitizeModelProvider(updated);

    return {
      ...sanitized,
      chatModels: m.chat || [],
      embeddingModels: m.embedding || [],
    };
  }

  /* Using async here because maybe in the future we might want to add some validation?? */
  async addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ): Promise<any> {
    const addedModel = configManager.addProviderModel(providerId, type, model);
    return addedModel;
  }

  async removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ): Promise<void> {
    configManager.removeProviderModel(providerId, type, modelKey);
    return;
  }
}

export default ModelRegistry;
