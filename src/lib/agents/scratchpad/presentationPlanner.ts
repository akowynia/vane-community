import z from 'zod';
import { presentationPlannerPrompt } from '@/lib/prompts/scratchpad/presentationPlanner';
import BaseLLM from '@/lib/models/base/llm';
import { recordLlmMetric } from '@/lib/stats/tracker';

export interface PlannedSlide {
  slideNumber: number;
  title: string;
  goal: string;
  visualType: 'chart' | 'mermaid' | 'infographic' | 'table' | 'cards' | 'bullet_summary';
  visualDescription: string;
  keyPoints: string[];
}

export interface PresentationPlanResult {
  summary: string;
  slides: PlannedSlide[];
  researchQueries: string[];
}

export interface PresentationPlannerInput {
  topic: string;
  targetAudience?: string;
  slideCount?: number;
  theme?: string;
  clarifications?: Array<{ question: string; answer: string }>;
  llm: BaseLLM<any>;
  providerId?: string;
  modelKey?: string;
}

const slideSchema = z.object({
  slideNumber: z.number().describe('1-indexed slide number.'),
  title: z.string().describe('Slide title.'),
  goal: z.string().describe('The primary takeaway or decision goal for this slide.'),
  visualType: z.enum(['chart', 'mermaid', 'infographic', 'table', 'cards', 'bullet_summary']),
  visualDescription: z.string().describe('Description of the visual element or chart.'),
  keyPoints: z.array(z.string()).describe('Key bullet points or arguments.'),
});

const schema = z.object({
  summary: z.string().describe('Executive summary of the presentation plan.'),
  slides: z.array(slideSchema).describe('List of planned slides.'),
  researchQueries: z
    .array(z.string())
    .describe('3-6 precise, factual web search queries for Deep Research.'),
});

export const generatePresentationPlan = async (
  input: PresentationPlannerInput,
): Promise<PresentationPlanResult> => {
  const startTime = performance.now();

  const formattedClarifications = (input.clarifications || [])
    .map((c, i) => `Q${i + 1}: ${c.question}\nA${i + 1}: ${c.answer}`)
    .join('\n\n');

  const targetCount = input.slideCount || 8;
  const userContext = `
TOPIC: "${input.topic}"
TARGET AUDIENCE: "${input.targetAudience || 'General / Accessible'}"
DESIRED SLIDE COUNT: ${targetCount} (CRITICAL: You MUST create an outline with EXACTLY ${targetCount} slides in the slides array, with slideNumber 1 to ${targetCount})
VISUAL THEME: "${input.theme || 'Dark Modern'}"

USER CLARIFICATIONS & REQUIREMENTS:
${formattedClarifications || '(No additional questions - general plan)'}
`.trim();

  try {
    const output = await input.llm.generateObject<typeof schema>({
      messages: [
        {
          role: 'system',
          content: presentationPlannerPrompt,
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
      step: 'presentation_planner',
      promptText: userContext,
      completionText: JSON.stringify(output),
      durationMs,
      status: 'success',
    });

    return {
      summary: output.summary || 'Presentation plan',
      slides: output.slides || [],
      researchQueries: output.researchQueries || [],
    };
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    console.error('[PresentationPlanner] Plan generation error:', err);

    await recordLlmMetric({
      providerId: input.providerId || 'default',
      modelKey: input.modelKey || 'default',
      query: input.topic,
      step: 'presentation_planner',
      promptText: userContext,
      durationMs,
      status: 'error',
      errorMessage: err?.message || 'Error generating presentation plan',
    });

    // Fallback basic plan if LLM call fails
    const count = input.slideCount || 8;
    const fallbackSlides: PlannedSlide[] = Array.from({ length: count }, (_, i) => ({
      slideNumber: i + 1,
      title: i === 0 ? `Introduction: ${input.topic}` : `Topic ${i}: ${input.topic}`,
      goal: 'Cover the key aspects of the topic',
      visualType: i % 2 === 0 ? 'chart' : 'cards',
      visualDescription: 'Data visualization summarizing the key parameters',
      keyPoints: ['Key point 1', 'Key point 2', 'Key point 3'],
    }));

    return {
      summary: `Presentation plan: ${input.topic} (${count} slides)`,
      slides: fallbackSlides,
      researchQueries: [input.topic, `${input.topic} benchmarks statistics`],
    };
  }
};
