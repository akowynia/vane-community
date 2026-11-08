import { UIConfigField } from '@/lib/config/types';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import { OllamaCloudLLM, OllamaCloudConfig } from './ollamaCloudLLM';
import { OllamaCloudEmbedding } from './ollamaCloudEmbedding';
import { cleanOllamaCloudBaseURL } from './utils';
import { isCloudMetadataIP } from '@/lib/security/ssrf';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';

const providerConfigFields: UIConfigField[] = [
  {
    name: 'API Key',
    key: 'apiKey',
    type: 'password',
    required: true,
    description: 'Your Ollama Cloud API key',
    placeholder: 'Ollama Cloud API Key',
    scope: 'server',
    env: 'OLLAMA_CLOUD_API_KEY',
  },
  {
    name: 'Base URL',
    key: 'baseURL',
    type: 'string',
    required: false,
    default: 'https://ollama.com/v1',
    description: 'The Ollama Cloud endpoint (default: https://ollama.com/v1)',
    placeholder: 'https://ollama.com/v1',
    scope: 'server',
    env: 'OLLAMA_CLOUD_BASE_URL',
  },
];

const defaultChatModels: Model[] = [
  { name: 'Llama 3.3 (70B)', key: 'llama3.3:70b' },
  { name: 'Llama 3.1 (8B)', key: 'llama3.1:8b' },
  { name: 'Qwen 2.5 (72B)', key: 'qwen2.5:72b' },
  { name: 'DeepSeek R1 (70B)', key: 'deepseek-r1:70b' },
  { name: 'Mistral Small', key: 'mistral-small' },
];

const defaultEmbeddingModels: Model[] = [
  { name: 'Nomic Embed Text', key: 'nomic-embed-text' },
  { name: 'BGE Large', key: 'bge-large' },
];

class OllamaCloudProvider extends BaseModelProvider<OllamaCloudConfig> {
  async getDefaultModels(): Promise<ModelList> {
    const v1BaseURL = cleanOllamaCloudBaseURL(this.config.baseURL);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    // 1. Try OpenAI-compatible /v1/models endpoint first
    try {
      const response = await fetch(`${v1BaseURL}/models`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.data) && data.data.length > 0) {
          const chat: Model[] = [];
          const embedding: Model[] = [];

          for (const m of data.data) {
            const key = m.id || m.name;
            const name = m.name || m.id;
            if (key.toLowerCase().includes('embed')) {
              embedding.push({ name, key });
            } else {
              chat.push({ name, key });
            }
          }

          if (chat.length > 0 || embedding.length > 0) {
            return {
              chat: chat.length > 0 ? chat : defaultChatModels,
              embedding: embedding.length > 0 ? embedding : defaultEmbeddingModels,
            };
          }
        }
      }
    } catch {
      // Fall through to native endpoint fallback
    }

    // 2. Try native /api/tags endpoint fallback
    try {
      const apiBaseURL = v1BaseURL.replace(/\/v1$/, '/api');
      const response = await fetch(`${apiBaseURL}/tags`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          const chat: Model[] = [];
          const embedding: Model[] = [];

          for (const m of data.models) {
            const key = m.model || m.name;
            const name = m.name || m.model;
            if (key.toLowerCase().includes('embed')) {
              embedding.push({ name, key });
            } else {
              chat.push({ name, key });
            }
          }

          return {
            chat: chat.length > 0 ? chat : defaultChatModels,
            embedding: embedding.length > 0 ? embedding : defaultEmbeddingModels,
          };
        }
      }
    } catch (err) {
      console.warn('Could not fetch dynamic models from Ollama Cloud, using defaults:', err);
    }

    return {
      chat: defaultChatModels,
      embedding: defaultEmbeddingModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    let baseModels: ModelList;
    try {
      baseModels = await this.getDefaultModels();
    } catch {
      baseModels = {
        chat: defaultChatModels,
        embedding: defaultEmbeddingModels,
      };
    }

    const configProvider = getConfiguredModelProviderById(this.id);
    const configuredChat = configProvider?.chatModels || [];
    const configuredEmbedding = configProvider?.embeddingModels || [];

    const chatMap = new Map<string, Model>();
    baseModels.chat.forEach((m) => chatMap.set(m.key, m));
    configuredChat.forEach((m) => chatMap.set(m.key, m));

    const embeddingMap = new Map<string, Model>();
    baseModels.embedding.forEach((m) => embeddingMap.set(m.key, m));
    configuredEmbedding.forEach((m) => embeddingMap.set(m.key, m));

    return {
      chat: Array.from(chatMap.values()),
      embedding: Array.from(embeddingMap.values()),
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists && modelList.chat.length > 0 && !modelList.chat.some((m) => m.key === 'error')) {
      throw new Error(`Error Loading Ollama Cloud Chat Model. Invalid Model Selected: "${key}"`);
    }

    return new OllamaCloudLLM({
      ...this.config,
      baseURL: cleanOllamaCloudBaseURL(this.config.baseURL),
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    return new OllamaCloudEmbedding({
      ...this.config,
      baseURL: cleanOllamaCloudBaseURL(this.config.baseURL),
      model: key,
    });
  }

  static parseAndValidate(raw: any): OllamaCloudConfig {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid config provided. Expected object');
    }
    if (!raw.apiKey || typeof raw.apiKey !== 'string' || !raw.apiKey.trim()) {
      throw new Error('Invalid config provided. API key must be provided');
    }

    const baseURL = cleanOllamaCloudBaseURL(raw.baseURL);
    try {
      const u = new URL(baseURL);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error('Base URL must start with http:// or https://');
      }
      const hostname = u.hostname.toLowerCase().trim();
      if (
        isCloudMetadataIP(hostname) ||
        hostname === 'metadata.google.internal' ||
        hostname === 'metadata.internal' ||
        hostname === 'instance-data'
      ) {
        throw new Error('Base URL cannot point to cloud metadata endpoints.');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Invalid Base URL format.');
    }

    return {
      apiKey: String(raw.apiKey).trim(),
      baseURL,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'ollama-cloud',
      name: 'Ollama Cloud',
    };
  }
}

export default OllamaCloudProvider;
