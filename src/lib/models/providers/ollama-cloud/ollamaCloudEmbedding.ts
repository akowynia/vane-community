import OpenAIEmbedding from '../openai/openaiEmbedding';
import { cleanOllamaCloudBaseURL } from './utils';

export type OllamaCloudEmbeddingConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
};

export class OllamaCloudEmbedding extends OpenAIEmbedding {
  constructor(protected config: OllamaCloudEmbeddingConfig) {
    const baseURL = cleanOllamaCloudBaseURL(config.baseURL);

    super({
      ...config,
      baseURL,
    });
  }
}

export default OllamaCloudEmbedding;
