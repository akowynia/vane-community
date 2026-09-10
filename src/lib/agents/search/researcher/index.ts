import { ActionOutput, ResearcherInput, ResearcherOutput } from '../types';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import { Message, ReasoningResearchBlock } from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ToolCall } from '@/lib/models/types';
import { getTokenCount } from '@/lib/utils/splitText';
import {
  normalizeUrl,
  areTitlesSimilar,
} from './actions/search/baseSearch';

const summarizeActionForHistory = (action: ActionOutput): any => {
  if (action.type === 'search_results' && Array.isArray(action.results)) {
    return {
      type: 'search_results',
      results: action.results.slice(0, 6).map((r) => ({
        title: r.metadata?.title || 'Untitled',
        url: r.metadata?.url || '',
        snippet: (r.content || '').slice(0, 250) + ((r.content || '').length > 250 ? '...' : ''),
      })),
      totalFound: action.results.length,
    };
  }
  return action;
};

const MAX_HISTORY_TOKENS = 10000;

const pruneHistoryForContext = (messages: Message[]): Message[] => {
  if (messages.length <= 2) return messages;

  const totalTokens = messages.reduce(
    (acc, m) => acc + getTokenCount(typeof m.content === 'string' ? m.content : JSON.stringify(m)),
    0,
  );

  if (totalTokens <= MAX_HISTORY_TOKENS) return messages;

  // Keep the first message (user query) plus the most recent tool turns
  const initial = messages[0];
  const recent = messages.slice(-4);
  return [
    initial,
    {
      role: 'tool',
      id: 'pruned-context-marker',
      name: 'system_notice',
      content: JSON.stringify({
        note: 'Earlier intermediate search findings were summarized to preserve context window limit.',
      }),
    },
    ...recent,
  ];
};

class Researcher {
  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    let actionOutput: ActionOutput[] = [];
    let maxIteration =
      input.config.mode === 'speed'
        ? 2
        : input.config.mode === 'balanced'
          ? 5
          : 8;

    let usedTokens = 0;
    const qualityTokenLimit =
      input.config.qualityModeTokenLimit ??
      (input.config.mode === 'quality' ? 75000 : Infinity);
    let isTokenLimitReached = false;

    const tokenTracker = {
      addTokens: (count: number) => {
        usedTokens += count;
        if (input.config.mode === 'quality' && usedTokens >= qualityTokenLimit) {
          isTokenLimitReached = true;
        }
      },
      getUsedTokens: () => usedTokens,
      isLimitExceeded: () =>
        input.config.mode === 'quality' &&
        (usedTokens >= qualityTokenLimit || isTokenLimitReached),
    };

    const availableTools = ActionRegistry.getAvailableActionTools({
      classification: input.classification,
      fileIds: input.config.fileIds,
      mode: input.config.mode,
      sources: input.config.sources,
    });

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions({
        classification: input.classification,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        sources: input.config.sources,
      });

    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    const agentMessageHistory: Message[] = [
      {
        role: 'user',
        content: `
          <conversation>
          ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
           User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
           </conversation>
        `,
      },
    ];

