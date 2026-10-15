'use client';

import React from 'react';
import {
  Layers,
  Play,
  Pause,
  Square,
  Eye,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { useBatchSearch } from '@/lib/batch-search/context';

export const BatchFloatingStatus: React.FC = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const {
    items,
    isSearching,
    isPaused,
    isModalOpen,
    openModal,
    setActiveTab,
    currentRunningQuery,
    totalQueries,
    completedCount,
    errorCount,
    progressPercent,
    pauseBatchSearch,
    resumeBatchSearch,
    stopBatchSearch,
  } = useBatchSearch();

  // Hide if no items, or if modal is open, or on the dedicated batch search page
  if (items.length === 0 || isModalOpen || pathname === '/batch-search') {
    return null;
  }

  const isFinished = totalQueries > 0 && completedCount === totalQueries;

  const handleOpenResults = () => {
    setActiveTab(completedCount > 0 ? 'results' : 'queue');
    openModal();
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center space-x-3 bg-light-primary/95 dark:bg-[#15110d]/95 backdrop-blur-md border border-[#b8864d]/40 dark:border-[#b8864d]/40 p-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-2xl shadow-black/40 text-stone-900 dark:text-stone-100 max-w-[92vw] sm:max-w-md">
        {/* Status Icon Indicator */}
        <div className="relative shrink-0">
          <div className="p-2 rounded-xl bg-[#b8864d]/15 text-[#b8864d]">
            <Layers
              className={cn(
                'w-4 h-4',
                isSearching && !isPaused && 'animate-pulse text-[#b8864d]',
              )}
            />
          </div>
          {isSearching && !isPaused && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
        </div>

        {/* Info Column */}
        <div
          onClick={handleOpenResults}
          className="flex-1 min-w-0 cursor-pointer group"
          title="Click to view details"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-black dark:text-stone-100 group-hover:text-[#b8864d] transition-colors">
              {t('batchSearch.title') || 'Batch Search'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-light-200 dark:bg-[#251e18] text-[#b8864d] font-semibold">
              {completedCount} / {totalQueries} ({progressPercent}%)
            </span>
          </div>

          <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-[200px] sm:max-w-[240px]">
            {isSearching && !isPaused && currentRunningQuery
              ? `${t('batchSearch.statusSearching') || 'Searching'}: "${currentRunningQuery}"`
              : isPaused
              ? t('batchSearch.pausedClickToContinue') || 'Paused • Click to continue'
              : isFinished
              ? t('batchSearch.allNotesCompleted') || 'All notes completed • Ready to export'
              : `${completedCount} ${t('batchSearch.completedClickToView') || 'completed • Click to view'}`}
          </p>
        </div>

        {/* Action Buttons: Preview / Continue / Abort */}
        <div className="flex items-center space-x-1.5 shrink-0 pl-1 border-l border-light-200 dark:border-[#28211a]">
          {/* Preview / View button */}
          <button
            type="button"
            onClick={handleOpenResults}
            title={t('batchSearch.preview') || 'Preview'}
            className="p-1.5 rounded-lg bg-light-200/80 dark:bg-[#221a14] hover:bg-[#b8864d]/20 text-stone-700 dark:text-stone-300 hover:text-[#b8864d] transition text-xs flex items-center space-x-1 font-medium"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">
              {t('batchSearch.preview') || 'Preview'}
            </span>
          </button>

          {/* Pause / Resume / Continue button */}
          {isSearching ? (
            <button
              type="button"
              onClick={isPaused ? resumeBatchSearch : pauseBatchSearch}
              title={
                isPaused
                  ? t('batchSearch.resumeSearch') || 'Resume'
                  : t('batchSearch.pauseSearch') || 'Pause'
              }
              className={cn(
                'p-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1',
                isPaused
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30',
              )}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-emerald-400" />
                  <span className="hidden sm:inline text-[11px]">
                    {t('batchSearch.resume') || 'Resume'}
                  </span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">
                    {t('batchSearch.pause') || 'Pause'}
                  </span>
                </>
              )}
            </button>
          ) : (
            completedCount < totalQueries && (
              <button
                type="button"
                onClick={resumeBatchSearch}
                title={t('batchSearch.continueSearch') || 'Continue search'}
                className="p-1.5 rounded-lg bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 transition flex items-center space-x-1 shadow-sm"
              >
                <Play className="w-3 h-3 fill-[#0c0a09]" />
                <span className="hidden sm:inline text-[11px]">
                  {t('batchSearch.continue') || 'Continue'}
                </span>
              </button>
            )
          )}

          {/* Abort / Stop button */}
          {isSearching && (
            <button
              type="button"
              onClick={stopBatchSearch}
              title={t('batchSearch.stopSearch') || 'Stop'}
              className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 transition text-xs flex items-center space-x-1"
            >
              <Square className="w-3.5 h-3.5 fill-red-400" />
              <span className="hidden sm:inline text-[11px]">
                {t('batchSearch.abort') || 'Stop'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchFloatingStatus;
