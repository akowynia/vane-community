import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import { recordLlmMetric } from '@/lib/stats/tracker';
import { getTokenCount } from '@/lib/utils/splitText';

class APISearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    const startTime = performance.now();
    try {
      const classification = await classify({
        chatHistory: input.chatHistory,
        enabledSources: input.config.sources,
        query: input.followUp,
        llm: input.config.llm,
        providerId: input.config.providerId,
        modelKey: input.config.modelKey,
      });

      const widgetPromise = WidgetExecutor.executeAll({
        classification,
        chatHistory: input.chatHistory,
        followUp: input.followUp,
        llm: input.config.llm,
      }).catch((err) => {
        console.error(`Error executing widgets: ${err}`);
        return [];
      });

      let searchPromise: Promise<ResearcherOutput> | null = null;

      if (!classification.classification.skipSearch) {
        const researcher = new Researcher();
        searchPromise = researcher.research(SessionManager.createSession(), {
          chatHistory: input.chatHistory,
          followUp: input.followUp,
          classification: classification,
          config: input.config,
        });
      }

      const [widgetOutputs, searchResults] = await Promise.all([
        widgetPromise,
        searchPromise,
      ]);

      if (searchResults) {
        session.emit('data', {
          type: 'searchResults',
          data: searchResults.searchFindings,
        });
      }

      session.emit('data', {
        type: 'researchComplete',
      });

      const finalContext =
        searchResults?.searchFindings
          .map(
            (f, index) =>
              `<result index=${index + 1} title=${f.metadata.title}>${f.content}</result>`,
          )
          .join('\n') || '';

      const widgetContext = widgetOutputs
        .map((o) => {
          return `<result>${o.llmContext}</result>`;
        })
        .join('\n-------------\n');

      const finalContextWithWidgets = `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;

      const writerPrompt = getWriterPrompt(
        finalContextWithWidgets,
        input.config.systemInstructions,
        input.config.mode,
        searchResults?.isTokenLimitReached,
      );

      let fullResponseText = '';
      let timeToFirstTokenMs: number | undefined = undefined;

      const answerStream = input.config.llm.streamText({
        messages: [
          {
            role: 'system',
            content: writerPrompt,
          },
          ...input.chatHistory,
          {
            role: 'user',
            content: input.followUp,
          },
        ],
      });

      for await (const chunk of answerStream) {
        if (timeToFirstTokenMs === undefined && chunk.contentChunk) {
          timeToFirstTokenMs = Math.round(performance.now() - startTime);
        }
        fullResponseText += chunk.contentChunk;
        session.emit('data', {
          type: 'response',
          data: chunk.contentChunk,
        });
      }

      const durationMs = Math.round(performance.now() - startTime);
      const promptText =
        writerPrompt +
        '\n' +
        input.chatHistory.map((m) => m.content).join('\n') +
        '\n' +
        input.followUp;

      const promptTokens = getTokenCount(promptText);
      const completionTokens = getTokenCount(fullResponseText);
      const totalTokens = promptTokens + completionTokens;

      await recordLlmMetric({
        chatId: input.chatId,
        messageId: input.messageId,
        userId: input.userId,
        apiKeyId: input.apiKeyId,
        source: input.source || 'api',
        providerId: input.config.providerId || 'default',
        modelKey: input.config.modelKey || 'default',
        query: input.followUp,
        step: 'answer',
        promptText,
        promptTokens,
        completionText: fullResponseText,
        completionTokens,
        totalTokens,
        durationMs,
        timeToFirstTokenMs,
        optimizationMode: input.config.mode,
        status: 'success',
      });

      session.emit('end', {});
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      await recordLlmMetric({
        chatId: input.chatId,
        messageId: input.messageId,
        userId: input.userId,
        apiKeyId: input.apiKeyId,
        source: input.source || 'api',
        providerId: input.config.providerId || 'default',
        modelKey: input.config.modelKey || 'default',
        query: input.followUp,
        step: 'answer',
        durationMs,
        optimizationMode: input.config.mode,
        status: 'error',
        errorMessage: err?.message || 'Error in APISearchAgent',
      });
      session.emit('error', {
        data: err?.message || 'An error occurred during API search execution',
      });
    }
  }
}

export default APISearchAgent;

