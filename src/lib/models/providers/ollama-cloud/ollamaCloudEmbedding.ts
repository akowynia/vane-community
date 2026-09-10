import { Ollama } from 'ollama';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';
import { Semaphore } from 'async-mutex';
import { validateHttpUrl } from '@/lib/security/ssrf';

const ollamaEmbeddingSemaphore = new Semaphore(2);

export type OllamaCloudEmbeddingConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
};

export class OllamaCloudEmbedding extends BaseEmbedding<OllamaCloudEmbeddingConfig> {
  ollamaClient: Ollama;

  constructor(protected config: OllamaCloudEmbeddingConfig) {
    super(config);

    const host = (config.baseURL || 'https://ollama.com/api').replace(/\/+$/, '');
    if (!validateHttpUrl(host)) {
      throw new Error(`SSRF validation failed for Ollama Cloud host: ${host}`);
    }

    this.ollamaClient = new Ollama({
      host,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
  }

  async embedText(texts: string[]): Promise<number[][]> {
    return ollamaEmbeddingSemaphore.runExclusive(async () => {
      const response = await this.ollamaClient.embed({
        input: texts,
        model: this.config.model,
      });

      return response.embeddings;
    });
  }

  async embedChunks(chunks: Chunk[]): Promise<number[][]> {
    return ollamaEmbeddingSemaphore.runExclusive(async () => {
      const response = await this.ollamaClient.embed({
        input: chunks.map((c) => c.content),
        model: this.config.model,
      });

      return response.embeddings;
    });
  }
}

export default OllamaCloudEmbedding;

