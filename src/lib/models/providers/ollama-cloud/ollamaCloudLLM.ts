import OpenAILLM from '../openai/openaiLLM';
import { GenerateOptions } from '../../types';
import { cleanOllamaCloudBaseURL } from './utils';

export type OllamaCloudConfig = {
  apiKey: string;
  baseURL?: string;
};

export type OllamaCloudLLMConfig = {
  apiKey: string;
  baseURL?: string;
  model: string;
  options?: GenerateOptions;
};

export class OllamaCloudLLM extends OpenAILLM {
  constructor(protected config: OllamaCloudLLMConfig) {
    const baseURL = cleanOllamaCloudBaseURL(config.baseURL);

    super({
      ...config,
      baseURL,
    });
  }
}

export default OllamaCloudLLM;
