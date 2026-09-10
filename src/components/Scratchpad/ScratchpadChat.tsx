'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Square,
  Search,
  Sparkles,
  Bot,
  User,
  X,
  Layers,
  FileText,
  Pin,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  Plus,
  HelpCircle,
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { useTranslation } from '@/lib/i18n';
import ModelSelector from '../MessageInputActions/ChatModelSelector';
import Optimization from '../MessageInputActions/Optimization';
import Sources from '../MessageInputActions/Sources';
import Attach from '../MessageInputActions/Attach';
import WaypointSelector from '../MessageInputActions/WaypointSelector';
import MessageSources from '../MessageSources';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import CodeBlock from '../MessageRenderer/CodeBlock';
import { Chunk } from '@/lib/types';
import ScratchpadClarificationBox, { ClarificationData } from './ScratchpadClarificationBox';
import {
  PresentationClarificationBox,
  PresentationClarificationData,
} from '@/components/Presentation/PresentationClarificationBox';
import {
  PresentationPlanWidget,
} from '@/components/Presentation/PresentationPlanWidget';
import { PresentationPlanResult } from '@/lib/agents/scratchpad/presentationPlanner';

export interface ScratchpadClarification extends ClarificationData {}

export interface ScratchpadChatMessage {
  id: string | number;
  messageId: string;
  role: 'user' | 'assistant';
  query: string;
  responseBlocks?: any[];
  sources?: Chunk[];
  selectedText?: string | null;
  clarification?: ScratchpadClarification | null;
  presentationClarification?: PresentationClarificationData | null;
  presentationPlan?: PresentationPlanResult | null;
  suggestions?: string[];
  metrics?: {
    modelKey?: string;
    providerId?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    durationMs?: number;
  } | null;
  createdAt: string;
}

export interface SendMessageOptions {
  clarificationResponse?: {
    question?: string;
    selectedOption?: string;
    customText?: string;
  };
  skipClarification?: boolean;
  isPresentation?: boolean;
  planApproved?: boolean;
  approvedPlan?: any;
}

interface ScratchpadChatProps {
  messages: ScratchpadChatMessage[];
  onSendMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  loading: boolean;
  onStopGenerating?: () => void;
  selectedText?: string | null;
  onClearSelection?: () => void;
  waypointId?: string | null;
  activeSources?: Chunk[];
  templateInfo?: { id?: string; name?: string; icon?: string; isBuiltin?: boolean } | null;
  isPresentation?: boolean;
  onAcceptPlan?: (plan: any) => Promise<void>;
}

