import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import BaseModelProvider from '../../base/provider';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import OllamaLLM from './ollamaLLM';
import OllamaEmbedding from './ollamaEmbedding';
import { isCloudMetadataIP } from '@/lib/security/ssrf';

interface OllamaConfig {
  baseURL: string;
  queueEnabled?: boolean;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for Ollama',
    required: true,
    default: 'http://host.docker.internal:11434',
    placeholder: 'http://host.docker.internal:11434',
    env: 'OLLAMA_BASE_URL',
    scope: 'server',
  },
  {
    type: 'switch',
    name: 'Enable Request Queue',
    key: 'queueEnabled',
    description:
      'Queue requests sequentially and optimize model switching in VRAM',
    required: false,
    default: true,
    scope: 'server',
  },
];

class OllamaProvider extends BaseModelProvider<OllamaConfig> {
  private static cachedModels: {
    [url: string]: { timestamp: number; models: ModelList };
  } = {};

  constructor(id: string, name: string, config: OllamaConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const cacheKey = this.config.baseURL;
    const cached = OllamaProvider.cachedModels[cacheKey];
    const now = Date.now();
    if (cached && now - cached.timestamp < 15000) {
      return cached.models;
    }

    try {
      const res = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-type': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        throw new Error(
          `Ollama API returned HTTP ${res.status}: ${res.statusText || 'Error'}`,
        );
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('Ollama API returned an invalid JSON response.');
      }

      if (!data || typeof data !== 'object' || !Array.isArray(data.models)) {
        throw new Error('Ollama API returned unexpected response format.');
      }

      const models: Model[] = (data.models || []).map((m: any) => {
        return {
          name: m.name,
          key: m.model,
        };
      });

      const result: ModelList = {
        embedding: models,
        chat: models,
      };

      OllamaProvider.cachedModels[cacheKey] = {
        timestamp: now,
        models: result,
      };

      return result;
    } catch (err: any) {
      if (cached) {
        return cached.models;
      }

      if (
        err instanceof TypeError ||
        err.name === 'TimeoutError' ||
        err.name === 'AbortError'
      ) {
        throw new Error(
          'Error connecting to Ollama API. Please ensure the base URL is correct and the Ollama server is running.',
        );
      }
      if (err instanceof SyntaxError) {
        throw new Error('Ollama API returned an invalid JSON response.');
      }

      throw new Error(err.message || 'Error connecting to Ollama API.');
    }
  }

  async getModelList(): Promise<ModelList> {
    let defaultModels: ModelList = { chat: [], embedding: [] };
    try {
      defaultModels = await this.getDefaultModels();
    } catch (err) {
      // If fetching default tags fails, return empty defaults with any user-configured models
    }

    const configProvider = getConfiguredModelProviderById(this.id);

    return {
      embedding: [
        ...defaultModels.embedding,
        ...(configProvider?.embeddingModels || []),
      ],
      chat: [
        ...defaultModels.chat,
        ...(configProvider?.chatModels || []),
      ],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    try {
      const modelList = await this.getModelList();
      const exists = modelList.chat.find((m) => m.key === key);

      if (!exists && modelList.chat.length > 0 && !modelList.chat.some((m) => m.key === 'error')) {
        console.warn(`Model "${key}" not in Ollama tags list, but attempting to load.`);
      }
    } catch {}

    return new OllamaLLM({
      baseURL: this.config.baseURL,
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    try {
      const modelList = await this.getModelList();
      const exists = modelList.embedding.find((m) => m.key === key);

      if (!exists && modelList.embedding.length > 0 && !modelList.embedding.some((m) => m.key === 'error')) {
        console.warn(`Embedding model "${key}" not in Ollama tags list, but attempting to load.`);
      }
    } catch {}

    return new OllamaEmbedding({
      model: key,
      baseURL: this.config.baseURL,
    });
  }

  static parseAndValidate(raw: any): OllamaConfig {
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

    const queueEnabled =
      raw.queueEnabled !== undefined
        ? raw.queueEnabled === true || raw.queueEnabled === 'true'
        : true;

    return {
      baseURL: trimmed.replace(/\/+$/, ''),
      queueEnabled,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'ollama',
      name: 'Ollama',
    };
  }
}

export default OllamaProvider;
