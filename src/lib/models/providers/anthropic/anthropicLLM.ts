import z from 'zod';
import BaseLLM from '../../base/llm';
import {
  GenerateObjectInput,
  GenerateOptions,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
  Tool,
  ToolCall,
} from '../../types';
import { Message } from '@/lib/types';
import { parseAndValidateObject } from '@/lib/utils/jsonParser';
import { parse } from 'partial-json';

type AnthropicConfig = {
  apiKey: string;
  model: string;
  baseURL?: string;
  options?: GenerateOptions;
};

class AnthropicLLM extends BaseLLM<AnthropicConfig> {
  private baseURL: string;

  constructor(protected config: AnthropicConfig) {
    super(config);
    this.baseURL = (config.baseURL || 'https://api.anthropic.com/v1').replace(
      /\/+$/,
      '',
    );
  }

  private convertMessages(messages: Message[]) {
    let systemPrompt = '';
    const anthropicMessages: any[] = [];

    messages.forEach((msg) => {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else if (msg.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.id,
              content: msg.content,
            },
          ],
        });
      } else if (msg.role === 'assistant') {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const contentBlocks: any[] = [];
          if (msg.content) {
            contentBlocks.push({
              type: 'text',
              text: msg.content,
            });
          }
          msg.tool_calls.forEach((tc) => {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          });
          anthropicMessages.push({
            role: 'assistant',
            content: contentBlocks,
          });
        } else {
          anthropicMessages.push({
            role: 'assistant',
            content: msg.content ?? '',
          });
        }
      } else if (msg.role === 'user') {
        anthropicMessages.push({
          role: 'user',
          content: msg.content,
        });
      }
    });

    return {
      system: systemPrompt || undefined,
      messages: anthropicMessages,
    };
  }

  private convertTools(tools?: Tool[]) {
    if (!tools || tools.length === 0) return undefined;

    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: z.toJSONSchema(t.schema),
    }));
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const { system, messages } = this.convertMessages(input.messages);
    const tools = this.convertTools(input.tools);

    const body: Record<string, any> = {
      model: this.config.model,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens ?? 4096,
      messages,
    };

    if (system) body.system = system;
    if (tools) body.tools = tools;
    if (input.options?.temperature !== undefined || this.config.options?.temperature !== undefined) {
      body.temperature = input.options?.temperature ?? this.config.options?.temperature;
    }
    if (input.options?.topP !== undefined || this.config.options?.topP !== undefined) {
      body.top_p = input.options?.topP ?? this.config.options?.topP;
    }
    if (input.options?.stopSequences || this.config.options?.stopSequences) {
      body.stop_sequences = input.options?.stopSequences ?? this.config.options?.stopSequences;
    }

    const res = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Anthropic API returned HTTP ${res.status}: ${errText || res.statusText}`,
      );
    }

    const data = await res.json();
    let textContent = '';
    const toolCalls: ToolCall[] = [];

    (data.content || []).forEach((block: any) => {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        });
      }
    });

    return {
      content: textContent,
      toolCalls,
      additionalInfo: {
        finishReason: data.stop_reason,
        usage: data.usage,
      },
    };
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const { system, messages } = this.convertMessages(input.messages);
    const tools = this.convertTools(input.tools);

    const body: Record<string, any> = {
      model: this.config.model,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens ?? 4096,
      messages,
      stream: true,
    };

    if (system) body.system = system;
    if (tools) body.tools = tools;
    if (input.options?.temperature !== undefined || this.config.options?.temperature !== undefined) {
      body.temperature = input.options?.temperature ?? this.config.options?.temperature;
    }
    if (input.options?.topP !== undefined || this.config.options?.topP !== undefined) {
      body.top_p = input.options?.topP ?? this.config.options?.topP;
    }
    if (input.options?.stopSequences || this.config.options?.stopSequences) {
      body.stop_sequences = input.options?.stopSequences ?? this.config.options?.stopSequences;
    }

    const res = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const errText = await res.text();
      throw new Error(
        `Anthropic API returned HTTP ${res.status}: ${errText || res.statusText}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const toolCallAccumulators: Record<
      number,
      { id: string; name: string; json: string }
    > = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let currentEventType = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEventType = '';
          continue;
        }

        if (trimmed.startsWith('event:')) {
          currentEventType = trimmed.slice(6).trim();
          continue;
        }

        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);

            if (currentEventType === 'content_block_start') {
              if (data.content_block?.type === 'tool_use') {
                toolCallAccumulators[data.index] = {
                  id: data.content_block.id,
                  name: data.content_block.name,
                  json: '',
                };
              }
            } else if (currentEventType === 'content_block_delta') {
              if (data.delta?.type === 'text_delta') {
                yield {
                  contentChunk: data.delta.text || '',
                  toolCallChunk: [],
                };
              } else if (data.delta?.type === 'input_json_delta') {
                const acc = toolCallAccumulators[data.index];
                if (acc) {
                  acc.json += data.delta.partial_json || '';
                  yield {
                    contentChunk: '',
                    toolCallChunk: [
                      {
                        id: acc.id,
                        name: acc.name,
                        arguments: parse(acc.json || '{}'),
                      },
                    ],
                  };
                }
              }
            } else if (currentEventType === 'message_delta') {
              yield {
                contentChunk: '',
                toolCallChunk: [],
                done: true,
                additionalInfo: {
                  finishReason: data.delta?.stop_reason,
                  usage: data.usage,
                },
              };
            }
          } catch {
            // ignore JSON parse errors in malformed stream lines
          }
        }
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const { system, messages } = this.convertMessages(input.messages);
    const toolName = 'json_output';
    const tools = [
      {
        name: toolName,
        description: 'Output the requested structured data matching the schema',
        input_schema: z.toJSONSchema(input.schema),
      },
    ];

    const body: Record<string, any> = {
      model: this.config.model,
      max_tokens:
        input.options?.maxTokens ?? this.config.options?.maxTokens ?? 4096,
      messages,
      tools,
      tool_choice: { type: 'tool', name: toolName },
    };

    if (system) body.system = system;
    if (input.options?.temperature !== undefined || this.config.options?.temperature !== undefined) {
      body.temperature = input.options?.temperature ?? this.config.options?.temperature;
    }

    const res = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(
        `Anthropic API returned HTTP ${res.status}: ${errText || res.statusText}`,
      );
    }

    const data = await res.json();
    let toolUseInput: any = null;
    let textContent = '';

    (data.content || []).forEach((block: any) => {
      if (block.type === 'tool_use' && block.name === toolName) {
        toolUseInput = block.input;
      } else if (block.type === 'text') {
        textContent += block.text;
      }
    });

    if (toolUseInput !== null && toolUseInput !== undefined) {
      try {
        return input.schema.parse(toolUseInput) as T;
      } catch (validationErr) {
        // Fallback to repair if needed
        return parseAndValidateObject<T>(
          JSON.stringify(toolUseInput),
          input.schema,
          'Anthropic',
        );
      }
    }

    if (textContent) {
      return parseAndValidateObject<T>(textContent, input.schema, 'Anthropic');
    }

    throw new Error('No valid structured response received from Anthropic');
  }

  async *streamObject<T>(input: GenerateObjectInput): AsyncGenerator<T> {
    let receivedObj = '';

    for await (const chunk of this.streamText({
      messages: input.messages,
      options: input.options,
    })) {
      if (chunk.contentChunk) {
        receivedObj += chunk.contentChunk;
        try {
          yield parse(receivedObj) as T;
        } catch {
          yield {} as T;
        }
      }
    }
  }
}

export default AnthropicLLM;
