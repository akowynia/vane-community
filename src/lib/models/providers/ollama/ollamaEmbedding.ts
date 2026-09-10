import { Ollama } from 'ollama';
import BaseEmbedding from '../../base/embedding';
import { Chunk } from '@/lib/types';
import { Semaphore } from 'async-mutex';

const maxConcurrency = Math.max(
  1,
  parseInt(process.env.OLLAMA_EMBEDDING_CONCURRENCY || '2', 10) || 2,
);
const ollamaEmbeddingSemaphore = new Semaphore(maxConcurrency);

type OllamaConfig = {
  model: string;
  baseURL?: string;
};

class OllamaEmbedding extends BaseEmbedding<OllamaConfig> {
  ollamaClient: Ollama;

  constructor(protected config: OllamaConfig) {
    super(config);

    this.ollamaClient = new Ollama({
      host: this.config.baseURL || 'http://localhost:11434',
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

export default OllamaEmbedding;