    for (let i = 0; i < maxIteration; i++) {
      if (tokenTracker.isLimitExceeded()) {
        isTokenLimitReached = true;
        console.warn(
          `[Researcher] Quality mode token budget limit reached (${qualityTokenLimit} tokens) at iteration ${i}. Ending research early.`,
        );
        break;
      }

      try {
        const researcherPrompt = getResearcherPrompt(
          availableActionsDescription,
          input.config.mode,
          i,
          maxIteration,
          input.config.fileIds,
        );

        const prunedMessages = pruneHistoryForContext(agentMessageHistory);
        const inputTokensCount =
          getTokenCount(researcherPrompt) +
          prunedMessages.reduce(
            (acc, m) =>
              acc +
              getTokenCount(
                typeof m.content === 'string'
                  ? m.content
                  : JSON.stringify(m),
              ),
            0,
          );
        tokenTracker.addTokens(inputTokensCount);

        const actionStream = input.config.llm.streamText({
          messages: [
            {
              role: 'system',
              content: researcherPrompt,
            },
            ...prunedMessages,
          ],
          tools: availableTools,
        });

        const block = session.getBlock(researchBlockId);

        let reasoningEmitted = false;
        let reasoningId = crypto.randomUUID();

        let finalToolCalls: ToolCall[] = [];

        for await (const partialRes of actionStream) {
          if (partialRes.toolCallChunk.length > 0) {
            partialRes.toolCallChunk.forEach((tc) => {
              if (
                tc.name === '__reasoning_preamble' &&
                tc.arguments['plan'] &&
                !reasoningEmitted &&
                block &&
                block.type === 'research'
              ) {
                reasoningEmitted = true;

                block.data.subSteps.push({
                  id: reasoningId,
                  type: 'reasoning',
                  reasoning: tc.arguments['plan'],
                });

                session.updateBlock(researchBlockId, [
                  {
                    op: 'replace',
                    path: '/data/subSteps',
                    value: block.data.subSteps,
                  },
                ]);
              } else if (
                tc.name === '__reasoning_preamble' &&
                tc.arguments['plan'] &&
                reasoningEmitted &&
                block &&
                block.type === 'research'
              ) {
                const subStepIndex = block.data.subSteps.findIndex(
                  (step: any) => step.id === reasoningId,
                );

                if (subStepIndex !== -1) {
                  const subStep = block.data.subSteps[
                    subStepIndex
                  ] as ReasoningResearchBlock;
                  subStep.reasoning = tc.arguments['plan'];
                  session.updateBlock(researchBlockId, [
                    {
                      op: 'replace',
                      path: '/data/subSteps',
                      value: block.data.subSteps,
                    },
                  ]);
                }
              }

              const existingIndex = finalToolCalls.findIndex(
                (ftc) => ftc.id === tc.id,
              );

              if (existingIndex !== -1) {
                finalToolCalls[existingIndex].arguments = tc.arguments;
              } else {
                finalToolCalls.push(tc);
              }
            });
          }
        }

        if (finalToolCalls.length === 0) {
          break;
        }

        tokenTracker.addTokens(getTokenCount(JSON.stringify(finalToolCalls)));

        let hasDone = finalToolCalls.some((tc) => tc.name === 'done');
        const executableCalls = finalToolCalls.filter((tc) => tc.name !== 'done');

        if (executableCalls.length > 0) {
          agentMessageHistory.push({
            role: 'assistant',
            content: null,
            tool_calls: executableCalls,
          });

          const actionResults = await ActionRegistry.executeAll(executableCalls, {
            llm: input.config.llm,
            embedding: input.config.embedding,
            session: session,
            researchBlockId: researchBlockId,
            fileIds: input.config.fileIds,
            mode: input.config.mode,
            classification: input.classification,
            query: input.followUp,
            tokenTracker,
          });

          actionOutput.push(...actionResults);

          actionResults.forEach((action, idx) => {
            agentMessageHistory.push({
              role: 'tool',
              id: executableCalls[idx].id,
              name: executableCalls[idx].name,
              content: JSON.stringify(summarizeActionForHistory(action)),
            });
          });

          // If the query is a summary of a specific link (e.g. from Discover) and the URL was just successfully scraped
          const isUrlSummary =
            /^(?:summary:\s*)?https?:\/\//i.test(input.followUp.trim()) ||
            /(?:summarize|streszcz|podsumuj).+https?:\/\//i.test(input.followUp);
          const hasSuccessfulScrape = executableCalls.some(
            (c) => c.name === 'scrape_url',
          ) && actionResults.some(
            (a) => a.type === 'search_results' && a.results && a.results.length > 0,
          );

          if (isUrlSummary && hasSuccessfulScrape) {
            hasDone = true;
          }
        }

        if (hasDone || tokenTracker.isLimitExceeded()) {
          if (tokenTracker.isLimitExceeded()) {
            isTokenLimitReached = true;
          }
          break;
        }
      } catch (iterationError: any) {
        console.warn(
          `Researcher iteration ${i} encountered an error:`,
          iterationError?.message || iterationError,
        );
        const hasAnyResults = actionOutput.some(
          (a) => a.type === 'search_results' && a.results && a.results.length > 0,
        );
        if (hasAnyResults || i > 0) {
          break;
        }
        throw iterationError;
      }
    }

