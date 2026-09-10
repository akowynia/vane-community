import z from 'zod';
import { scratchpadClarifierPrompt } from '@/lib/prompts/scratchpad/clarifier';
import BaseLLM from '@/lib/models/base/llm';
import { recordLlmMetric } from '@/lib/stats/tracker';

export interface ClarifierInput {
  query: string;
  currentTitle?: string;
  currentContent?: string;
  selectedText?: string | null;
  llm: BaseLLM<any>;
  providerId?: string;
  modelKey?: string;
}

export interface ClarificationResult {
  needsClarification: boolean;
  question: string;
  options: string[];
}

const schema = z.object({
  needsClarification: z
    .boolean()
    .describe('Indicates whether clarification is beneficial for this prompt.'),
  question: z
    .string()
    .describe('A polite, concise clarifying question for the user.'),
  options: z
    .array(z.string())
    .describe('2-4 distinct options/perspectives for the user to choose from.'),
});

export const evaluateScratchpadClarification = async (
  input: ClarifierInput,
): Promise<ClarificationResult> => {
  const startTime = performance.now();

  const userContext = `
USER QUERY: "${input.query}"
DOCUMENT TITLE: "${input.currentTitle || 'Untitled'}"
CURRENT DOCUMENT CONTENT (excerpt):
${input.currentContent ? input.currentContent.slice(0, 1500) : '(Empty document - creating from scratch)'}
${input.selectedText ? `SELECTED SNIPPET: "${input.selectedText}"` : ''}
`.trim();

  try {
    const output = await input.llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: scratchpadClarifierPrompt,
        },
        {
          role: 'user',
          content: userContext,
        },
      ],
      schema,
    });

    const durationMs = Math.round(performance.now() - startTime);

    await recordLlmMetric({
      providerId: input.providerId || 'default',
      modelKey: input.modelKey || 'default',
      query: input.query,
      step: 'scratchpad_clarifier',
      promptText: userContext,
      completionText: JSON.stringify(output),
      durationMs,
      status: 'success',
    });

    if (output.needsClarification && output.options && output.options.length >= 2) {
      return {
        needsClarification: true,
        question: output.question || 'Choose your preferred direction for this note:',
        options: output.options.slice(0, 4),
      };
    }

    return {
      needsClarification: false,
      question: '',
      options: [],
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    console.warn('[ScratchpadClarifier] Clarification evaluation skipped due to error:', err?.message);

    await recordLlmMetric({
      providerId: input.providerId || 'default',
      modelKey: input.modelKey || 'default',
      query: input.query,
      step: 'scratchpad_clarifier',
      promptText: userContext,
      durationMs,
      status: 'error',
      errorMessage: err?.message || 'Error evaluating clarification',
    });

    return {
      needsClarification: false,
      question: '',
      options: [],
    };
  }
};
