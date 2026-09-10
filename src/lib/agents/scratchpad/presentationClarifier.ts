import z from 'zod';
import { presentationClarifierPrompt } from '@/lib/prompts/scratchpad/presentationClarifier';
import BaseLLM from '@/lib/models/base/llm';
import { recordLlmMetric } from '@/lib/stats/tracker';

export interface PresentationClarifierInput {
  topic: string;
  targetAudience?: string;
  slideCount?: number;
  currentRound: number;
  maxRounds: number;
  clarifications?: Array<{ question: string; answer: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  llm: BaseLLM<any>;
  providerId?: string;
  modelKey?: string;
}

export interface PresentationClarificationResult {
  needsClarification: boolean;
  question: string;
  options: string[];
  briefSummary?: string;
}

const schema = z.object({
  needsClarification: z
    .boolean()
    .describe('Whether an additional clarification question should be asked.'),
  question: z
    .string()
    .describe('The next focused clarifying question for the presentation.'),
  options: z
    .array(z.string())
    .describe('2-4 distinct options for the user to select from.'),
  briefSummary: z
    .string()
    .optional()
    .describe('Brief summary of requirements gathered so far.'),
});

export const evaluatePresentationClarification = async (
  input: PresentationClarifierInput,
): Promise<PresentationClarificationResult> => {
  // Enforce max rounds constraint
  if (input.maxRounds <= 0 || input.currentRound >= input.maxRounds) {
    return {
      needsClarification: false,
      question: '',
      options: [],
      briefSummary: 'Clarification round limit reached. Proceeding to presentation planning.',
    };
  }

  const startTime = performance.now();

  const formattedClarifications = (input.clarifications || [])
    .map((c, i) => `Round ${i + 1}: Question: "${c.question}" -> User answer: "${c.answer}"`)
    .join('\n');

  const formattedHistory = (input.conversationHistory || [])
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const userContext = `
USER PRE-CONFIGURED SETTINGS:
- PRESENTATION TOPIC: "${input.topic}"
- TARGET AUDIENCE: "${input.targetAudience || 'General / Accessible'}" (ALREADY CHOSEN - DO NOT ASK ABOUT AUDIENCE/TONE)
- TARGET SLIDE COUNT: ${input.slideCount || 8} (ALREADY CHOSEN - DO NOT ASK ABOUT SLIDE COUNT)
- CURRENT ROUND: ${input.currentRound + 1} of ${input.maxRounds}

PREVIOUS CLARIFICATION QUESTIONS AND USER ANSWERS:
${formattedClarifications || '(No previous questions - this is Round 1)'}

RECENT CONVERSATION HISTORY:
${formattedHistory || '(No previous messages)'}

INSTRUCTION:
Evaluate if an essential, non-repetitive, domain-specific content question is needed.
NEVER ask about audience, slide count, general topic, or visual theme.
NEVER repeat or rephrase any question that has already been asked or answered above.
If the topic is already clear, if the user answered previous questions, or if current knowledge is sufficient, return "needsClarification": false immediately.
`.trim();

  try {
    const output = await input.llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: presentationClarifierPrompt,
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
      query: input.topic,
      step: 'presentation_clarifier',
      promptText: userContext,
      completionText: JSON.stringify(output),
      durationMs,
      status: 'success',
    });

    if (output.needsClarification && output.options && output.options.length >= 2) {
      return {
        needsClarification: true,
        question: output.question,
        options: output.options.slice(0, 4),
        briefSummary: output.briefSummary || '',
      };
    }

    return {
      needsClarification: false,
      question: '',
      options: [],
      briefSummary: output.briefSummary || '',
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    console.warn('[PresentationClarifier] Clarification evaluation error:', err?.message);

    await recordLlmMetric({
      providerId: input.providerId || 'default',
      modelKey: input.modelKey || 'default',
      query: input.topic,
      step: 'presentation_clarifier',
      promptText: userContext,
      durationMs,
      status: 'error',
      errorMessage: err?.message || 'Error evaluating presentation clarification',
    });

    return {
      needsClarification: false,
      question: '',
      options: [],
    };
  }
};
