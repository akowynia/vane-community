import z from 'zod';
import { ClassifierInput } from './types';
import { classifierPrompt } from '@/lib/prompts/search/classifier';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { recordLlmMetric } from '@/lib/stats/tracker';

const schema = z.object({
  classification: z.object({
    skipSearch: z
      .boolean()
      .describe('Indicates whether to skip the search step.'),
    personalSearch: z
      .boolean()
      .describe('Indicates whether to perform a personal search.'),
    academicSearch: z
      .boolean()
      .describe('Indicates whether to perform an academic search.'),
    discussionSearch: z
      .boolean()
      .describe('Indicates whether to perform a discussion search.'),
    showWeatherWidget: z
      .boolean()
      .describe('Indicates whether to show the weather widget.'),
    showStockWidget: z
      .boolean()
      .describe('Indicates whether to show the stock widget.'),
    showCalculationWidget: z
      .boolean()
      .describe('Indicates whether to show the calculation widget.'),
  }),
  standaloneFollowUp: z
    .string()
    .describe(
      "A self-contained, context-independent reformulation of the user's question.",
    ),
});

export const classify = async (input: ClassifierInput) => {
  const startTime = performance.now();
  const promptText = `${classifierPrompt}\n<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>`;

  try {
    const output = await input.llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: classifierPrompt,
        },
        {
          role: 'user',
          content: `<conversation_history>\n${formatChatHistoryAsString(input.chatHistory)}\n</conversation_history>\n<user_query>\n${input.query}\n</user_query>`,
        },
      ],
      schema,
    });

    const durationMs = Math.round(performance.now() - startTime);
    const completionText = JSON.stringify(output);

    await recordLlmMetric({
      providerId: input.providerId || 'default',
      modelKey: input.modelKey || 'default',
      query: input.query,
      step: 'classifier',
      promptText,
      completionText,
      durationMs,
      status: 'success',
    });

    return output;
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    await recordLlmMetric({
      providerId: input.providerId || 'default',
      modelKey: input.modelKey || 'default',
      query: input.query,
      step: 'classifier',
      promptText,
      durationMs,
      status: 'error',
      errorMessage: err?.message || 'Error classifying query',
    });

    // Fallback: if the model returns a malformed response, don't abort the search — use safe default values instead
    console.warn(
      `[Classifier] Classification failed, proceeding with default web search. Error: ${err?.message}`,
    );

    return {
      classification: {
        skipSearch: false,
        personalSearch: false,
        academicSearch: false,
        discussionSearch: false,
        showWeatherWidget: false,
        showStockWidget: false,
        showCalculationWidget: false,
      },
      standaloneFollowUp: input.query,
    };
  }
};

