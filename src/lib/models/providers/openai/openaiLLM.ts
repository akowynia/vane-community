import OpenAI from 'openai';
import BaseLLM from '../../base/llm';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import { parse } from 'partial-json';
import z from 'zod';
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from 'openai/resources/index.mjs';
import { Message } from '@/lib/types';
import { parseAndValidateObject } from '@/lib/utils/jsonParser';

type OpenAIConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

const isReasoningModel = (model: string): boolean => {
  const m = model.toLowerCase();
  return (
    m.startsWith('o1') ||
    m.startsWith('o3') ||
    m.startsWith('o4') ||
    m.startsWith('gpt-5') ||
    m.includes('reasoning') ||
    m.includes('deepseek-r1')
  );
};

class OpenAILLM extends BaseLLM<OpenAIConfig> {
  openAIClient: OpenAI;

  constructor(protected config: OpenAIConfig) {
    super(config);

    this.openAIClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL || 'https://api.openai.com/v1',
    });
  }

  convertToOpenAIMessages(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.id,
          content: msg.content,
        } as ChatCompletionToolMessageParam;
      } else if (msg.role === 'assistant') {
        const hasToolCalls = Boolean(
          msg.tool_calls && msg.tool_calls.length > 0,
        );
        return {
          role: 'assistant',
          content:
            msg.content && msg.content.length > 0
              ? msg.content
              : hasToolCalls
                ? ''
                : (msg.content ?? ''),
          ...(hasToolCalls && {
            tool_calls: msg.tool_calls?.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          }),
        } as ChatCompletionAssistantMessageParam;
      }

      return msg;
    });
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const openaiTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const isReasoning = isReasoningModel(this.config.model);

    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      messages: this.convertToOpenAIMessages(input.messages),
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      ...(!isReasoning
        ? {
            temperature:
              input.options?.temperature ??
              this.config.options?.temperature ??
              1.0,
            top_p: input.options?.topP ?? this.config.options?.topP,
            frequency_penalty:
              input.options?.frequencyPenalty ??
              this.config.options?.frequencyPenalty,
            presence_penalty:
              input.options?.presencePenalty ??
              this.config.options?.presencePenalty,
          }
        : {}),
    });

    if (response.choices && response.choices.length > 0) {
      const msg = response.choices[0].message as any;
      const content =
        (typeof msg.content === 'string' && msg.content.trim().length > 0
          ? msg.content
          : '') ||
        (typeof msg.reasoning_content === 'string' &&
        msg.reasoning_content.trim().length > 0
          ? msg.reasoning_content
          : '') ||
        (typeof msg.reasoning === 'string' && msg.reasoning.trim().length > 0
          ? msg.reasoning
          : '') ||
        (typeof msg.thinking === 'string' && msg.thinking.trim().length > 0
          ? msg.thinking
          : '') ||
        '';

      return {
        content,
        toolCalls:
          response.choices[0].message?.tool_calls
            ?.map((tc) => {
              if (tc.type === 'function') {
                let args = {};
                try {
                  args = JSON.parse(tc.function.arguments);
                } catch {
                  try {
                    args = parse(tc.function.arguments);
                  } catch {
                    args = {};
                  }
                }
                return {
                  name: tc.function.name,
                  id: tc.id,
                  arguments: args,
                };
              }
            })
            .filter((tc) => tc !== undefined) || [],
        additionalInfo: {
          finishReason: response.choices[0].finish_reason,
          reasoning:
            msg.reasoning_content || msg.reasoning || msg.thinking || undefined,
        },
      };
    }

    throw new Error('No response from OpenAI');
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const openaiTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      openaiTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const isReasoning = isReasoningModel(this.config.model);

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(input.messages),
      tools: openaiTools.length > 0 ? openaiTools : undefined,
      max_completion_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens,
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      ...(!isReasoning
        ? {
            temperature:
              input.options?.temperature ??
              this.config.options?.temperature ??
              1.0,
            top_p: input.options?.topP ?? this.config.options?.topP,
            frequency_penalty:
              input.options?.frequencyPenalty ??
              this.config.options?.frequencyPenalty,
            presence_penalty:
              input.options?.presencePenalty ??
              this.config.options?.presencePenalty,
          }
        : {}),
      stream: true,
    });

    const recievedToolCalls: Record<
      number,
      { name: string; id: string; arguments: string }
    > = {};

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const choice = chunk.choices[0];
        const delta = (choice?.delta || (choice as any)?.message || {}) as any;
        const toolCalls = delta?.tool_calls;
        const textChunk =
          (typeof delta?.content === 'string' && delta.content.length > 0
            ? delta.content
            : '') ||
          (typeof delta?.reasoning_content === 'string' &&
          delta.reasoning_content.length > 0
            ? delta.reasoning_content
            : '') ||
          (typeof delta?.reasoning === 'string' && delta.reasoning.length > 0
            ? delta.reasoning
            : '') ||
          (typeof delta?.thinking === 'string' && delta.thinking.length > 0
            ? delta.thinking
            : '') ||
          '';

        yield {
          contentChunk: textChunk,
          toolCallChunk:
            toolCalls?.map((tc: any) => {
              const index = typeof tc.index === 'number' ? tc.index : 0;
              let call = recievedToolCalls[index];

              if (!call) {
                call = {
                  name: tc.function?.name || '',
                  id: tc.id || '',
                  arguments: tc.function?.arguments || '',
                };
                recievedToolCalls[index] = call;
              } else {
                if (tc.function?.name && !call.name) {
                  call.name = tc.function.name;
                }
                if (tc.id) {
                  call.id = tc.id;
                }
                if (tc.function?.arguments) {
                  call.arguments += tc.function.arguments;
                }
              }

              let parsedArgs = {};
              const argsToParse = call.arguments?.trim();
              if (argsToParse && argsToParse.length > 0) {
                try {
                  parsedArgs = parse(argsToParse);
                } catch {
                  parsedArgs = {};
                }
              }

              return {
                id: call.id || crypto.randomUUID(),
                name: call.name,
                arguments: parsedArgs,
              };
            }) || [],
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
            reasoning:
              delta.reasoning_content ||
              delta.reasoning ||
              delta.thinking ||
              undefined,
          },
        };
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const isReasoning = isReasoningModel(this.config.model);

    let response: any;
    try {
      response = await this.openAIClient.chat.completions.create({
        messages: this.convertToOpenAIMessages(input.messages),
        model: this.config.model,
        max_completion_tokens:
          input.options?.maxTokens ?? this.config.options?.maxTokens,
        stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
        ...(!isReasoning
          ? {
              temperature:
                input.options?.temperature ??
                this.config.options?.temperature ??
                1.0,
              top_p: input.options?.topP ?? this.config.options?.topP,
              frequency_penalty:
                input.options?.frequencyPenalty ??
                this.config.options?.frequencyPenalty,
              presence_penalty:
                input.options?.presencePenalty ??
                this.config.options?.presencePenalty,
            }
          : {}),
        response_format: zodResponseFormat(input.schema, 'object'),
      });
    } catch (err: any) {
      const isResponseFormatError =
        err?.message?.includes('response_format') ||
        err?.message?.includes('json_schema') ||
        err?.message?.includes('structured outputs') ||
        err?.message?.includes('not support') ||
        err?.message?.includes('unsupported') ||
        err?.message?.includes('schema') ||
        err?.message?.includes('format') ||
        err?.status === 400 ||
        err?.statusCode === 400 ||
        err?.status === 422 ||
        err?.statusCode === 422 ||
        err?.status === 501 ||
        err?.statusCode === 501;

      if (isResponseFormatError) {
        // Fallback without response_format, using an explicit JSON instruction for Claude/LiteLLM models
        const fallbackMessages = input.messages.map((m, idx) => {
          if (idx === input.messages.length - 1 && m.role === 'user') {
            return {
              ...m,
              content: `${m.content}\n\nIMPORTANT: Respond ONLY with a valid raw JSON object matching the required schema. Do NOT include markdown code blocks, preambles, or explanations.`,
            };
          }
          return m;
        });

        response = await this.openAIClient.chat.completions.create({
          messages: this.convertToOpenAIMessages(fallbackMessages),
          model: this.config.model,
          max_completion_tokens:
            input.options?.maxTokens ?? this.config.options?.maxTokens,
          stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
          ...(!isReasoning
            ? {
                temperature:
                  input.options?.temperature ??
                  this.config.options?.temperature ??
                  1.0,
                top_p: input.options?.topP ?? this.config.options?.topP,
                frequency_penalty:
                  input.options?.frequencyPenalty ??
                  this.config.options?.frequencyPenalty,
                presence_penalty:
                  input.options?.presencePenalty ??
                  this.config.options?.presencePenalty,
              }
            : {}),
        });
      } else {
        throw err;
      }
    }

    if (response.choices && response.choices.length > 0) {
      const msg = response.choices[0].message as any;
      let rawContent =
        (typeof msg.content === 'string' && msg.content.trim().length > 0
          ? msg.content
          : '') ||
        (typeof msg.reasoning_content === 'string' &&
        msg.reasoning_content.trim().length > 0
          ? msg.reasoning_content
          : '') ||
        (typeof msg.reasoning === 'string' && msg.reasoning.trim().length > 0
          ? msg.reasoning
          : '') ||
        (typeof msg.thinking === 'string' && msg.thinking.trim().length > 0
          ? msg.thinking
          : '') ||
        '';

      if (!rawContent && msg.tool_calls && msg.tool_calls.length > 0) {
        const firstToolCallArgs = msg.tool_calls[0].function?.arguments;
        if (firstToolCallArgs && typeof firstToolCallArgs === 'string') {
          rawContent = firstToolCallArgs;
        }
      }

      if (!rawContent) {
        console.warn(
          `[OpenAI] Empty content in response message (finish_reason: ${response.choices[0].finish_reason}, hasToolCalls: ${Boolean(msg.tool_calls?.length)})`,
        );
      }

      return parseAndValidateObject<T>(rawContent, input.schema, 'OpenAI');
    }

    throw new Error('No response from OpenAI');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let recievedObj: string = '';

    for await (const chunk of this.streamText({
      messages: input.messages,
      options: input.options,
    })) {
      if (chunk.contentChunk) {
        recievedObj += chunk.contentChunk;

        try {
          yield parse(recievedObj) as T;
        } catch {
          yield {} as T;
        }
      }
    }
  }
}

export default OpenAILLM;