const ScratchpadChat: React.FC<ScratchpadChatProps> = ({
  messages,
  onSendMessage,
  loading,
  onStopGenerating,
  selectedText,
  onClearSelection,
  waypointId,
  activeSources = [],
  templateInfo = null,
  isPresentation = false,
  onAcceptPlan,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    onSendMessage(msg);
  };

  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      table: {
        component: ({ children, ...props }: any) => (
          <div className="w-full my-3 overflow-x-auto rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary/20 dark:bg-[#16120f]/40 shadow-sm">
            <table className="w-full min-w-full border-collapse text-left text-xs" {...props}>
              {children}
            </table>
          </div>
        ),
      },
      thead: {
        component: ({ children, ...props }: any) => (
          <thead className="bg-light-secondary/80 dark:bg-[#1f1a15] text-stone-900 dark:text-stone-100 border-b border-light-200 dark:border-[#2a241d] font-semibold" {...props}>
            {children}
          </thead>
        ),
      },
      th: {
        component: ({ children, ...props }: any) => (
          <th className="px-3 py-2 font-semibold text-stone-900 dark:text-stone-100 border-r border-light-200/60 dark:border-[#2a241d]/60 last:border-r-0 whitespace-nowrap" {...props}>
            {children}
          </th>
        ),
      },
      tbody: {
        component: ({ children, ...props }: any) => (
          <tbody className="divide-y divide-light-200/60 dark:divide-[#2a241d]/60" {...props}>
            {children}
          </tbody>
        ),
      },
      tr: {
        component: ({ children, ...props }: any) => (
          <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors" {...props}>
            {children}
          </tr>
        ),
      },
      td: {
        component: ({ children, ...props }: any) => (
          <td className="px-3 py-2 text-stone-700 dark:text-stone-300 border-r border-light-200/40 dark:border-[#2a241d]/40 last:border-r-0 align-top break-words" {...props}>
            {children}
          </td>
        ),
      },
    },
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return (
          <code key={state.key} className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs text-[#b8864d]">
            {node.text ?? ''}
          </code>
        );
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
  };

  const extractString = (data: any): string => {
    if (typeof data === 'string') return data;
    if (!data) return '';
    if (typeof data === 'object') {
      if (typeof data.text === 'string') return data.text;
      if (typeof data.content === 'string') return data.content;
      if (typeof data.message === 'string') return data.message;
      if (typeof data.query === 'string') return data.query;
      if (Array.isArray(data)) return data.map(extractString).filter(Boolean).join('\n\n');
      return '';
    }
    return String(data);
  };

  const cleanChatText = (rawText: string): string => {
    if (!rawText) return '';
    let text = rawText
      .replace(/<presentation_update[\s\S]*?(?:<\/presentation_update>|$)/gi, '')
      .replace(/<presentation_suggestions[\s\S]*?(?:<\/presentation_suggestions>|$)/gi, '')
      .replace(/<note_update[\s\S]*?(?:<\/note_update>|$)/gi, '')
      .replace(/<note_suggestions[\s\S]*?(?:<\/note_suggestions>|$)/gi, '')
      .trim();

    // Strip unintended meta prefixes like "Part 1 (Chat Commentary):", "Part 1:", "Chat Commentary:"
    text = text.replace(/^(?:Part\s*1(?:\s*\([^)]*\))?:?|Chat\s*Commentary:?|Komentarz\s*asystenta:?|Komentarz:?)\s*/i, '');
    return text.trim();
  };

  return (
    <div className="flex flex-col h-full bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#221c16] rounded-2xl overflow-hidden shadow-sm">
      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-stone-400 dark:text-stone-500">
            <div className="p-3.5 rounded-2xl bg-[#b8864d]/10 text-[#b8864d] mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              {isPresentation
                ? (t('presentation.aiCopilotTitle') || 'AI Asystent Prezentacji')
                : (t('scratchpad.aiCopilotTitle') || 'AI Copilot Szkicownika')}
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mt-1">
              {isPresentation
                ? (t('presentation.aiCopilotDesc') || 'Describe your presentation topic, answer clarifying questions, or ask AI to refine slides.')
                : (t('scratchpad.aiCopilotDesc') || 'Type a prompt (e.g., "create a note about recursion" or highlight text in the editor and ask "change this to X").')}
            </p>
            {templateInfo && (
              <div className="mt-3 px-3 py-1.5 rounded-xl bg-[#b8864d]/10 border border-[#b8864d]/25 text-[11px] text-[#b8864d] max-w-xs flex items-center space-x-2 text-left">
                <Layers className="w-3.5 h-3.5 shrink-0" />
                <span>{t('scratchpad.templateActiveTip') || 'Active template: AI will generate content following the structure and sections defined in the editor.'}</span>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            let displayText = '';

            if (isUser) {
              displayText = extractString(msg.query || (msg as any).content);
            } else {
              const textBlocks = (msg.responseBlocks || [])
                .filter((b) => b && (b.type === 'text' || !b.type))
                .map((b) => extractString(b.data ?? b))
                .filter(Boolean);

              const rawText = textBlocks.length > 0 ? textBlocks.join('\n\n') : extractString(msg.query);
              displayText = cleanChatText(rawText);
            }

            const messageSources: Chunk[] =
              Array.isArray(msg.sources) && msg.sources.length > 0
                ? msg.sources
                : (msg.responseBlocks || [])
                    .filter((b) => b && (b.type === 'source' || b.type === 'sources') && Array.isArray(b.data))
                    .flatMap((b) => b.data);

            // Extract note clarification data if present (only for standard note mode)
            const clarificationBlock = !isPresentation
              ? (msg.responseBlocks || []).find((b) => b && b.type === 'clarification')
              : null;
            const clarificationData: ScratchpadClarification | null =
              !isPresentation
                ? (msg.clarification || (clarificationBlock ? (clarificationBlock.data as ScratchpadClarification) : null))
                : null;

            // Extract presentation clarification data if present (only for presentation mode)
            const presClarificationBlock = isPresentation
              ? (msg.responseBlocks || []).find(
                  (b) => b && (b.type === 'presentation_clarification' || (b.data && b.data.round !== undefined)),
                )
              : null;
            const presentationClarificationData: PresentationClarificationData | null =
              isPresentation
                ? (msg.presentationClarification || (presClarificationBlock ? (presClarificationBlock.data as PresentationClarificationData) : null))
                : null;

            // Extract presentation plan if present
            const presPlanBlock = (msg.responseBlocks || []).find(
              (b) => b && (b.type === 'presentation_plan' || (b.data && Array.isArray(b.data.slides))),
            );
            const presentationPlanData: PresentationPlanResult | null =
              msg.presentationPlan || (presPlanBlock ? (presPlanBlock.data as PresentationPlanResult) : null);

            // Extract suggestions if present
            const suggestionsBlock = (msg.responseBlocks || []).find(
              (b) => b && (b.type === 'suggestions' || b.type === 'suggestion') && Array.isArray(b.data),
            );
            const suggestionsList: string[] =
              Array.isArray(msg.suggestions) && msg.suggestions.length > 0
                ? msg.suggestions
                : suggestionsBlock && Array.isArray(suggestionsBlock.data)
                  ? suggestionsBlock.data
                  : [];

            if (
              !isUser &&
              !displayText &&
              messageSources.length === 0 &&
              !clarificationData &&
              !presentationClarificationData &&
              !presentationPlanData &&
              loading &&
              index === messages.length - 1
            ) {
              return null;
            }

            return (
              <div
                key={msg.id || index}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-2`}
              >
                {/* User Message */}
                {isUser ? (
                  <div className="flex flex-col items-end max-w-[90%]">
                    {msg.selectedText && (
                      <div className="mb-1 text-[11px] px-2.5 py-1 rounded-lg bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/30 max-w-full truncate flex items-center space-x-1">
                        <Pin className="w-3 h-3 shrink-0" />
                        <span className="font-semibold shrink-0">{t('scratchpad.selectionLabel') || 'Zaznaczenie:'}</span>
                        <span className="truncate italic">"{msg.selectedText}"</span>
                      </div>
                    )}
                    <div className="px-4 py-2.5 rounded-2xl bg-[#b8864d] text-stone-950 font-medium text-xs shadow-sm leading-relaxed whitespace-pre-wrap">
                      {displayText}
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="flex flex-col items-start w-full space-y-2.5">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-stone-600 dark:text-stone-300">
                      <div className="p-1 rounded-md bg-[#b8864d]/15 text-[#b8864d]">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <span>{t('scratchpad.assistantLabel') || 'Asystent'}</span>
                    </div>

                    {/* Note Clarification Box if present */}
                    {clarificationData && (
                      <div className="w-full">
                        <ScratchpadClarificationBox
                          clarification={clarificationData}
                          disabled={loading}
                          onConfirm={(selectedOption, customText) => {
                            const originalUserQuery =
                              messages[index - 1]?.query ||
                              extractString(messages[index - 1] as any) ||
                              '';
                            
                            // Optimistically mark this clarification as answered
                            clarificationData.status = 'answered';
                            clarificationData.selectedOption = selectedOption || null;
                            clarificationData.customText = customText || null;

                            onSendMessage(originalUserQuery, {
                              clarificationResponse: {
                                question: clarificationData.question,
                                selectedOption,
                                customText,
                              },
                              skipClarification: true,
                            });
                          }}
                          onSkip={() => {
                            const originalUserQuery =
                              messages[index - 1]?.query ||
                              extractString(messages[index - 1] as any) ||
                              '';

                            // Optimistically mark this clarification as skipped
                            clarificationData.status = 'skipped';

                            onSendMessage(originalUserQuery, {
                              skipClarification: true,
                            });
                          }}
                        />
                      </div>
                    )}

                    {/* Presentation Clarification Box if present */}
                    {presentationClarificationData && (
                      <div className="w-full">
                        <PresentationClarificationBox
                          data={presentationClarificationData}
                          disabled={loading}
                          onAnswer={(resp) => {
                            presentationClarificationData.status = 'resolved';
                            presentationClarificationData.selectedOption = resp.selectedOption;
                            presentationClarificationData.customText = resp.customText;

                            const answerLabel = resp.selectedOption || resp.customText || '';
                            onSendMessage(`Clarification: ${answerLabel}`, {
                              isPresentation: true,
                              clarificationResponse: resp,
                            });
                          }}
                          onSkipToPlan={() => {
                            presentationClarificationData.status = 'skipped';

                            onSendMessage('Skip directly to preparing the presentation plan', {
                              isPresentation: true,
                              skipClarification: true,
                            });
                          }}
                        />
                      </div>
                    )}

                    {/* Presentation Plan Outline Widget if present */}
                    {presentationPlanData && (
                      <div className="w-full">
                        <PresentationPlanWidget
                          plan={presentationPlanData}
                          disabled={loading}
                          onAcceptPlan={(approvedPlan) => {
                            if (onAcceptPlan) {
                              onAcceptPlan(approvedPlan);
                            } else {
                              const originalUserQuery =
                                messages[index - 1]?.query ||
                                extractString(messages[index - 1] as any) ||
                                'Generate presentation';

                              onSendMessage(originalUserQuery, {
                                isPresentation: true,
                                planApproved: true,
                                approvedPlan,
                              });
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Sources Grid if present */}
                    {messageSources.length > 0 && (
                      <div className="w-full">
                        <MessageSources sources={messageSources} />
                      </div>
                    )}

                    {/* Commentary text */}
                    {displayText && (
                      <div className="px-4 py-3 rounded-2xl bg-light-secondary dark:bg-[#181411] border border-light-200 dark:border-[#221c16] text-xs text-stone-800 dark:text-stone-200 leading-relaxed w-full prose prose-stone dark:prose-invert max-w-none">
                        <Markdown options={markdownOverrides}>{displayText}</Markdown>
                      </div>
                    )}

                    {/* Telemetry metadata: Model, Duration, Tokens */}
                    {msg.metrics && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
                        {msg.metrics.modelKey && (
                          <span
                            title={msg.metrics.providerId ? `${t('statistics.providers') || 'Provider'}: ${msg.metrics.providerId}` : undefined}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-light-200 dark:border-[#26201a] text-stone-700 dark:text-stone-300 shadow-sm"
                          >
                            <Cpu size={12} className="text-[#b8864d]" />
                            <span className="font-medium font-mono text-[10.5px]">
                              {msg.metrics.modelKey}
                            </span>
                          </span>
                        )}
                        {msg.metrics.durationMs !== undefined && msg.metrics.durationMs > 0 && (
                          <span
                            title={t('statistics.duration') || 'Duration'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 shadow-sm"
                          >
                            <Clock size={12} className="text-stone-400" />
                            <span className="font-mono text-[10.5px]">
                              {(msg.metrics.durationMs / 1000).toFixed(1)}s
                            </span>
                          </span>
                        )}
                        {msg.metrics.totalTokens !== undefined && msg.metrics.totalTokens > 0 && (
                          <span
                            title={
                              t('chat.tokensBreakdown', {
                                prompt: msg.metrics.promptTokens || 0,
                                completion: msg.metrics.completionTokens || 0,
                              }) ||
                              `Tokens used (Prompt: ${msg.metrics.promptTokens || 0}, Response: ${msg.metrics.completionTokens || 0})`
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 shadow-sm"
                          >
                            <Zap size={12} className="text-amber-500" />
                            <span className="font-mono text-[10.5px]">
                              {msg.metrics.totalTokens} tok.
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Note Expansion Suggestions */}
                    {suggestionsList.length > 0 && (
                      <div className="w-full pt-2 border-t border-light-200/60 dark:border-[#221c16]/60 mt-1 animate-fadeIn">
                        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#b8864d]" />
                          <span>
                            {isPresentation
                              ? (t('presentation.expansionSuggestions') || 'Sugestie rozszerzenia prezentacji:')
                              : (t('scratchpad.expansionSuggestions') || 'Sugestie rozszerzenia notatki:')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {suggestionsList.map((suggestion, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              disabled={loading}
                              onClick={() => onSendMessage(suggestion, { skipClarification: true, isPresentation })}
                              className="group text-left inline-flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] hover:bg-[#b8864d]/15 text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-stone-50 border border-light-200 dark:border-[#26201a] hover:border-[#b8864d]/40 text-xs transition duration-150 disabled:opacity-50"
                            >
                              <div className="flex items-center space-x-2">
                                <Plus className="w-3.5 h-3.5 text-[#b8864d] shrink-0 group-hover:rotate-90 transition-transform duration-200" />
                                <span className="leading-snug">{suggestion}</span>
                              </div>
                              <span className="text-[10px] text-stone-400 group-hover:text-[#b8864d] shrink-0 font-medium">
                                {t('scratchpad.expansionApply') || 'Expand'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        {loading && (
          <div className="flex items-center space-x-2 text-xs text-stone-400 p-2 animate-pulse">
            <Sparkles className={`w-3.5 h-3.5 ${isPresentation ? 'text-amber-500' : 'text-[#b8864d]'} animate-spin`} />
            <span>
              {isPresentation
                ? (t('presentation.generatingSlides') || 'Przygotowywanie prezentacji i slajdów...')
                : (t('scratchpad.applyingChanges') || 'Wprowadzanie zmian w notatce...')}
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-light-200 dark:border-[#221c16] bg-light-secondary/80 dark:bg-[#181411]/80 backdrop-blur-md">
        {/* Selected Context Banner */}
        {selectedText && (
          <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-[#b8864d]/15 border border-[#b8864d]/30 text-xs text-stone-800 dark:text-stone-200 animate-fadeIn">
            <div className="flex items-center space-x-2 truncate">
              <Pin className="w-3.5 h-3.5 text-[#b8864d] shrink-0" />
              <span className="font-semibold text-[#b8864d]">{t('scratchpad.selectedContext') || 'Dotyczy zaznaczenia:'}</span>
              <span className="truncate italic text-stone-600 dark:text-stone-400">"{selectedText}"</span>
            </div>
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                title={t('scratchpad.clearSelection') || 'Clear selection'}
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition shrink-0 ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-primary dark:bg-[#120f0d] focus-within:border-[#b8864d]">
            <TextareaAutosize
              ref={inputRef}
              minRows={1}
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                selectedText
                  ? t('scratchpad.refineSelectionPlaceholder') || 'Describe how to modify the selected fragment...'
                  : t('scratchpad.promptPlaceholder') || 'Ask a question, request drafting, or edit a specific section...'
              }
              className="w-full bg-transparent text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 resize-none focus:outline-none"
            />
            {loading ? (
              <button
                type="button"
                onClick={onStopGenerating}
                className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition shrink-0"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-1.5 rounded-lg bg-[#b8864d] text-stone-950 hover:brightness-110 disabled:opacity-30 active:scale-95 transition shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Selectors Bar */}
          <div className="flex items-center justify-between text-xs px-1">
            <Optimization position="top" align="left" />
            <div className="flex items-center space-x-1">
              <WaypointSelector position="top" />
              <Sources position="top" align="right" />
              <ModelSelector position="top" align="right" />
              <Attach position="top" />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScratchpadChat;
