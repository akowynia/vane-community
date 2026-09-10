import OpenAILLM from '../openai/openaiLLM';
import {
  GenerateObjectInput,
  GenerateTextInput,
  GenerateTextOutput,
  StreamTextOutput,
} from '../../types';
import { parse } from 'partial-json';
import z from 'zod';
import { ChatCompletionTool } from 'openai/resources/index.mjs';
import { parseAndValidateObject } from '@/lib/utils/jsonParser';

class GroqLLM extends OpenAILLM {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const groqTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      groqTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const maxTokens =
      input.options?.maxTokens ?? this.config.options?.maxTokens;

    const response = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      tools: groqTools.length > 0 ? groqTools : undefined,
      messages: this.convertToOpenAIMessages(input.messages),
      ...(maxTokens !== undefined ? { max_completion_tokens: maxTokens } : {}),
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      temperature:
        input.options?.temperature ??
        this.config.options?.temperature ??
        0.7,
      top_p: input.options?.topP ?? this.config.options?.topP,
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
        '';

      return {
        content,
        toolCalls:
          response.choices[0].message.tool_calls
            ?.map((tc) => {
              if (tc.type === 'function') {
                return {
                  name: tc.function.name,
                  id: tc.id,
                  arguments: JSON.parse(tc.function.arguments),
                };
              }
            })
            .filter((tc) => tc !== undefined) || [],
        additionalInfo: {
          finishReason: response.choices[0].finish_reason,
          reasoning: msg.reasoning_content || undefined,
        },
      };
    }

    throw new Error('No response from Groq API');
  }

  async *streamText(
    input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    const groqTools: ChatCompletionTool[] = [];

    input.tools?.forEach((tool) => {
      groqTools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: z.toJSONSchema(tool.schema),
        },
      });
    });

    const maxTokens =
      input.options?.maxTokens ?? this.config.options?.maxTokens;

    const stream = await this.openAIClient.chat.completions.create({
      model: this.config.model,
      messages: this.convertToOpenAIMessages(input.messages),
      tools: groqTools.length > 0 ? groqTools : undefined,
      ...(maxTokens !== undefined ? { max_completion_tokens: maxTokens } : {}),
      stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
      temperature:
        input.options?.temperature ??
        this.config.options?.temperature ??
        0.7,
      top_p: input.options?.topP ?? this.config.options?.topP,
      stream: true,
    });

    const recievedToolCalls: Record<
      number,
      { name: string; id: string; arguments: string }
    > = {};

    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta as any;
        const toolCalls = delta.tool_calls;
        const textChunk =
          (typeof delta.content === 'string' && delta.content.length > 0
            ? delta.content
            : '') ||
          (typeof delta.reasoning_content === 'string' &&
          delta.reasoning_content.length > 0
            ? delta.reasoning_content
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
                  id: tc.id || crypto.randomUUID(),
                  arguments: tc.function?.arguments || '',
                };
                recievedToolCalls[index] = call;
              } else {
                if (tc.function?.name && !call.name) {
                  call.name = tc.function.name;
                }
                if (tc.id && !call.id) {
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
                id: call.id,
                name: call.name,
                arguments: parsedArgs,
              };
            }) || [],
          done: chunk.choices[0].finish_reason !== null,
          additionalInfo: {
            finishReason: chunk.choices[0].finish_reason,
            reasoning: delta.reasoning_content || undefined,
          },
        };
      }
    }
  }

  async generateObject<T>(input: GenerateObjectInput): Promise<T> {
    const maxTokens =
      input.options?.maxTokens ?? this.config.options?.maxTokens;

    let response: any;
    try {
      // Groq generally supports {"type": "json_object"} across all models when the prompt includes a JSON instruction
      response = await this.openAIClient.chat.completions.create({
        messages: this.convertToOpenAIMessages(input.messages),
        model: this.config.model,
        ...(maxTokens !== undefined ? { max_completion_tokens: maxTokens } : {}),
        stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
        temperature:
          input.options?.temperature ??
          this.config.options?.temperature ??
          0.7,
        top_p: input.options?.topP ?? this.config.options?.topP,
        response_format: { type: 'json_object' },
      });
    } catch (err: any) {
      // Fallback without response_format in case the model doesn't support it
      response = await this.openAIClient.chat.completions.create({
        messages: this.convertToOpenAIMessages(input.messages),
        model: this.config.model,
        ...(maxTokens !== undefined ? { max_completion_tokens: maxTokens } : {}),
        stop: input.options?.stopSequences ?? this.config.options?.stopSequences,
        temperature:
          input.options?.temperature ??
          this.config.options?.temperature ??
          0.7,
        top_p: input.options?.topP ?? this.config.options?.topP,
      });
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
        '';

      if (!rawContent && msg.tool_calls && msg.tool_calls.length > 0) {
        const firstToolCallArgs = msg.tool_calls[0].function?.arguments;
        if (firstToolCallArgs && typeof firstToolCallArgs === 'string') {
          rawContent = firstToolCallArgs;
        }
      }

      if (!rawContent) {
        console.warn(
          `[Groq] Empty content in response message (finish_reason: ${response.choices[0].finish_reason}, hasToolCalls: ${Boolean(msg.tool_calls?.length)})`,
        );
      }

      return parseAndValidateObject<T>(rawContent, input.schema, 'Groq');
    }

    throw new Error('No response from Groq');
  }
}

export default GroqLLM;

