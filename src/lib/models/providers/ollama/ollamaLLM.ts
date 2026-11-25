import z from 'zod';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Agent, fetch as undiciFetch } from 'undici';
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
import { parseAndValidateObject } from '@/lib/utils/jsonParser';

type OllamaConfig = {
  baseURL: string;
  model: string;
  numCtx?: number;
  requestTimeoutMs?: number;
  options?: GenerateOptions;
};

const DEFAULT_OLLAMA_NUM_CTX = 16384;
const DEFAULT_OLLAMA_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS || '', 10) || 30 * 60 * 1000,
);
const OLLAMA_CONNECT_TIMEOUT_MS = 30 * 1000;

const sharedAgents = new Map<number, Agent>();

const getOllamaAgent = (timeoutMs: number): Agent => {
  let agent = sharedAgents.get(timeoutMs);
  if (!agent) {
    agent = new Agent({
      headersTimeout: timeoutMs,
      bodyTimeout: timeoutMs,
      connectTimeout: OLLAMA_CONNECT_TIMEOUT_MS,
    });
    sharedAgents.set(timeoutMs, agent);
  }
  return agent;
};

const createOllamaFetch = (
  timeoutMs: number,
  signalStorage: AsyncLocalStorage<AbortSignal | undefined>,
): typeof fetch => {
  const dispatcher = getOllamaAgent(timeoutMs);

  return (input, init) => {
    const signals: AbortSignal[] = [AbortSignal.timeout(timeoutMs)];
    if (init?.signal) {
      signals.push(init.signal);
    }
    const callerSignal = signalStorage.getStore();
    if (callerSignal) {
      signals.push(callerSignal);
    }

    const combinedSignal =
      signals.length === 1 ? signals[0] : AbortSignal.any(signals);

    return undiciFetch(input as any, {
      ...(init as any),
      signal: combinedSignal,
      dispatcher,
    }) as unknown as Promise<Response>;
  };
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
  private signalStorage = new AsyncLocalStorage<AbortSignal | undefined>();

  constructor(protected config: OllamaConfig) {
    super(config);

    const cleanHost = (this.config.baseURL || 'http://localhost:11434')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/(api|v1)$/i, '');

    const timeoutMs =
      typeof this.config.requestTimeoutMs === 'number' &&
      this.config.requestTimeoutMs > 0
        ? this.config.requestTimeoutMs
        : DEFAULT_OLLAMA_TIMEOUT_MS;

    this.ollamaClient = new Ollama({
      host: cleanHost,
      fetch: createOllamaFetch(timeoutMs, this.signalStorage),
    });
  }

  override getContextWindow(): number | undefined {
    if (this.config.numCtx === 0) {
      return undefined;
    }
    if (
      typeof this.config.numCtx === 'number' &&
      Number.isInteger(this.config.numCtx) &&
      this.config.numCtx >= 512
    ) {
      return this.config.numCtx;
    }
    return DEFAULT_OLLAMA_NUM_CTX;
  }

  private getNumCtxOption(): { num_ctx?: number } {
    const ctx = this.getContextWindow();
    return ctx !== undefined ? { num_ctx: ctx } : {};
  }

  private isReasoningModel(): boolean {
    const modelLower = this.config.model.toLowerCase();
    return reasoningModels.some((m) => modelLower.includes(m));
  }

  private buildChatOptions(options?: GenerateOptions) {
    return {
      top_p: options?.topP ?? this.config.options?.topP,
      temperature:
        options?.temperature ?? this.config.options?.temperature ?? 0.7,
      num_predict: options?.maxTokens ?? this.config.options?.maxTokens,
      ...this.getNumCtxOption(),
      frequency_penalty:
        options?.frequencyPenalty ?? this.config.options?.frequencyPenalty,
      presence_penalty:
        options?.presencePenalty ?? this.config.options?.presencePenalty,
      stop: options?.stopSequences ?? this.config.options?.stopSequences,
    };
  }

  private handleChatError = (err: any): never => {
    if (err?.message?.includes('does not support tools')) {
      throw new Error(
        `The selected Ollama model "${this.config.model}" does not support tools/function calling. Please select a model with tool support (such as llama3.1, qwen2.5, or mistral).`,
      );
    }
    throw err;
  };

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
    if (input.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

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

    const res = await this.signalStorage
      .run(input.signal, () =>
        this.ollamaClient.chat({
          model: this.config.model,
          messages: this.convertToOllamaMessages(input.messages),
          tools: ollamaTools.length > 0 ? ollamaTools : undefined,
          ...(this.isReasoningModel() ? { think: false } : {}),
          options: this.buildChatOptions(input.options),
        }),
      )
      .catch(this.handleChatError);

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
    if (input.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

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

    const stream = await this.signalStorage
      .run(input.signal, () =>
        this.ollamaClient.chat({
          model: this.config.model,
          messages: this.convertToOllamaMessages(input.messages),
          stream: true,
          ...(this.isReasoningModel() ? { think: false } : {}),
          tools: ollamaTools.length > 0 ? ollamaTools : undefined,
          options: this.buildChatOptions(input.options),
        }),
      )
      .catch(this.handleChatError);

    let isThinking = false;
    let hasEmittedThinkOpen = false;

    try {
      for await (const chunk of stream) {
        if (input.signal?.aborted) {
          break;
        }

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

      if (isThinking && !input.signal?.aborted) {
        isThinking = false;
        yield {
          contentChunk: '\n</think>\n\n',
          toolCallChunk: [],
          done: true,
        };
      }
    } finally {
      if (input.signal?.aborted && typeof stream.abort === 'function') {
        stream.abort();
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    if (input.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    const response = await this.signalStorage.run(input.signal, () =>
      this.ollamaClient.chat({
        model: this.config.model,
        messages: this.convertToOllamaMessages(input.messages),
        format: z.toJSONSchema(input.schema),
        ...(this.isReasoningModel() ? { think: false } : {}),
        options: this.buildChatOptions(input.options),
      }),
    );

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
    if (input.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    let recievedObj: string = '';

    const stream = await this.signalStorage.run(input.signal, () =>
      this.ollamaClient.chat({
        model: this.config.model,
        messages: this.convertToOllamaMessages(input.messages),
        format: z.toJSONSchema(input.schema),
        stream: true,
        ...(this.isReasoningModel() ? { think: false } : {}),
        options: this.buildChatOptions(input.options),
      }),
    );

    try {
      for await (const chunk of stream) {
        if (input.signal?.aborted) {
          break;
        }
        recievedObj += chunk.message.content;

        try {
          yield parse(recievedObj) as T;
        } catch (err) {
          console.log('Error parsing partial object from Ollama:', err);
          yield {} as T;
        }
      }
    } finally {
      if (input.signal?.aborted && typeof stream.abort === 'function') {
        stream.abort();
      }
    }
  }
}

export default OllamaLLM;
