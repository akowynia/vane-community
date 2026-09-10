import generateSuggestions from '@/lib/agents/suggestions';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import { recordLlmMetric } from '@/lib/stats/tracker';

interface SuggestionsGenerationBody {
  chatHistory: any[];
  chatModel: ModelWithProvider;
}

export const POST = async (req: Request) => {
  const startTime = performance.now();
  let chatModelKey = 'default';
  let providerId = 'default';

  try {
    const body: SuggestionsGenerationBody = await req.json();
    if (!body.chatModel?.key || !body.chatModel?.providerId) {
      return Response.json({ suggestions: [] }, { status: 200 });
    }

    chatModelKey = body.chatModel.key;
    providerId = body.chatModel.providerId;

    const registry = new ModelRegistry();

    const llm = await registry.loadChatModel(
      body.chatModel.providerId,
      body.chatModel.key,
    );

    const historyMapped = body.chatHistory.map(([role, content]) => ({
      role: role === 'human' ? 'user' as const : 'assistant' as const,
      content,
    }));

    const suggestions = await generateSuggestions(
      {
        chatHistory: historyMapped,
      },
      llm,
    );

    const durationMs = Math.round(performance.now() - startTime);
    const promptText = historyMapped.map((m) => `${m.role}: ${m.content}`).join('\n');
    const completionText = JSON.stringify(suggestions);

    await recordLlmMetric({
      providerId,
      modelKey: chatModelKey,
      query: 'Generate followup suggestions',
      step: 'suggestions',
      promptText,
      completionText,
      durationMs,
      status: 'success',
    });

    return Response.json({ suggestions }, { status: 200 });
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - startTime);
    await recordLlmMetric({
      providerId,
      modelKey: chatModelKey,
      query: 'Generate followup suggestions',
      step: 'suggestions',
      durationMs,
      status: 'error',
      errorMessage: err?.message || 'An error occurred while generating suggestions',
    });

    console.error(`An error occurred while generating suggestions: ${err}`);
    return Response.json(
      { message: 'An error occurred while generating suggestions' },
      { status: 500 },
    );
  }
};