    if (isTokenLimitReached) {
      const block = session.getBlock(researchBlockId);
      if (block && block.type === 'research') {
        const hasTokenWarning = block.data.subSteps.some(
          (s) =>
            s.type === 'search_warning' &&
            s.warningType === 'token_limit_reached',
        );
        if (!hasTokenWarning) {
          block.data.subSteps.push({
            id: crypto.randomUUID(),
            type: 'search_warning',
            warningType: 'token_limit_reached',
            engines: [],
            message: `Research reached maximum token budget (${qualityTokenLimit.toLocaleString()} tokens) and was concluded early.`,
          });
          session.updateBlock(researchBlockId, [
            {
              op: 'replace',
              path: '/data/subSteps',
              value: block.data.subSteps,
            },
          ]);
        }
      }
    }

    // Safety fallback: if the search returned no results and wasn't skipped
    const hasSearchResults = actionOutput.some(
      (a) => a.type === 'search_results' && a.results && a.results.length > 0,
    );
    if (
      !hasSearchResults &&
      input.config.sources.includes('web') &&
      !input.classification.classification.skipSearch
    ) {
      const fallbackQuery =
        input.classification.standaloneFollowUp || input.followUp;
      if (fallbackQuery && fallbackQuery.trim() !== '') {
        const fallbackAction = ActionRegistry.get('web_search');
        const researchBlock = session.getBlock(researchBlockId) as any;
        if (fallbackAction && researchBlock) {
          const fallbackOutput = await fallbackAction.execute(
            { queries: [fallbackQuery.trim()] },
            {
              llm: input.config.llm,
              embedding: input.config.embedding,
              session: session,
              researchBlockId: researchBlockId,
              fileIds: input.config.fileIds,
              mode: input.config.mode,
              classification: input.classification,
              query: input.followUp,
            },
          );
          if (fallbackOutput) {
            actionOutput.push(fallbackOutput);
          }
        }
      }
    }

    const searchResults = actionOutput
      .filter((a) => a.type === 'search_results')
      .flatMap((a) => a.results);

    const seenUrls = new Map<string, number>();
    const seenTitles: { title: string; index: number }[] = [];

    const filteredSearchResults = searchResults
      .map((result, index) => {
        const rawUrl = result.metadata?.url || '';
        const normUrl = normalizeUrl(rawUrl);
        const title = result.metadata?.title || '';

        // 1. Check for a duplicate normalized URL
        if (normUrl && seenUrls.has(normUrl)) {
          const existingIndex = seenUrls.get(normUrl)!;
          const existingResult = searchResults[existingIndex];
          if (existingResult && result.content) {
            existingResult.content += `\n\n${result.content}`;
          }
          return undefined;
        }

        // 2. Check for a duplicate academic article / study by title (e.g. PubMed vs ScienceDirect vs ResearchGate)
        const duplicateTitleEntry = seenTitles.find((st) =>
          areTitlesSimilar(st.title, title),
        );
        if (duplicateTitleEntry) {
          const existingResult = searchResults[duplicateTitleEntry.index];
          if (existingResult && result.content) {
            existingResult.content += `\n\n${result.content}`;
          }
          return undefined;
        }

        if (normUrl) {
          seenUrls.set(normUrl, index);
        }
        if (title) {
          seenTitles.push({ title, index });
        }

        return result;
      })
      .filter((r) => r !== undefined);

    const cappedSearchResults = filteredSearchResults
      .slice(0, 15)
      .map((r) => ({
        ...r,
        content: (r.content || '').slice(0, 3500),
      }));

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: cappedSearchResults,
    });

    return {
      findings: actionOutput,
      searchFindings: cappedSearchResults,
      isTokenLimitReached,
    };
  }
}

export default Researcher;
