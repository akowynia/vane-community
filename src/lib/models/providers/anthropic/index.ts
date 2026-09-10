import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseEmbedding from '../../base/embedding';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import AnthropicLLM from './anthropicLLM';

interface AnthropicConfig {
  apiKey: string;
}

const defaultChatModels: Model[] = [
  {
    name: 'Claude 3.7 Sonnet',
    key: 'claude-3-7-sonnet-20250219',
  },
  {
    name: 'Claude 3.5 Sonnet',
    key: 'claude-3-5-sonnet-20241022',
  },
  {
    name: 'Claude 3.5 Haiku',
    key: 'claude-3-5-haiku-20241022',
  },
  {
    name: 'Claude 3 Opus',
    key: 'claude-3-opus-20240229',
  },
  {
    name: 'Claude 3 Haiku',
    key: 'claude-3-haiku-20240307',
  },
  {
    name: 'Claude 3.7 Sonnet (latest)',
    key: 'claude-3-7-sonnet-latest',
  },
  {
    name: 'Claude 3.5 Sonnet (latest)',
    key: 'claude-3-5-sonnet-latest',
  },
  {
    name: 'Claude 3.5 Haiku (latest)',
    key: 'claude-3-5-haiku-latest',
  },
  {
    name: 'Claude 3 Opus (latest)',
    key: 'claude-3-opus-latest',
  },
];

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your Anthropic API key',
    required: true,
    placeholder: 'Anthropic API Key',
    env: 'ANTHROPIC_API_KEY',
    scope: 'server',
  },
];

class AnthropicProvider extends BaseModelProvider<AnthropicConfig> {
  constructor(id: string, name: string, config: AnthropicConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    const apiKey = this.config.apiKey ? this.config.apiKey.trim() : '';

    if (!apiKey) {
      return {
        embedding: [],
        chat: defaultChatModels,
      };
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        console.warn(
          `Anthropic API models endpoint returned HTTP ${res.status}. Falling back to default Claude models list.`,
        );
        return {
          embedding: [],
          chat: defaultChatModels,
        };
      }

      let parsed: any;
      try {
        parsed = await res.json();
      } catch {
        return {
          embedding: [],
          chat: defaultChatModels,
        };
      }

      const data = parsed.data || [];
      const fetchedModels: Model[] = data.map((m: any) => ({
        key: m.id,
        name: m.display_name || m.id,
      }));

      // Combine fetched models with default models without duplicates
      const modelMap = new Map<string, Model>();
      fetchedModels.forEach((m) => modelMap.set(m.key, m));
      defaultChatModels.forEach((m) => {
        if (!modelMap.has(m.key)) {
          modelMap.set(m.key, m);
        }
      });

      return {
        embedding: [],
        chat: Array.from(modelMap.values()),
      };
    } catch (err: any) {
      console.warn(
        `Failed to fetch dynamic Anthropic models: ${err?.message || err}. Falling back to default models list.`,
      );
      return {
        embedding: [],
        chat: defaultChatModels,
      };
    }
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id);
    const customChatModels = configProvider?.chatModels || [];

    const modelMap = new Map<string, Model>();
    defaultModels.chat.forEach((m) => modelMap.set(m.key, m));
    customChatModels.forEach((m) => modelMap.set(m.key, m));

    return {
      embedding: [],
      chat: Array.from(modelMap.values()),
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();

    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading Anthropic Chat Model. Invalid Model Selected',
      );
    }

    return new AnthropicLLM({
      apiKey: this.config.apiKey.trim(),
      model: key,
      baseURL: 'https://api.anthropic.com/v1',
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    throw new Error('Anthropic provider does not support embedding models.');
  }

  static parseAndValidate(raw: any): AnthropicConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey || typeof raw.apiKey !== 'string' || !raw.apiKey.trim())
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey).trim(),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'anthropic',
      name: 'Anthropic',
    };
  }
}

export default AnthropicProvider;
