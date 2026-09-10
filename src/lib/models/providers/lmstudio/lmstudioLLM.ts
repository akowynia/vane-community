import OpenAI from 'openai';
import OpenAILLM from '../openai/openaiLLM';

class LMStudioLLM extends OpenAILLM {
  constructor(config: any) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey || 'lm-studio',
      baseURL: this.config.baseURL,
      timeout: 30 * 60 * 1000, // 30 minutes for long prompt processing on local GPUs
      maxRetries: 1,
    });
  }
}

export default LMStudioLLM;
