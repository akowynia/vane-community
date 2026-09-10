import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import BaseModelProvider from '../../base/provider';
import { Model, ModelList, ProviderMetadata } from '../../types';
import LMStudioLLM from './lmstudioLLM';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import LMStudioEmbedding from './lmstudioEmbedding';
import { isCloudMetadataIP } from '@/lib/security/ssrf';

interface LMStudioConfig {
  baseURL: string;
  queueEnabled?: boolean;
}

const providerConfigFields: UIConfigField[] = [
  {
    type: 'string',
    name: 'Base URL',
    key: 'baseURL',
    description: 'The base URL for LM Studio server',
    required: true,
    placeholder: 'http://localhost:1234',
    env: 'LM_STUDIO_BASE_URL',
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

class LMStudioProvider extends BaseModelProvider<LMStudioConfig> {
  constructor(id: string, name: string, config: LMStudioConfig) {
    super(id, name, config);
  }

  private normalizeBaseURL(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '');
    return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`;
  }

  async getDefaultModels(): Promise<ModelList> {
    try {
      const baseURL = this.normalizeBaseURL(this.config.baseURL);

      const res = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(
          `LM Studio API returned HTTP ${res.status}: ${res.statusText || 'Error'}`,
        );
      }

      let data: any;
      try {
        data = await res.json();
      } catch {
        throw new Error('LM Studio returned an invalid JSON response.');
      }

      if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
        throw new Error('LM Studio returned unexpected response format.');
      }

      const models: Model[] = (data.data || []).map((m: any) => {
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
      const cause = err?.cause;
      const causeCode = cause?.code || err?.code;
      const isSslError =
        causeCode === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
        causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        causeCode === 'CERT_HAS_EXPIRED' ||
        causeCode === 'SELF_SIGNED_CERT_IN_CHAIN' ||
        causeCode === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        err?.message?.includes('certificate') ||
        cause?.message?.includes('certificate');

      if (isSslError) {
        throw new Error(
          `LM Studio SSL error: ${causeCode || 'certificate verification failed'}. If using a reverse proxy with self-signed SSL or mkcert, ensure NODE_TLS_REJECT_UNAUTHORIZED=0 is set or custom CA certificate is installed.`,
        );
      }

      if (
        err instanceof TypeError ||
        err.name === 'TimeoutError' ||
        err.name === 'AbortError'
      ) {
        throw new Error(
          'Error connecting to LM Studio. Please ensure the base URL is correct and the LM Studio server is running.',
        );
      }
      if (err instanceof SyntaxError) {
        throw new Error('LM Studio returned an invalid JSON response.');
      }

      throw new Error(err.message || 'Error connecting to LM Studio.');
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
        'Error Loading LM Studio Chat Model. Invalid Model Selected',
      );
    }

    return new LMStudioLLM({
      apiKey: 'lm-studio',
      model: key,
      baseURL: this.normalizeBaseURL(this.config.baseURL),
    });
  }

  async loadEmbeddingModel(key: string): Promise<BaseEmbedding<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.embedding.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading LM Studio Embedding Model. Invalid Model Selected.',
      );
    }

    return new LMStudioEmbedding({
      apiKey: 'lm-studio',
      model: key,
      baseURL: this.normalizeBaseURL(this.config.baseURL),
    });
  }

  static parseAndValidate(raw: any): LMStudioConfig {
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
      baseURL: trimmed,
      queueEnabled,
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'lmstudio',
      name: 'LM Studio',
    };
  }
}

export default LMStudioProvider;
