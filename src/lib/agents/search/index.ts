import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import db from '@/lib/db';
import { messages } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { TextBlock, MetricsBlock } from '@/lib/types';
import { getTokenCount } from '@/lib/utils/splitText';
import { recordLlmMetric } from '@/lib/stats/tracker';

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    try {
      const exists = await db.query.messages.findFirst({
        where: and(
          eq(messages.chatId, input.chatId),
          eq(messages.messageId, input.messageId),
        ),
      });

      if (!exists) {
        await db.insert(messages).values({
          chatId: input.chatId,
          messageId: input.messageId,
          backendId: session.id,
          query: input.followUp,
          createdAt: new Date().toISOString(),
          status: 'answering',
          responseBlocks: [],
        });
      } else {
        await db
          .delete(messages)
          .where(
            and(eq(messages.chatId, input.chatId), gt(messages.id, exists.id)),
          )
          .execute();
        await db
          .update(messages)
          .set({
            status: 'answering',
            backendId: session.id,
            responseBlocks: [],
          })
          .where(
            and(
              eq(messages.chatId, input.chatId),
              eq(messages.messageId, input.messageId),
            ),
          )
          .execute();
      }

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
      }).then((widgetOutputs) => {
        widgetOutputs.forEach((o) => {
          session.emitBlock({
            id: crypto.randomUUID(),
            type: 'widget',
            data: {
              widgetType: o.type,
              params: o.data,
            },
          });
        });
        return widgetOutputs;
      });

      let searchPromise: Promise<ResearcherOutput> | null = null;

      if (!classification.classification.skipSearch) {
        const researcher = new Researcher();
        searchPromise = researcher.research(session, {
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

      session.emit('data', {
        type: 'researchComplete',
      });

      let finalContext =
        '<Query to be answered without searching; Search not made>';

      if (
        searchResults &&
        searchResults.searchFindings &&
        searchResults.searchFindings.length > 0
      ) {
        let accumulatedTokens = 0;
        const validFindings: string[] = [];
        for (let i = 0; i < searchResults.searchFindings.length; i++) {
          const f = searchResults.searchFindings[i];
          const entry = `<result index=${i + 1} title=${f.metadata.title}>${f.content}</result>`;
          const entryTokens = getTokenCount(entry);
          if (accumulatedTokens + entryTokens > 12000 && validFindings.length > 0) {
            break;
          }
          validFindings.push(entry);
          accumulatedTokens += entryTokens;
        }
        finalContext = validFindings.join('\n');
      }

      const widgetContext = widgetOutputs
        .map((o) => {
          return `<result>${o.llmContext}</result>`;
        })
        .join('\n-------------\n');

      const buildWriterPrompt = (ctx: string) => {
        const finalContextWithWidgets = `<search_results note="These are the search results and assistant can cite these">\n${ctx}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;
        return getWriterPrompt(
          finalContextWithWidgets,
          input.config.systemInstructions,
          input.config.mode,
          searchResults?.isTokenLimitReached,
        );
      };

      let writerPrompt = buildWriterPrompt(finalContext);

      const streamStartTime = performance.now();
      let timeToFirstTokenMs: number | undefined = undefined;
      let fullResponseText = '';
      let activeResponseBlockId: string | null = null;

      if (input.signal?.aborted) return;

      const runWriterStream = async (promptToUse: string) => {
        const answerStream = input.config.llm.streamText({
          messages: [
            {
              role: 'system',
              content: promptToUse,
            },
            ...input.chatHistory.slice(-6),
            {
              role: 'user',
              content: input.followUp,
            },
          ],
        });

        for await (const chunk of answerStream) {
          if (input.signal?.aborted) {
            break;
          }
          if (timeToFirstTokenMs === undefined && chunk.contentChunk) {
            timeToFirstTokenMs = Math.round(performance.now() - streamStartTime);
          }

          fullResponseText += chunk.contentChunk;

          if (!activeResponseBlockId) {
            const block: TextBlock = {
              id: crypto.randomUUID(),
              type: 'text',
              data: chunk.contentChunk,
            };

            session.emitBlock(block);

            activeResponseBlockId = block.id;
          } else {
            const block = session.getBlock(activeResponseBlockId) as TextBlock | null;

            if (!block) {
              continue;
            }

            block.data += chunk.contentChunk;

            session.updateBlock(block.id, [
              {
                op: 'replace',
                path: '/data',
                value: block.data,
              },
            ]);
          }
        }
      };

      try {
        await runWriterStream(writerPrompt);

        const totalDurationMs = Math.round(performance.now() - streamStartTime);
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
          providerId: input.config.providerId || 'default',
          modelKey: input.config.modelKey || 'default',
          query: input.followUp,
          step: 'answer',
          promptText,
          promptTokens,
          completionText: fullResponseText,
          completionTokens,
          totalTokens,
          durationMs: totalDurationMs,
          timeToFirstTokenMs,
          optimizationMode: input.config.mode,
          status: 'success',
        });

        const metricsBlock: MetricsBlock = {
          id: crypto.randomUUID(),
          type: 'metrics',
          data: {
            modelKey: input.config.modelKey || 'default',
            providerId: input.config.providerId || 'default',
            durationMs: totalDurationMs,
            promptTokens,
            completionTokens,
            totalTokens,
          },
        };

        session.emitBlock(metricsBlock);
      } catch (streamError: any) {
        const errorMsg = streamError?.message || '';
        const isContextOverflow =
          errorMsg.includes('exceeds the available context size') ||
          errorMsg.includes('exceed_context_size_error') ||
          errorMsg.includes('context_length_exceeded') ||
          errorMsg.includes('maximum context length') ||
          errorMsg.includes('token count exceeds') ||
          streamError?.code === 400;

        if (isContextOverflow && searchResults?.searchFindings?.length) {
          console.warn(
            'Context length exceeded in writer stream, retrying with truncated context...',
          );
          try {
            // Emergency truncation: take only the top 5 sources, max 800 chars each
            const conciseContext = searchResults.searchFindings
              .slice(0, 5)
              .map(
                (f, index) =>
                  `<result index=${index + 1} title=${f.metadata.title}>${(f.content || '').slice(0, 800)}</result>`,
              )
              .join('\n');
            const fallbackPrompt = buildWriterPrompt(conciseContext);
            fullResponseText = '';
            if (activeResponseBlockId) {
              const block = session.getBlock(activeResponseBlockId) as TextBlock | null;
              if (block) {
                block.data = '';
                session.updateBlock(block.id, [
                  {
                    op: 'replace',
                    path: '/data',
                    value: '',
                  },
                ]);
              }
            }
            await runWriterStream(fallbackPrompt);
            const fallbackDurationMs = Math.round(performance.now() - streamStartTime);
            const fallbackPromptTokens = getTokenCount(fallbackPrompt);
            const fallbackCompletionTokens = getTokenCount(fullResponseText);
            const fallbackTotalTokens = fallbackPromptTokens + fallbackCompletionTokens;

            await recordLlmMetric({
              chatId: input.chatId,
              messageId: input.messageId,
              providerId: input.config.providerId || 'default',
              modelKey: input.config.modelKey || 'default',
              query: input.followUp,
              step: 'answer',
              promptText: fallbackPrompt,
              promptTokens: fallbackPromptTokens,
              completionText: fullResponseText,
              completionTokens: fallbackCompletionTokens,
              totalTokens: fallbackTotalTokens,
              durationMs: fallbackDurationMs,
              optimizationMode: input.config.mode,
              status: 'success',
            });

            const fallbackMetricsBlock: MetricsBlock = {
              id: crypto.randomUUID(),
              type: 'metrics',
              data: {
                modelKey: input.config.modelKey || 'default',
                providerId: input.config.providerId || 'default',
                durationMs: fallbackDurationMs,
                promptTokens: fallbackPromptTokens,
                completionTokens: fallbackCompletionTokens,
                totalTokens: fallbackTotalTokens,
              },
            };
            session.emitBlock(fallbackMetricsBlock);
            session.emit('end', {});
            await db
              .update(messages)
              .set({
                status: 'completed',
                responseBlocks: session.getAllBlocks(),
              })
              .where(
                and(
                  eq(messages.chatId, input.chatId),
                  eq(messages.messageId, input.messageId),
                ),
              )
              .execute();
            return;
          } catch (retryError) {
            console.error('Fallback truncated writer also failed:', retryError);
          }
        }

        const totalDurationMs = Math.round(performance.now() - streamStartTime);
        await recordLlmMetric({
          chatId: input.chatId,
          messageId: input.messageId,
          providerId: input.config.providerId || 'default',
          modelKey: input.config.modelKey || 'default',
          query: input.followUp,
          step: 'answer',
          durationMs: totalDurationMs,
          optimizationMode: input.config.mode,
          status: 'error',
          errorMessage: streamError?.message || 'Error streaming LLM response',
        });
        throw streamError;
      }

      session.emit('end', {});

      await db
        .update(messages)
        .set({
          status: 'completed',
          responseBlocks: session.getAllBlocks(),
        })
        .where(
          and(
            eq(messages.chatId, input.chatId),
            eq(messages.messageId, input.messageId),
          ),
        )
        .execute();
    } catch (err: any) {
      console.error('Error during searchAsync execution:', err);
      session.emit('error', {
        data: err?.message || 'An error occurred while processing your request.',
      });

      try {
        await db
          .update(messages)
          .set({
            status: 'error',
            responseBlocks: session.getAllBlocks(),
          })
          .where(
            and(
              eq(messages.chatId, input.chatId),
              eq(messages.messageId, input.messageId),
            ),
          )
          .execute();
      } catch (dbErr) {
        console.error(
          'Failed to update message error status in database:',
          dbErr,
        );
      }
    }
  }
}

export default SearchAgent;

