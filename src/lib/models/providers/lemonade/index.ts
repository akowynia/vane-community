import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import BaseModelProvider from '../../base/provider';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseLLM from '../../base/llm';
import LemonadeLLM from './lemonadeLLM';
import BaseEmbedding from '../../base/embedding';
import LemonadeEmbedding from './lemonadeEmbedding';
import { isCloudMetadataIP } from '@/lib/security/ssrf';

interface LemonadeConfig {
  baseURL: string;
  apiKey?: string;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for Lemonade API',
    required: true,
    placeholder: 'https://api.lemonade.ai/v1',
    env: 'LEMONADE_BASE_URL',
    scope: 'server',
  },
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Lemonade API key (optional)',
    required: false,
    placeholder: 'Lemonade API Key',
    env: 'LEMONADE_API_KEY',
    scope: 'server',
  },
];

class LemonadeProvider extends BaseModelProvider<LemonadeConfig> {
  constructor(id: string, name: string, config: LemonadeConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const res = await fetch(`${this.config.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(
          `Lemonade API returned HTTP ${res.status}: ${res.statusText || 'Error'}`,
        );
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('Lemonade API returned an invalid JSON response.');
      }

      if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
        throw new Error('Lemonade API returned unexpected response format.');
      }

      const models: Model[] = (data.data || [])
        .filter((m: any) => m.recipe === 'llamacpp')
        .map((m: any) => {
          return {
            name: m.id,
            key: m.id,
          };
        });

      return {
        embedding: models,
        chat: models,
      };
    } catch (err: any) {
      if (
        err instanceof TypeError ||
        err.name === 'TimeoutError' ||
        err.name === 'AbortError'
      ) {
        throw new Error(
          'Error connecting to Lemonade API. Please ensure the base URL is correct and the service is available.',
        );
      }
      if (err instanceof SyntaxError) {
        throw new Error('Lemonade API returned an invalid JSON response.');
      }

      throw new Error(err.message || 'Error connecting to Lemonade API.');
    }
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Lemonade Chat Model. Invalid Model Selected',
      );
    }

    return new LemonadeLLM({
      apiKey: this.config.apiKey || 'not-needed',
      model: key,
      baseURL: this.config.baseURL,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Lemonade Embedding Model. Invalid Model Selected.',
      );
    }

    return new LemonadeEmbedding({
      apiKey: this.config.apiKey || 'not-needed',
      model: key,
      baseURL: this.config.baseURL,
    });
  }

  static parseAndValidate(raw: any): LemonadeConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.baseURL || typeof raw.baseURL !== 'string')
      throw new Error('Invalid config provided. Base URL must be provided as a string');

    const trimmed = raw.baseURL.trim();
    try {
      const u = new URL(trimmed);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('Base URL must start with http:// or https://');
      }
      if (u.username || u.password) {
        throw new Error('Base URL cannot contain embedded credentials.');
      }
      const hostname = u.hostname.toLowerCase().trim();
      const ipLiteral =
        hostname.startsWith('[') && hostname.endsWith(']')
          ? hostname.slice(1, -1)
          : hostname;
      if (
        isCloudMetadataIP(ipLiteral) ||
        hostname === 'metadata.google.internal' ||
        hostname === 'metadata.internal' ||
        hostname === 'instance-data' ||
        hostname.endsWith('.ec2.internal') ||
        hostname.endsWith('.google.internal')
      ) {
        throw new Error('Base URL cannot point to cloud metadata endpoints.');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Invalid Base URL format.');
    }

    return {
      baseURL: trimmed,
      apiKey: raw.apiKey ? String(raw.apiKey) : undefined,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'lemonade',
      name: 'Lemonade',
    };
  }
}

export default LemonadeProvider;
