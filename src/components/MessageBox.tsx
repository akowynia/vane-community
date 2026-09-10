'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  Layers3,
  Plus,
  CornerDownRight,
  AlertCircle,
  RotateCcw,
  Pencil,
  Trash2,
  Clock,
  Cpu,
  Zap,
  Loader2,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';
import { useChat, Section } from '@/lib/hooks/useChat';
import Citation from './MessageRenderer/Citation';
import AssistantSteps from './AssistantSteps';
import { ResearchBlock } from '@/lib/types';
import Renderer from './Widgets/Renderer';
import CodeBlock from './MessageRenderer/CodeBlock';
import { useTranslation } from '@/lib/i18n';
import ErrorBoundary from './ErrorBoundary';

const ThinkTagProcessor = ({
  children,
  thinkingEnded,
}: {
  children: React.ReactNode;
  thinkingEnded: boolean;
}) => {
  return (
    <ThinkBox content={children} thinkingEnded={thinkingEnded} />
  );
};

const MessageBox = ({
  section,
  sectionIndex,
  dividerRef,
  isLast,
}: {
  section: Section;
  sectionIndex: number;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
}) => {
  const {
    loading,
    sendMessage,
    rewrite,
    retry,
    editMessage,
    deleteMessage,
    messages,
    researchEnded,
    chatHistory,
  } = useChat();
  const { t } = useTranslation();

  const parsedMessage = section.parsedTextBlocks.join('\n\n');
  const speechMessage = section.speechMessage || '';
  const thinkingEnded = section.thinkingEnded;

  const sourceBlocks = section.message.responseBlocks.filter(
    (block): block is typeof block & { type: 'source' } =>
      block.type === 'source',
  );

  const sources = sourceBlocks.flatMap((block) => block.data);

  const hasContent = section.parsedTextBlocks.length > 0;

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const markdownOverrides: MarkdownToJSX.Options = {
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return `\`${node.text ?? ''}\``;
      }

      if (node.type === RuleType.codeBlock) {
        return (
          <CodeBlock key={state.key} language={node.lang || ''}>
            {node.text ?? ''}
          </CodeBlock>
        );
      }

      return next();
    },
    overrides: {
      think: {
        component: ThinkTagProcessor,
        props: {
          thinkingEnded: thinkingEnded,
        },
      },
      citation: {
        component: Citation,
      },
    },
  };

  return (
    <div className="space-y-6">
      <div className={'w-full pt-8 break-words'}>
        <h2 className="text-black dark:text-white font-medium text-3xl lg:w-9/12">
          {section.message.query}
        </h2>
      </div>

      <div className="flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9">
        <div
          ref={dividerRef}
          className="flex flex-col space-y-6 w-full lg:w-9/12"
        >
          {sources.length > 0 && (
            <div className="flex flex-col space-y-2">
              <div className="flex flex-row items-center space-x-2">
                <BookCopy className="text-black dark:text-white" size={20} />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  {t('chat.sources')}
                </h3>
              </div>
              <MessageSources sources={sources} />
            </div>
          )}

          {section.message.responseBlocks
            .filter(
              (block): block is ResearchBlock =>
                block.type === 'research' && block.data.subSteps.length > 0,
            )
            .map((researchBlock) => (
              <div key={researchBlock.id} className="flex flex-col space-y-2">
                <ErrorBoundary fallback={<div className="text-xs text-black/50 dark:text-white/50">{t('chat.researchProgress', { count: 0, steps: '' })}</div>}>
                  <AssistantSteps
                    block={researchBlock}
                    status={section.message.status}
                    isLast={isLast}
                  />
                </ErrorBoundary>
              </div>
            ))}

          {isLast &&
            loading &&
            section.message.status === 'answering' &&
            !researchEnded &&
            !parsedMessage.trim() &&
            !section.message.responseBlocks.some(
              (b) => b.type === 'research' && b.data.subSteps.length > 0,
            ) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200">
                <Disc3 className="w-4 h-4 text-black dark:text-white animate-spin" />
                <span className="text-sm text-black/70 dark:text-white/70">
                  {t('chat.brainstorming')}
                </span>
              </div>
            )}

          {section.widgets.length > 0 && (
            <ErrorBoundary fallback={null}>
              <Renderer widgets={section.widgets} />
            </ErrorBoundary>
          )}

          {section.message.status === 'error' && (
            <div className="flex flex-col gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 my-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">
                  {t('chat.errorMessage') ||
                    'An error occurred while generating the response.'}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => retry(section.message.messageId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 rounded-md transition duration-150 text-red-700 dark:text-red-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('chat.retry') || 'Retry'}
                </button>
                <button
                  type="button"
                  onClick={() => editMessage(section.message.messageId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-light-200 dark:bg-dark-200 hover:bg-light-300 dark:hover:bg-dark-300 rounded-md transition duration-150 text-black/70 dark:text-white/70"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {t('chat.editPrompt') || 'Edit prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteMessage(section.message.messageId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-red-500/20 rounded-md transition duration-150 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('chat.deleteMessage') || 'Delete'}
                </button>
              </div>
            </div>
          )}

          {!hasContent &&
            section.message.status !== 'error' &&
            (!loading || !isLast) && (
              <div className="flex flex-col gap-2 p-4 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 my-2">
                <p className="text-sm text-black/70 dark:text-white/70">
                  {t('chat.noResultsFound') || 'No response was generated.'}
                </p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => retry(section.message.messageId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-light-200 dark:bg-dark-100 hover:bg-light-300 dark:hover:bg-dark-300 rounded-md transition duration-150 text-black dark:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('chat.retry') || 'Retry'}
                  </button>
                  <button
                    type="button"
                    onClick={() => editMessage(section.message.messageId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-light-200 dark:bg-dark-100 hover:bg-light-300 dark:hover:bg-dark-300 rounded-md transition duration-150 text-black/70 dark:text-white/70"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t('chat.editPrompt') || 'Edit prompt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMessage(section.message.messageId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium hover:bg-red-500/20 rounded-md transition duration-150 text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('chat.deleteMessage') || 'Delete'}
                  </button>
                </div>
              </div>
            )}

          <div className="flex flex-col space-y-2">
            {sources.length > 0 && (
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className={cn(
                    'text-black dark:text-white',
                    isLast && loading && section.message.status === 'answering'
                      ? 'animate-spin'
                      : 'animate-none',
                  )}
                  size={20}
                />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  {t('chat.answer')}
                </h3>
              </div>
            )}

            {/* Queue waiting banner for local providers */}
            {section.message.queueStatus?.status === 'queued' && (
              <div className="flex items-center justify-between p-3.5 my-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 animate-pulse">
                <div className="flex items-center gap-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold">
                      {t('queue.waitingInQueue', {
                        position: section.message.queueStatus.position || 1,
                      }) ||
                        `Waiting in task queue (position: ${
                          section.message.queueStatus.position || 1
                        })`}
                    </p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {t('queue.waitingDesc') ||
                        'Local model server is currently processing earlier queries.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(
                        new CustomEvent('open-queue-drawer', {
                          detail: {
                            providerId: section.message.queueStatus?.providerId,
                          },
                        }),
                      );
                    }
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition shadow-sm active:scale-95"
                >
                  {t('queue.viewQueue') || 'View Queue'}
                </button>
              </div>
            )}

            {/* Waiting indicator for AI model response generation */}
            {!hasContent &&
              isLast &&
              loading &&
              section.message.status === 'answering' &&
              section.message.queueStatus?.status !== 'queued' && (
                <div className="flex items-center gap-3 py-3 px-1 text-xs sm:text-sm text-black/60 dark:text-stone-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#b8864d] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 rounded-full bg-[#b8864d] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 rounded-full bg-[#b8864d] animate-bounce" />
                  </div>
                  <span className="font-medium text-xs sm:text-sm text-black/70 dark:text-stone-300">
                    {t('chat.generatingResponse') ||
                      'Generating response based on gathered sources...'}
                  </span>
                </div>
              )}

            {hasContent && (
              <>
                <ErrorBoundary
                  fallback={
                    <div className="p-4 my-2 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200">
                      <div className="whitespace-pre-wrap font-sans text-sm text-black dark:text-white break-words">
                        {parsedMessage}
                      </div>
                    </div>
                  }
                >
                  <Markdown
                    className={cn(
                      'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                      'max-w-none break-words text-black dark:text-white',
                    )}
                    options={markdownOverrides}
                  >
                    {parsedMessage}
                  </Markdown>
                </ErrorBoundary>

                {/* Telemetry metadata: Model, Duration, Tokens */}
                {section.metrics && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 pb-1 text-[11px] text-black/60 dark:text-stone-400">
                    {section.metrics.modelKey && (
                      <span
                        title={section.metrics.providerId ? `${t('statistics.providers') || 'Provider'}: ${section.metrics.providerId}` : undefined}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-light-200/80 dark:bg-[#181513] border border-light-300/60 dark:border-[#2b241d] text-black/80 dark:text-stone-300 shadow-sm"
                      >
                        <Cpu size={12} className="text-[#b8864d]" />
                        <span className="font-medium font-mono text-[10.5px]">
                          {section.metrics.modelKey}
                        </span>
                      </span>
                    )}
                    {section.metrics.durationMs !== undefined && section.metrics.durationMs > 0 && (
                      <span
                        title={t('statistics.duration') || 'Duration'}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-light-200/80 dark:bg-[#181513] border border-light-300/60 dark:border-[#2b241d] text-black/70 dark:text-stone-300 shadow-sm"
                      >
                        <Clock size={12} className="text-stone-400" />
                        <span className="font-mono text-[10.5px]">
                          {(section.metrics.durationMs / 1000).toFixed(1)}s
                        </span>
                      </span>
                    )}
                    {section.metrics.totalTokens !== undefined && section.metrics.totalTokens > 0 && (
                      <span
                        title={
                          t('chat.tokensBreakdown', {
                            prompt: section.metrics.promptTokens || 0,
                            completion: section.metrics.completionTokens || 0,
                          }) ||
                          `Tokens used (Prompt: ${section.metrics.promptTokens || 0}, Response: ${section.metrics.completionTokens || 0})`
                        }
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-light-200/80 dark:bg-[#181513] border border-light-300/60 dark:border-[#2b241d] text-black/70 dark:text-stone-300 shadow-sm"
                      >
                        <Zap size={12} className="text-amber-500" />
                        <span className="font-mono text-[10.5px]">
                          {section.metrics.totalTokens} tok.
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {loading && isLast ? null : (
                  <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-4">
                    <div className="flex flex-row items-center space-x-1 -ml-2">
                      <Rewrite
                        rewrite={rewrite}
                        messageId={section.message.messageId}
                      />
                      <button
                        type="button"
                        title={t('chat.deleteMessage') || 'Delete message'}
                        onClick={() => deleteMessage(section.message.messageId)}
                        className="p-2 text-black/70 dark:text-white/70 rounded-full hover:bg-red-500/10 transition duration-200 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex flex-row items-center -mr-2">
                      <Copy initialMessage={parsedMessage} section={section} />
                      <button
                        onClick={() => {
                          if (speechStatus === 'started') {
                            stop();
                          } else {
                            start();
                          }
                        }}
                        className="p-2 text-black/70 dark:text-white/70 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                      >
                        {speechStatus === 'started' ? (
                          <StopCircle size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isLast &&
                  section.suggestions &&
                  section.suggestions.length > 0 &&
                  hasContent &&
                  !loading && (
                    <div className="mt-6">
                      <div className="flex flex-row items-center space-x-2 mb-4">
                        <Layers3
                          className="text-black dark:text-white"
                          size={20}
                        />
                        <h3 className="text-black dark:text-white font-medium text-xl">
                          {t('chat.related')}
                        </h3>
                      </div>
                      <div className="space-y-0">
                        {section.suggestions.map(
                          (suggestion: string, i: number) => (
                            <div key={i}>
                              <div className="h-px bg-light-200/40 dark:bg-dark-200/40" />
                              <button
                                onClick={() => sendMessage(suggestion)}
                                className="group w-full py-4 text-left transition-colors duration-200"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex flex-row space-x-3 items-center">
                                    <CornerDownRight
                                      size={15}
                                      className="group-hover:text-sky-400 transition-colors duration-200 flex-shrink-0"
                                    />
                                    <p className="text-sm text-black/70 dark:text-white/70 group-hover:text-sky-400 transition-colors duration-200 leading-relaxed">
                                      {suggestion}
                                    </p>
                                  </div>
                                  <Plus
                                    size={16}
                                    className="text-black/40 dark:text-white/40 group-hover:text-sky-400 transition-colors duration-200 flex-shrink-0"
                                  />
                                </div>
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {hasContent && (
          <div className="lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full lg:w-3/12 z-30 h-full pb-4">
            <SearchImages
              query={section.message.query}
              chatHistory={chatHistory}
              messageId={section.message.messageId}
            />
            <SearchVideos
              chatHistory={chatHistory}
              query={section.message.query}
              messageId={section.message.messageId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBox;
