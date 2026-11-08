import z from 'zod';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import { Ollama, Tool as OllamaTool, Message as OllamaMessage } from 'ollama';
import { parse } from 'partial-json';
import crypto from 'crypto';
import { Message } from '@/lib/types';
import { parseAndValidateObject, sanitizeJsonString } from '@/lib/utils/jsonParser';

type OllamaConfig = {
  baseURL: string;
  model: string;
  options?: GenerateOptions;
};

const reasoningModels = [
  'gpt-oss',
  'deepseek-r1',
  'qwen3',
  'deepseek-v3.1',
  'magistral',
  'nemotron-3',
  'nemotron-cascade-2',
  'glm-4.7-flash',
];

class OllamaLLM extends BaseLLM<OllamaConfig> {
  ollamaClient: Ollama;

  constructor(protected config: OllamaConfig) {
    super(config);

    const cleanHost = (this.config.baseURL || 'http://localhost:11434')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/(api|v1)$/i, '');

    this.ollamaClient = new Ollama({
      host: cleanHost,
    });
  }

  convertToOllamaMessages(messages: Message[]): OllamaMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_name: msg.name,
          content: msg.content,
        } as OllamaMessage;
      } else if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: msg.content ?? '',
          tool_calls:
            msg.tool_calls?.map((tc, i) => ({
              function: {
                index: i,
                name: tc.name,
                arguments: tc.arguments,
              },
            })) || [],
        };
      }

      return {
        role: msg.role,
        content: msg.content ?? '',
      } as OllamaMessage;
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const ollamaTools: OllamaTool[] = [];

    input.tools?.forEach((tool) => {
      ollamaTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema).properties,
        },
      });
    });

    const res = await this.ollamaClient
      .chat({
        model: this.config.model,
        messages: this.convertToOllamaMessages(input.messages),
        tools: ollamaTools.length > 0 ? ollamaTools : undefined,
        ...(reasoningModels.find((m) => this.config.model.includes(m))
          ? { think: false }
          : {}),
        options: {
          top_p: input.options?.topP ?? this.config.options?.topP,
          temperature:
            input.options?.temperature ?? this.config.options?.temperature ?? 0.7,
          num_predict: input.options?.maxTokens ?? this.config.options?.maxTokens,
          num_ctx: 32000,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
          stop:
            input.options?.stopSequences ?? this.config.options?.stopSequences,
        },
      })
      .catch((err: any) => {
        if (err?.message?.includes('does not support tools')) {
          throw new Error(
            `The selected Ollama model "${this.config.model}" does not support tools/function calling. Please select a model with tool support (such as llama3.1, qwen2.5, or mistral).`,
          );
        }
        throw err;
      });

    const rawContent = res.message.content || '';
    const reasoning = (res.message.thinking || '').trim();
    let content = rawContent;
    if (reasoning.length > 0 && !rawContent.includes('<think>')) {
      if (rawContent.length > 0) {
        content = `<think>\n${reasoning}\n</think>\n\n${rawContent}`;
      } else {
        content = `<think>\n${reasoning}\n</think>`;
      }
    }

    return {
      content,
      toolCalls:
        res.message.tool_calls?.map((tc) => ({
          id: crypto.randomUUID(),
          name: tc.function.name,
          arguments: tc.function.arguments,
        })) || [],
      additionalInfo: {
        reasoning: res.message.thinking,
      },
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const ollamaTools: OllamaTool[] = [];

    input.tools?.forEach((tool) => {
      ollamaTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema) as any,
        },
      });
    });

    const stream = await this.ollamaClient
      .chat({
        model: this.config.model,
        messages: this.convertToOllamaMessages(input.messages),
        stream: true,
        ...(reasoningModels.find((m) => this.config.model.includes(m))
          ? { think: false }
          : {}),
        tools: ollamaTools.length > 0 ? ollamaTools : undefined,
        options: {
          top_p: input.options?.topP ?? this.config.options?.topP,
          temperature:
            input.options?.temperature ?? this.config.options?.temperature ?? 0.7,
          num_ctx: 32000,
          num_predict: input.options?.maxTokens ?? this.config.options?.maxTokens,
          frequency_penalty:
            input.options?.frequencyPenalty ??
            this.config.options?.frequencyPenalty,
          presence_penalty:
            input.options?.presencePenalty ??
            this.config.options?.presencePenalty,
          stop:
            input.options?.stopSequences ?? this.config.options?.stopSequences,
        },
      })
      .catch((err: any) => {
        if (err?.message?.includes('does not support tools')) {
          throw new Error(
            `The selected Ollama model "${this.config.model}" does not support tools/function calling. Please select a model with tool support (such as llama3.1, qwen2.5, or mistral).`,
          );
        }
        throw err;
      });

    let isThinking = false;
    let hasEmittedThinkOpen = false;

    for await (const chunk of stream) {
      const contentDelta = chunk.message.content || '';
      const reasoningDelta = chunk.message.thinking || '';

      let textChunk = '';

      if (reasoningDelta.length > 0) {
        if (!isThinking) {
          isThinking = true;
          if (!hasEmittedThinkOpen && !reasoningDelta.includes('<think>')) {
            textChunk += '<think>\n';
            hasEmittedThinkOpen = true;
          }
        }
        textChunk += reasoningDelta;
        if (reasoningDelta.includes('</think>')) {
          isThinking = false;
        }
      }

      if (contentDelta.length > 0) {
        if (isThinking) {
          isThinking = false;
          if (!contentDelta.includes('</think>')) {
            textChunk += '\n</think>\n\n';
          }
        }
        textChunk += contentDelta;
      }

      if (chunk.done && isThinking) {
        isThinking = false;
        if (!textChunk.includes('</think>')) {
          textChunk += '\n</think>\n\n';
        }
      }

      yield {
        contentChunk: textChunk,
        toolCallChunk:
          chunk.message.tool_calls?.map((tc, i) => ({
            id: crypto
              .createHash('sha256')
              .update(
                `${i}-${tc.function.name}`,
              ) /* Ollama currently doesn't return a tool call ID so we're creating one based on the index and tool call name */
              .digest('hex'),
            name: tc.function.name,
            arguments: tc.function.arguments,
          })) || [],
        done: chunk.done,
        additionalInfo: {
          reasoning: chunk.message.thinking,
        },
      };
    }

    if (isThinking) {
      isThinking = false;
      yield {
        contentChunk: '\n</think>\n\n',
        toolCallChunk: [],
        done: true,
      };
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const response = await this.ollamaClient.chat({
      model: this.config.model,
      messages: this.convertToOllamaMessages(input.messages),
      format: z.toJSONSchema(input.schema),
      ...(reasoningModels.find((m) => this.config.model.includes(m))
        ? { think: false }
        : {}),
      options: {
        top_p: input.options?.topP ?? this.config.options?.topP,
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 0.7,
        num_predict: input.options?.maxTokens ?? this.config.options?.maxTokens,
        frequency_penalty:
          input.options?.frequencyPenalty ??
          this.config.options?.frequencyPenalty,
        presence_penalty:
          input.options?.presencePenalty ??
          this.config.options?.presencePenalty,
        stop:
          input.options?.stopSequences ?? this.config.options?.stopSequences,
      },
    });

    const msg = response.message as any;
    const rawContent =
      (typeof msg.content === 'string' && msg.content.trim().length > 0
        ? msg.content
        : '') ||
      (typeof msg.thinking === 'string' && msg.thinking.trim().length > 0
        ? msg.thinking
        : '') ||
      '';

    try {
      return parseAndValidateObject<T>(rawContent, input.schema, 'Ollama');
    } catch (err) {
      throw new Error(`Error parsing response from Ollama: ${err}`);
    }
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let recievedObj: string = '';

    const stream = await this.ollamaClient.chat({
      model: this.config.model,
      messages: this.convertToOllamaMessages(input.messages),
      format: z.toJSONSchema(input.schema),
      stream: true,
      ...(reasoningModels.find((m) => this.config.model.includes(m))
        ? { think: false }
        : {}),
      options: {
        top_p: input.options?.topP ?? this.config.options?.topP,
        temperature:
          input.options?.temperature ?? this.config.options?.temperature ?? 0.7,
        num_predict: input.options?.maxTokens ?? this.config.options?.maxTokens,
        frequency_penalty:
          input.options?.frequencyPenalty ??
          this.config.options?.frequencyPenalty,
        presence_penalty:
          input.options?.presencePenalty ??
          this.config.options?.presencePenalty,
        stop:
          input.options?.stopSequences ?? this.config.options?.stopSequences,
      },
    });

    for await (const chunk of stream) {
      recievedObj += chunk.message.content;

      try {
        yield parse(recievedObj) as T;
      } catch (err) {
        console.log('Error parsing partial object from Ollama:', err);
        yield {} as T;
      }
    }
  }
}

export default OllamaLLM;
