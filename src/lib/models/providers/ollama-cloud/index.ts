import { UIConfigField } from '@/lib/config/types';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import { OllamaCloudLLM, OllamaCloudConfig } from './ollamaCloudLLM';
import { OllamaCloudEmbedding } from './ollamaCloudEmbedding';
import { isCloudMetadataIP } from '@/lib/security/ssrf';

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
    default: 'https://ollama.com/api',
    description: 'The Ollama Cloud endpoint (default: https://ollama.com/api)',
    placeholder: 'https://ollama.com/api',
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
    return {
      chat: defaultChatModels,
      embedding: defaultEmbeddingModels,
    };
  }

  async getModelList(): Promise<ModelList> {
    try {
      const baseURL = (this.config.baseURL || 'https://ollama.com/api').replace(/\/+$/, '');
      const response = await fetch(`${baseURL}/tags`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
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

    return this.getDefaultModels();
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    return new OllamaCloudLLM({
      ...this.config,
      model: key,
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    return new OllamaCloudEmbedding({
      ...this.config,
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

    const baseURL = (raw.baseURL || 'https://ollama.com/api').trim();
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
