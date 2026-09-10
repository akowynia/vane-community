'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  History,
  X,
  RotateCcw,
  Bot,
  User,
  Clock,
  Sparkles,
  Layers,
  FileText,
  Eye,
  GitCompare,
  Plus,
  Minus,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { formatTimeDifference } from '@/lib/utils';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import CodeBlock from '../MessageRenderer/CodeBlock';
import { computeLineDiff, computeWordDiff, getDiffStats, DiffLine } from '@/lib/scratchpad/diff';

export interface ScratchpadVersion {
  id: string;
  scratchpadId: string;
  versionNumber: number;
  title: string;
  content: string;
  summary?: string | null;
  prompt?: string | null;
  sources?: any[];
  author: string;
  createdAt: string;
}

interface ScratchpadVersionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  versions: ScratchpadVersion[];
  currentVersionNumber?: number;
  onRevert: (version: ScratchpadVersion) => void;
  isReverting?: boolean;
}

const ScratchpadVersionHistory: React.FC<ScratchpadVersionHistoryProps> = ({
  isOpen,
  onClose,
  versions,
  currentVersionNumber,
  onRevert,
  isReverting = false,
}) => {
  const { t, locale } = useTranslation();
  const [selectedVersion, setSelectedVersion] = useState<ScratchpadVersion | null>(
    versions[0] || null,
  );
  const [viewMode, setViewMode] = useState<'preview' | 'diff'>('diff');
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);

  const active = selectedVersion || versions[0];

  // Find default previous version for comparison
  const activeIndex = versions.findIndex((v) => v.id === active?.id);
  const previousVersion = activeIndex !== -1 && activeIndex < versions.length - 1 ? versions[activeIndex + 1] : null;

  // Selected compare baseline version
  const compareWithVersion = useMemo(() => {
    if (compareVersionId) {
      const found = versions.find((v) => v.id === compareVersionId);
      if (found && found.id !== active?.id) return found;
    }
    return previousVersion;
  }, [compareVersionId, active, previousVersion, versions]);

  // Compute diff between compareWithVersion and active
  const diffLines = useMemo(() => {
    if (!active) return [];
    const baseContent = compareWithVersion ? compareWithVersion.content : '';
    return computeLineDiff(baseContent, active.content);
  }, [active, compareWithVersion]);

  const diffStats = useMemo(() => getDiffStats(diffLines), [diffLines]);

  // Precompute mini diff stats for each version in the sidebar
  const versionStatsMap = useMemo(() => {
    const map = new Map<string, { added: number; removed: number }>();
    for (let idx = 0; idx < versions.length; idx++) {
      const current = versions[idx];
      const prev = idx < versions.length - 1 ? versions[idx + 1] : null;
      if (prev) {
        const d = computeLineDiff(prev.content, current.content);
        const stats = getDiffStats(d);
        map.set(current.id, { added: stats.added, removed: stats.removed });
      } else {
        // First version: all lines are added
        const lineCount = current.content ? current.content.split('\n').length : 0;
        map.set(current.id, { added: lineCount, removed: 0 });
      }
    }
    return map;
  }, [versions]);

  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      table: {
        component: ({ children, ...props }: any) => (
          <div className="w-full my-4 overflow-x-auto rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary/20 dark:bg-[#16120f]/40 shadow-sm">
            <table className="w-full min-w-full border-collapse text-left text-xs sm:text-sm" {...props}>
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
          <th className="px-3.5 py-2.5 font-semibold text-stone-900 dark:text-stone-100 border-r border-light-200/60 dark:border-[#2a241d]/60 last:border-r-0 whitespace-nowrap" {...props}>
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
          <td className="px-3.5 py-2.5 text-stone-700 dark:text-stone-300 border-r border-light-200/40 dark:border-[#2a241d]/40 last:border-r-0 align-top break-words" {...props}>
            {children}
          </td>
        ),
      },
    },
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return <code key={state.key} className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs">{node.text ?? ''}</code>;
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

  const titleChanged = compareWithVersion && compareWithVersion.title !== active.title;

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={React.Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 overflow-y-auto p-3 sm:p-6 md:p-8 flex items-center justify-center">
          <TransitionChild
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#2a241d] text-left shadow-2xl transition-all w-full max-w-6xl h-[88vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/50 dark:bg-[#181411]/50">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#b8864d]/10 text-[#b8864d]">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle as="h3" className="text-base font-semibold text-stone-900 dark:text-stone-100">
                      {t('scratchpad.versionHistory') || 'Note Version History'}
                    </DialogTitle>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {versions.length} {t('scratchpad.versions')?.toLowerCase() || 'versions'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Content: Left List, Right Preview */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                {/* Timeline List (4 cols) */}
                <div className="md:col-span-4 border-r border-light-200 dark:border-[#221c16] overflow-y-auto p-4 space-y-2.5 bg-light-secondary/20 dark:bg-[#14100d]/20">
                  {versions.map((ver) => {
                    const isSelected = active?.id === ver.id;
                    const isCurrent = currentVersionNumber === ver.versionNumber;
                    const stats = versionStatsMap.get(ver.id);

                    return (
                      <div
                        key={ver.id}
                        onClick={() => {
                          setSelectedVersion(ver);
                          setCompareVersionId(null); // Reset custom compare to default previous
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                          isSelected
                            ? 'bg-[#b8864d]/15 border-[#b8864d]/40 shadow-sm'
                            : 'bg-light-secondary dark:bg-[#1a1613] border-light-200 dark:border-[#26201a] hover:border-stone-300 dark:hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                              v{ver.versionNumber}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                                {t('scratchpad.currentVersion') || 'Current'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1 text-[11px] text-stone-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeDifference(ver.createdAt, locale)}</span>
                          </div>
                        </div>

                        <p className="text-xs font-medium text-stone-700 dark:text-stone-300 line-clamp-1 mb-1">
                          {ver.title || t('scratchpad.untitled') || 'Untitled'}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
                          <div className="flex items-center space-x-1">
                            {ver.author === 'ai' ? (
                              <span className="flex items-center space-x-1 text-[#b8864d]">
                                <Bot className="w-3 h-3" />
                                <span>AI</span>
                              </span>
                            ) : (
                              <span className="flex items-center space-x-1 text-stone-400">
                                <User className="w-3 h-3" />
                                <span>{t('scratchpad.authorUser') || 'User'}</span>
                              </span>
                            )}
                          </div>

                          {/* Mini Diff Badge */}
                          {stats && (
                            <div className="flex items-center space-x-1 font-mono text-[10.5px]">
                              {stats.added > 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  +{stats.added}
                                </span>
                              )}
                              {stats.removed > 0 && (
                                <span className="text-red-500 font-medium">
                                  -{stats.removed}
                                </span>
                              )}
                            </div>
                          )}

                          {ver.sources && ver.sources.length > 0 && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                              {ver.sources.length} {t('common.sources') || 'sources'}
                            </span>
                          )}
                        </div>

                        {ver.summary && (
                          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1.5 italic line-clamp-2">
                            {ver.summary}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Preview / Diff Panel (8 cols) */}
                <div className="md:col-span-8 flex flex-col h-full overflow-hidden bg-light-primary dark:bg-[#120f0d]">
                  {active ? (
                    <>
                      {/* Top Action & View Mode Toolbar */}
                      <div className="px-5 py-3 border-b border-light-200 dark:border-[#221c16] flex flex-wrap items-center justify-between gap-3 bg-light-secondary/30 dark:bg-[#16120f]/30">
                        {/* Title & metadata */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                            {active.title || t('scratchpad.untitled') || 'Untitled'}{' '}
                            <span className="text-xs text-stone-400 font-normal">(v{active.versionNumber})</span>
                          </h4>
                          <p className="text-xs text-stone-500 truncate">
                            {new Date(active.createdAt).toLocaleString(locale)} • {active.content.length}{' '}
                            {t('scratchpad.charsCount') || 'chars'}
                          </p>
                        </div>

                        {/* View Mode Switcher + Compare dropdown */}
                        <div className="flex items-center space-x-2">
                          {/* Mode Toggle: Preview / Diff */}
                          <div className="flex items-center bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-light-200 dark:border-[#26201a]">
                            <button
                              type="button"
                              onClick={() => setViewMode('diff')}
                              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                viewMode === 'diff'
                                  ? 'bg-light-primary dark:bg-[#1e1915] text-[#b8864d] shadow-sm'
                                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                              }`}
                            >
                              <GitCompare className="w-3.5 h-3.5" />
                              <span>{t('scratchpad.diffMode') || 'Changes (Diff)'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setViewMode('preview')}
                              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                viewMode === 'preview'
                                  ? 'bg-light-primary dark:bg-[#1e1915] text-[#b8864d] shadow-sm'
                                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                              }`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('scratchpad.fullPreview') || 'Preview'}</span>
                            </button>
                          </div>

                          {/* Revert Button */}
                          <button
                            type="button"
                            disabled={isReverting || currentVersionNumber === active.versionNumber}
                            onClick={() => onRevert(active)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#b8864d] text-stone-950 font-medium text-xs hover:brightness-110 active:scale-95 transition disabled:opacity-40 shrink-0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{t('scratchpad.revertVersion') || 'Revert to this version'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Sub-toolbar in Diff Mode: Comparison selector and stats */}
                      {viewMode === 'diff' && (
                        <div className="px-5 py-2 border-b border-light-200 dark:border-[#221c16] bg-black/[0.02] dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center space-x-2 text-stone-600 dark:text-stone-300">
                            <span className="text-stone-400">{t('scratchpad.compareWith') || 'Compare with:'}</span>
                            <select
                              value={compareWithVersion?.id || ''}
                              onChange={(e) => setCompareVersionId(e.target.value || null)}
                              className="bg-light-primary dark:bg-[#16120f] border border-light-200 dark:border-[#2a241d] rounded-lg px-2 py-1 text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                            >
                              {versions
                                .filter((v) => v.id !== active.id)
                                .map((v) => (
                                  <option key={v.id} value={v.id}>
                                    v{v.versionNumber} {v.versionNumber === previousVersion?.versionNumber ? `(${t('scratchpad.previousVersion') || 'Previous'})` : ''} - {v.title.slice(0, 30)}
                                  </option>
                                ))}
                              {!previousVersion && (
                                <option value="">{t('scratchpad.initialVersion') || 'Initial version (empty)'}</option>
                              )}
                            </select>
                          </div>

                          {/* Stats Badges */}
                          <div className="flex items-center space-x-2 font-mono text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                              <Plus className="w-3 h-3" />
                              <span>{diffStats.added} {t('scratchpad.linesAdded') || 'lines'}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 font-semibold flex items-center space-x-1">
                              <Minus className="w-3 h-3" />
                              <span>{diffStats.removed} {t('scratchpad.linesRemoved') || 'lines'}</span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* Prompt bubble if recorded */}
                        {active.prompt && (
                          <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-light-200 dark:border-[#251f19] text-xs">
                            <span className="font-semibold text-stone-600 dark:text-stone-300">Prompt:</span>{' '}
                            <span className="text-stone-500 dark:text-stone-400 italic">"{active.prompt}"</span>
                          </div>
                        )}

                        {/* Title Diff Banner if title changed */}
                        {viewMode === 'diff' && titleChanged && compareWithVersion && (
                          <div className="p-3 rounded-xl bg-[#b8864d]/10 border border-[#b8864d]/25 text-xs space-y-1">
                            <span className="font-semibold text-[#b8864d]">{t('scratchpad.titleChanged') || 'Title changed:'}</span>
                            <div className="flex items-center space-x-2">
                              <del className="text-red-500 dark:text-red-400 line-through">
                                {compareWithVersion.title}
                              </del>
                              <span className="text-stone-400">→</span>
                              <ins className="text-emerald-600 dark:text-emerald-400 font-medium no-underline">
                                {active.title}
                              </ins>
                            </div>
                          </div>
                        )}

                        {/* Diff Mode View */}
                        {viewMode === 'diff' ? (
                          <div className="rounded-xl border border-light-200 dark:border-[#26201a] overflow-hidden bg-light-primary dark:bg-[#0e0c0a] font-mono text-xs shadow-inner">
                            {diffLines.length === 0 ? (
                              <div className="p-6 text-center text-stone-400">
                                {t('scratchpad.noChangesDetected') || 'No content changes detected compared to selected version.'}
                              </div>
                            ) : (
                              <div className="divide-y divide-light-200/50 dark:divide-[#1c1713]">
                                {diffLines.map((line, lIdx) => {
                                  if (line.type === 'added') {
                                    return (
                                      <div
                                        key={lIdx}
                                        className="flex items-start bg-emerald-500/10 dark:bg-emerald-500/[0.12] text-emerald-900 dark:text-emerald-200 border-l-3 border-emerald-500 px-3 py-1 hover:bg-emerald-500/20 transition-colors"
                                      >
                                        <span className="w-8 select-none text-emerald-600/70 dark:text-emerald-400/70 text-[10.5px] text-right pr-3 shrink-0">
                                          {line.newLineNumber || '+'}
                                        </span>
                                        <span className="w-4 select-none text-emerald-600 font-bold shrink-0">+</span>
                                        <span className="flex-1 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed font-medium">
                                          {line.content || '\u00A0'}
                                        </span>
                                      </div>
                                    );
                                  }

                                  if (line.type === 'removed') {
                                    return (
                                      <div
                                        key={lIdx}
                                        className="flex items-start bg-red-500/10 dark:bg-red-500/[0.12] text-red-900 dark:text-red-300 border-l-3 border-red-500 px-3 py-1 hover:bg-red-500/20 transition-colors opacity-80"
                                      >
                                        <span className="w-8 select-none text-red-500/70 text-[10.5px] text-right pr-3 shrink-0">
                                          {line.oldLineNumber || '-'}
                                        </span>
                                        <span className="w-4 select-none text-red-500 font-bold shrink-0">-</span>
                                        <span className="flex-1 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed line-through">
                                          {line.content || '\u00A0'}
                                        </span>
                                      </div>
                                    );
                                  }

                                  // Unchanged line
                                  return (
                                    <div
                                      key={lIdx}
                                      className="flex items-start px-3 py-0.5 text-stone-700 dark:text-stone-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                                    >
                                      <span className="w-8 select-none text-stone-400 dark:text-stone-600 text-[10.5px] text-right pr-3 shrink-0">
                                        {line.newLineNumber}
                                      </span>
                                      <span className="w-4 select-none text-transparent shrink-0"> </span>
                                      <span className="flex-1 whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
                                        {line.content || '\u00A0'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Standard Markdown Preview */
                          <div className="prose prose-stone dark:prose-invert max-w-none text-sm leading-relaxed">
                            <Markdown options={markdownOverrides}>
                              {active.content || `*${t('scratchpad.blankSketch') || 'Blank note'}*`}
                            </Markdown>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
                      {t('scratchpad.selectVersionPreview') || 'Select a version from the list to preview.'}
                    </div>
                  )}
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ScratchpadVersionHistory;
