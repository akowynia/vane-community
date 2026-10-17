'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Play,
  Pause,
  RotateCcw,
  Square,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Plus,
  Copy,
  Download,
  NotebookPen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Edit3,
  Eye,
  Sliders,
  Globe,
  GraduationCap,
  MessageSquare,
  Cpu,
  Search,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { MinimalProvider } from '@/lib/models/types';
import {
  BatchQueryItem,
  HeaderFormatType,
} from '@/lib/batch-search/types';
import {
  parseCsvInput,
  generateSampleCsv,
  compileDocument,
  exportToCsv,
} from '@/lib/batch-search/parser';
import { useBatchSearch } from '@/lib/batch-search/context';

interface BatchItemRowProps {
  item: BatchQueryItem;
  idx: number;
  isRunningThis: boolean;
  memoizedModelOptions: { value: string; label: string }[];
  onToggleSelect: (idx: number) => void;
  onUpdateNumber: (idx: number, num: string) => void;
  onUpdateQuery: (idx: number, q: string) => void;
  onToggleSource: (idx: number, src: 'web' | 'academic' | 'discussions') => void;
  onUpdateOptimization: (idx: number, opt: 'speed' | 'balanced' | 'quality') => void;
  onUpdateModel: (idx: number, pId: string, mKey: string) => void;
  onDelete: (idx: number) => void;
  t: any;
}

const BatchItemRow = React.memo<BatchItemRowProps>(({
  item,
  idx,
  isRunningThis,
  memoizedModelOptions,
  onToggleSelect,
  onUpdateNumber,
  onUpdateQuery,
  onToggleSource,
  onUpdateOptimization,
  onUpdateModel,
  onDelete,
  t,
}) => {
  return (
    <tr
      className={cn(
        'hover:bg-light-secondary/50 dark:hover:bg-[#16120e] transition',
        isRunningThis && 'bg-[#b8864d]/10 dark:bg-[#b8864d]/10',
        item.status === 'completed' && 'dark:bg-emerald-950/10',
        item.status === 'error' && 'dark:bg-red-950/15',
      )}
    >
      {/* Checkbox */}
      <td className="p-3 text-center">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={() => onToggleSelect(idx)}
          className="rounded text-[#b8864d] focus:ring-[#b8864d] border-light-300 dark:border-[#2f251c] dark:bg-[#1a1511]"
        />
      </td>

      {/* Number input */}
      <td className="p-3">
        <input
          type="text"
          value={item.number}
          onChange={(e) => onUpdateNumber(idx, e.target.value)}
          className="w-12 px-1.5 py-1 rounded bg-light-primary dark:bg-[#18130f] border border-light-200 dark:border-[#28211a] font-mono text-center text-xs focus:outline-none focus:border-[#b8864d]"
        />
      </td>

      {/* Query text input */}
      <td className="p-3">
        <input
          type="text"
          value={item.query}
          onChange={(e) => onUpdateQuery(idx, e.target.value)}
          placeholder="Enter research question or concept..."
          className="w-full px-2.5 py-1.5 rounded-lg bg-light-primary dark:bg-[#18130f] border border-light-200 dark:border-[#28211a] text-xs focus:outline-none focus:border-[#b8864d]"
        />
        {item.error && (
          <p className="text-[11px] text-red-400 mt-1 flex items-center space-x-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{item.error}</span>
          </p>
        )}
      </td>

      {/* Sources toggles (Web, Academic, Discussions) */}
      <td className="p-3">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => onToggleSource(idx, 'web')}
            title="Web search"
            className={cn(
              'px-2 py-1 rounded-md text-[11px] font-medium flex items-center space-x-1 transition',
              item.sources.includes('web')
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 font-semibold'
                : 'bg-light-200 dark:bg-[#1a1410] text-stone-500 hover:text-stone-300 border border-transparent',
            )}
          >
            <Globe className="w-3 h-3" />
            <span>Web</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleSource(idx, 'academic')}
            title="Academic sources"
            className={cn(
              'px-2 py-1 rounded-md text-[11px] font-medium flex items-center space-x-1 transition',
              item.sources.includes('academic')
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 font-semibold'
                : 'bg-light-200 dark:bg-[#1a1410] text-stone-500 hover:text-stone-300 border border-transparent',
            )}
          >
            <GraduationCap className="w-3 h-3" />
            <span>Acad</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleSource(idx, 'discussions')}
            title="Discussions and forums"
            className={cn(
              'px-2 py-1 rounded-md text-[11px] font-medium flex items-center space-x-1 transition',
              item.sources.includes('discussions')
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold'
                : 'bg-light-200 dark:bg-[#1a1410] text-stone-500 hover:text-stone-300 border border-transparent',
            )}
          >
            <MessageSquare className="w-3 h-3" />
            <span>Disc</span>
          </button>
        </div>
      </td>

      {/* Optimization mode */}
      <td className="p-3">
        <select
          value={item.optimizationMode}
          onChange={(e) =>
            onUpdateOptimization(
              idx,
              e.target.value as 'speed' | 'balanced' | 'quality',
            )
          }
          className="w-full px-2 py-1 rounded bg-light-primary dark:bg-[#18130f] border border-light-200 dark:border-[#28211a] text-xs focus:outline-none focus:border-[#b8864d]"
        >
          <option value="speed">⚡ Speed</option>
          <option value="balanced">⚖️ Balanced</option>
          <option value="quality">⭐ Quality</option>
        </select>
      </td>

      {/* AI Model selection */}
      <td className="p-3">
        <select
          value={
            item.modelKey && item.providerId
              ? `${item.providerId}:::${item.modelKey}`
              : ''
          }
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              onUpdateModel(idx, '', '');
            } else {
              const [pId, mKey] = val.split(':::');
              onUpdateModel(idx, pId, mKey);
            }
          }}
          className="w-full px-2 py-1 rounded bg-light-primary dark:bg-[#18130f] border border-light-200 dark:border-[#28211a] text-xs focus:outline-none focus:border-[#b8864d] truncate"
        >
          <option value="">Default AI Model</option>
          {memoizedModelOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </td>

      {/* Status */}
      <td className="p-3">
        {item.status === 'pending' && (
          <span className="inline-flex items-center space-x-1 text-stone-500 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('batchSearch.statusPending') || 'Pending'}</span>
          </span>
        )}
        {item.status === 'searching' && (
          <span className="inline-flex items-center space-x-1.5 text-[#b8864d] font-medium">
            <span className="w-3.5 h-3.5 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
            <span>{t('batchSearch.statusSearching') || 'Searching...'}</span>
          </span>
        )}
        {item.status === 'completed' && (
          <span className="inline-flex items-center space-x-1 text-emerald-500 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('batchSearch.statusCompleted') || 'Done'}</span>
            {item.durationMs && (
              <span className="text-[10px] text-stone-500 ml-1">
                ({(item.durationMs / 1000).toFixed(1)}s)
              </span>
            )}
          </span>
        )}
        {item.status === 'error' && (
          <span className="inline-flex items-center space-x-1 text-red-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t('batchSearch.statusError') || 'Error'}</span>
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="p-3 text-center">
        <button
          type="button"
          onClick={() => onDelete(idx)}
          title="Delete row"
          className="p-1 rounded text-stone-400 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
});

BatchItemRow.displayName = 'BatchItemRow';

interface BatchSearchWorkspaceProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const BatchSearchWorkspace: React.FC<BatchSearchWorkspaceProps> = ({
  onClose,
  isModal = false,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  const {
    items,
    setItems,
    activeTab,
    setActiveTab,
    rawCsvText,
    setRawCsvText,
    defaultSources,
    setDefaultSources,
    defaultOptimization,
    setDefaultOptimization,
    defaultModelKey,
    setDefaultModelKey,
    defaultProviderId,
    setDefaultProviderId,
    headerFormat,
    setHeaderFormat,
    includeSources,
    setIncludeSources,
    isSearching,
    isPaused,
    currentRunningIndex,
    currentRunningQuery,
    availableModelsList,
    startBatchSearch,
    pauseBatchSearch,
    resumeBatchSearch,
    stopBatchSearch,
    clearBatch,
    handleParseAndSetItems,
    handleToggleSelect,
    handleSelectAll,
    handleUpdateItemQuery,
    handleUpdateItemNumber,
    handleToggleItemSource,
    handleUpdateItemOptimization,
    handleUpdateItemModel,
    handleDeleteItem,
    handleAddNewItem,
    handleApplySourcesToAll,
    handleApplyOptimizationToAll,
    handleApplyModelToAll,
    totalQueries,
    completedCount,
    errorCount,
    selectedCount,
    progressPercent,
    compiledMarkdown,
  } = useBatchSearch();

  const [isDragging, setIsDragging] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Pagination states for smooth 60fps rendering with 100+ items
  const [queuePage, setQueuePage] = useState(0);
  const [queuePageSize, setQueuePageSize] = useState<number | 'all'>(25);

  const [resultsPage, setResultsPage] = useState(0);
  const [resultsPageSize, setResultsPageSize] = useState<number | 'all'>(10);

  // Memoized models list for fast select options
  const memoizedModelOptions = useMemo(() => {
    return availableModelsList.map((m) => ({
      value: `${m.providerId}:::${m.modelKey}`,
      label: `${m.modelName} (${m.providerName})`,
    }));
  }, [availableModelsList]);

  // Paginated queue items
  const paginatedQueueItems = useMemo(() => {
    if (queuePageSize === 'all') return items.map((item, idx) => ({ item, idx }));
    const start = queuePage * queuePageSize;
    return items
      .map((item, idx) => ({ item, idx }))
      .slice(start, start + queuePageSize);
  }, [items, queuePage, queuePageSize]);

  // Paginated results items
  const completedOrHasResponseItems = useMemo(() => {
    return items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.response || item.status === 'completed');
  }, [items]);

  const paginatedResultsItems = useMemo(() => {
    if (resultsPageSize === 'all') return completedOrHasResponseItems;
    const start = resultsPage * resultsPageSize;
    return completedOrHasResponseItems.slice(start, start + resultsPageSize);
  }, [completedOrHasResponseItems, resultsPage, resultsPageSize]);

  // Drag & drop file handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawCsvText(content);
        handleParseAndSetItems(content);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    const sample = generateSampleCsv();
    setRawCsvText(sample);
    handleParseAndSetItems(sample);
  };

  const handleDownloadTemplate = () => {
    const sample = generateSampleCsv();
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'batch_search_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStartBatchSearch = (retryOnlyErrors = false) => {
    startBatchSearch(retryOnlyErrors);
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeBatchSearch();
    } else {
      pauseBatchSearch();
    }
  };

  const handleStopSearch = () => {
    stopBatchSearch();
  };

  // Export handlers
  const handleDownloadMarkdown = () => {
    const blob = new Blob([compiledMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_research_notes_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadText = () => {
    const blob = new Blob([compiledMarkdown], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_research_notes_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const csvData = exportToCsv(items);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch_research_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(compiledMarkdown);
    toast.success(t('common.copied') || 'Copied to clipboard!');
  };

  const handleSaveToScratchpad = async () => {
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Batch Research: ${items[0]?.query || 'Queries'} (${items.length} items)`,
          content: compiledMarkdown,
          type: 'note',
          metadata: {
            isBatchExport: true,
            batchCount: items.length,
            generatedAt: new Date().toISOString(),
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(t('batchSearch.savedToScratchpadSuccess') || 'Saved note to Scratchpad!');
        if (data?.scratchpad?.id) {
          router.push(`/scratchpad/${data.scratchpad.id}`);
        }
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to save note to Scratchpad.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error saving to Scratchpad.');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-light-primary dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 rounded-2xl overflow-hidden border border-light-200 dark:border-[#241c15] shadow-2xl">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-light-200 dark:border-[#241c15] bg-light-secondary/60 dark:bg-[#14100d]/80 backdrop-blur-md gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[#b8864d]/25 to-[#b8864d]/10 border border-[#b8864d]/30 text-[#b8864d] shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-black dark:text-stone-100">
                {t('batchSearch.title') || 'Batch Search Studio'}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#b8864d]/20 text-[#b8864d] border border-[#b8864d]/30">
                CSV Pipeline
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {t('batchSearch.subtitle') ||
                'Process query lists with per-item search modes, live review, and clean notes export'}
            </p>
          </div>
        </div>

        {/* Tab Navigation Pill Buttons */}
        <div className="flex items-center bg-light-200/80 dark:bg-[#1b1510] p-1 rounded-xl border border-light-300 dark:border-[#2a2119] self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={cn(
              'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
              activeTab === 'upload'
                ? 'bg-light-primary dark:bg-[#282017] text-[#b8864d] shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
            )}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{t('batchSearch.uploadTab') || '1. Import & Setup'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={cn(
              'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
              activeTab === 'queue'
                ? 'bg-light-primary dark:bg-[#282017] text-[#b8864d] shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
            )}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('batchSearch.queueTab') || '2. Queue & Run'}</span>
            {items.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#b8864d]/20 text-[#b8864d] font-semibold">
                {items.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={cn(
              'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
              activeTab === 'results'
                ? 'bg-light-primary dark:bg-[#282017] text-[#b8864d] shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('batchSearch.resultsTab') || '3. Notes & Review'}</span>
            {completedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-500 font-semibold">
                {completedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={cn(
              'flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap',
              activeTab === 'export'
                ? 'bg-light-primary dark:bg-[#282017] text-[#b8864d] shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
            )}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('batchSearch.exportTab') || '4. Export Document'}</span>
          </button>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-light-200 dark:hover:bg-[#241c15] transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Content Area based on Tab */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: UPLOAD & SETUP                                                    */}
        {/* ========================================================================= */}
        {activeTab === 'upload' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={cn(
                'relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 flex flex-col items-center justify-center space-y-3 cursor-pointer',
                isDragging
                  ? 'border-[#b8864d] bg-[#b8864d]/10 scale-[1.01]'
                  : 'border-light-300 dark:border-[#2e241c] hover:border-[#b8864d]/60 bg-light-secondary/40 dark:bg-[#130f0c]/50',
              )}
            >
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileInputChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="p-4 rounded-2xl bg-[#b8864d]/15 text-[#b8864d]">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-black dark:text-stone-100">
                  {t('batchSearch.uploadTitle') || 'Upload CSV File'}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md">
                  {t('batchSearch.uploadDesc') ||
                    'Upload a CSV file containing query items formatted as: nr;question / concepts'}
                </p>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs shadow-md">
                  {t('batchSearch.browseFiles') || 'Browse Files'}
                </span>
                <span className="text-xs text-stone-400">
                  {t('batchSearch.dragDropText') || 'or drag and drop here'}
                </span>
              </div>
              <div className="text-[11px] text-[#b8864d]/80 font-mono pt-1">
                {t('batchSearch.csvFormatHint') ||
                  'Expected CSV format: nr;pytanie / pojęcia (e.g. 1;Machine learning architectures)'}
              </div>
            </div>

            {/* Quick Actions / Sample / Template */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-light-200 dark:border-[#221c16] bg-light-secondary/30 dark:bg-[#120f0c]">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-[#b8864d]" />
                <span className="text-xs text-stone-600 dark:text-stone-300">
                  Need an example or starter template?
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-3 py-1 rounded-lg text-xs font-medium border border-light-300 dark:border-[#2d2218] hover:border-[#b8864d] text-stone-700 dark:text-stone-300 hover:text-[#b8864d] transition"
                >
                  {t('batchSearch.loadSampleCsv') || 'Load Sample CSV'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1 rounded-lg text-xs font-medium border border-[#b8864d]/40 text-[#b8864d] hover:bg-[#b8864d]/10 transition flex items-center space-x-1"
                >
                  <Download className="w-3 h-3" />
                  <span>{t('batchSearch.downloadTemplate') || 'Download Template'}</span>
                </button>
              </div>
            </div>

            {/* Default Import Configuration */}
            <div className="p-4 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/30 dark:bg-[#120f0c] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-[#b8864d]" />
                  <span className="text-xs font-semibold text-black dark:text-stone-100">
                    {t('batchSearch.defaultConfigTitle') || 'Default Settings for Import'}
                  </span>
                </div>
                <span className="text-[11px] text-stone-400">
                  {t('batchSearch.defaultConfigHint') || 'Can also be modified per item in the Queue'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Optimization Mode Picker */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block">
                    {t('batchSearch.colOptimization') || 'Optimization Mode'}
                  </label>
                  <div className="flex items-center space-x-1 bg-light-primary dark:bg-[#18130f] p-1 rounded-xl border border-light-300 dark:border-[#28211a]">
                    <button
                      type="button"
                      onClick={() => setDefaultOptimization('speed')}
                      className={cn(
                        'flex-1 py-1 px-1.5 rounded-lg text-xs font-medium transition text-center',
                        defaultOptimization === 'speed'
                          ? 'bg-[#b8864d]/20 text-[#b8864d] font-semibold'
                          : 'text-stone-500 hover:text-stone-300',
                      )}
                    >
                      ⚡ Speed
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultOptimization('balanced')}
                      className={cn(
                        'flex-1 py-1 px-1.5 rounded-lg text-xs font-medium transition text-center',
                        defaultOptimization === 'balanced'
                          ? 'bg-[#b8864d]/20 text-[#b8864d] font-semibold'
                          : 'text-stone-500 hover:text-stone-300',
                      )}
                    >
                      ⚖️ Balanced
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultOptimization('quality')}
                      className={cn(
                        'flex-1 py-1 px-1.5 rounded-lg text-xs font-medium transition text-center',
                        defaultOptimization === 'quality'
                          ? 'bg-[#b8864d]/20 text-[#b8864d] font-semibold'
                          : 'text-stone-500 hover:text-stone-300',
                      )}
                    >
                      ⭐ Quality
                    </button>
                  </div>
                </div>

                {/* Default Sources Multiselect */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block">
                    {t('batchSearch.colSources') || 'Default Sources'}
                  </label>
                  <div className="flex items-center space-x-1 bg-light-primary dark:bg-[#18130f] p-1 rounded-xl border border-light-300 dark:border-[#28211a]">
                    <button
                      type="button"
                      onClick={() => {
                        const exists = defaultSources.includes('web');
                        const next = exists
                          ? defaultSources.filter((s) => s !== 'web')
                          : [...defaultSources, 'web'];
                        setDefaultSources(next.length ? next : ['web']);
                      }}
                      className={cn(
                        'flex-1 py-1 px-1.5 rounded-lg text-xs font-medium transition text-center',
                        defaultSources.includes('web')
                          ? 'bg-[#b8864d]/20 text-[#b8864d] font-semibold'
                          : 'text-stone-500 hover:text-stone-300',
                      )}
                    >
                      🌐 Web
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const exists = defaultSources.includes('academic');
                        const next = exists
                          ? defaultSources.filter((s) => s !== 'academic')
                          : [...defaultSources, 'academic'];
                        setDefaultSources(next.length ? next : ['web']);
                      }}
                      className={cn(
                        'flex-1 py-1 px-1.5 rounded-lg text-xs font-medium transition text-center',
                        defaultSources.includes('academic')
                          ? 'bg-purple-500/20 text-purple-400 font-semibold'
                          : 'text-stone-500 hover:text-stone-300',
                      )}
                    >
                      🎓 Acad
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const exists = defaultSources.includes('discussions');
                        const next = exists
                          ? defaultSources.filter((s) => s !== 'discussions')
                          : [...defaultSources, 'discussions'];
                        setDefaultSources(next.length ? next : ['web']);
                      }}
                      className={cn(
                        'flex-1 py-1 px-1.5 rounded-lg text-xs font-medium transition text-center',
                        defaultSources.includes('discussions')
                          ? 'bg-amber-500/20 text-amber-400 font-semibold'
                          : 'text-stone-500 hover:text-stone-300',
                      )}
                    >
                      💬 Disc
                    </button>
                  </div>
                </div>

                {/* Default Model Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-stone-500 dark:text-stone-400 block">
                    {t('batchSearch.setAllModel') || 'Default AI Model'}
                  </label>
                  <div className="flex items-center space-x-1.5 bg-light-primary dark:bg-[#18130f] p-2 rounded-xl border border-light-300 dark:border-[#28211a]">
                    <Cpu className="w-3.5 h-3.5 text-[#b8864d] shrink-0" />
                    <select
                      value={
                        defaultModelKey && defaultProviderId
                          ? `${defaultProviderId}:::${defaultModelKey}`
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) {
                          setDefaultProviderId('');
                          setDefaultModelKey('');
                        } else {
                          const [pId, mKey] = val.split(':::');
                          setDefaultProviderId(pId);
                          setDefaultModelKey(mKey);
                        }
                      }}
                      className="bg-transparent text-xs text-stone-800 dark:text-stone-200 focus:outline-none w-full truncate cursor-pointer font-medium"
                    >
                      <option value="">Default AI Model</option>
                      {availableModelsList.map((m) => (
                        <option
                          key={`default:::${m.providerId}:::${m.modelKey}`}
                          value={`${m.providerId}:::${m.modelKey}`}
                        >
                          {m.modelName} ({m.providerName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Paste CSV Directly */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                <span>{t('batchSearch.pasteCsvTitle') || 'Or paste CSV text directly'}</span>
                <span className="text-[11px] font-normal text-stone-400">
                  nr;pytanie / pojęcia
                </span>
              </label>
              <textarea
                value={rawCsvText}
                onChange={(e) => setRawCsvText(e.target.value)}
                rows={6}
                placeholder={
                  t('batchSearch.pasteCsvPlaceholder') ||
                  '1;Architektura transformerów w modelach LLM\n2;Kwantowa supremacja i kubity\n3;Mechanizmy uwagi Multi-Head Attention...'
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-light-200 dark:border-[#282119] bg-light-secondary dark:bg-[#130f0c] text-xs font-mono text-black dark:text-stone-200 placeholder:text-stone-400 focus:outline-none focus:border-[#b8864d] transition"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!rawCsvText.trim()}
                  onClick={() => handleParseAndSetItems(rawCsvText)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition shadow-sm flex items-center space-x-1.5"
                >
                  <span>Parse & Review Queries</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: QUEUE & RUN ("Mozna decydować jakie wyszukiwanie ma być...")        */}
        {/* ========================================================================= */}
        {activeTab === 'queue' && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Top Toolbar: Progress & Global Bulk Settings */}
            <div className="p-4 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#130f0c]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-semibold text-black dark:text-stone-200">
                    {t('batchSearch.totalQueries') || 'Total queries'}: {totalQueries}
                  </span>
                  <span className="text-stone-400">•</span>
                  <span className="text-stone-500 dark:text-stone-400">
                    {t('batchSearch.selectedCount', { count: selectedCount }) || `${selectedCount} selected`}
                  </span>
                  <span className="text-stone-400">•</span>
                  <span className="text-emerald-500 font-medium">
                    {completedCount} {t('batchSearch.statusCompleted') || 'completed'}
                  </span>
                  {errorCount > 0 && (
                    <>
                      <span className="text-stone-400">•</span>
                      <span className="text-red-400 font-medium">
                        {errorCount} {t('batchSearch.statusError') || 'errors'}
                      </span>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                <div className="w-full sm:w-80 h-2 bg-light-200 dark:bg-[#201812] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#b8864d] to-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Batch Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {!isSearching ? (
                  <>
                    {completedCount > 0 && completedCount < totalQueries ? (
                      <button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={() => handleStartBatchSearch(false)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs disabled:opacity-40 hover:brightness-110 active:scale-95 transition shadow-sm flex items-center space-x-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>
                          {t('batchSearch.continueSearch') || 'Continue Search'} (
                          {totalQueries - completedCount} {t('batchSearch.remaining') || 'remaining'})
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={selectedCount === 0}
                        onClick={() => handleStartBatchSearch(false)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs disabled:opacity-40 hover:brightness-110 active:scale-95 transition shadow-sm flex items-center space-x-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-[#0c0a09]" />
                        <span>{t('batchSearch.startSearch') || 'Start Batch Search'}</span>
                      </button>
                    )}
                    {completedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('results')}
                        className="px-3 py-2 rounded-xl border border-[#b8864d]/40 text-[#b8864d] hover:bg-[#b8864d]/10 text-xs font-medium transition flex items-center space-x-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {t('batchSearch.preview') || 'Preview Notes'} ({completedCount})
                        </span>
                      </button>
                    )}
                    {errorCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleStartBatchSearch(true)}
                        className="px-3 py-2 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-medium transition flex items-center space-x-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('batchSearch.retryFailed') || 'Retry Failed'}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handlePauseResume}
                      className="px-3 py-2 rounded-xl border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs font-medium transition flex items-center space-x-1.5"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? t('batchSearch.resumeSearch') || 'Resume' : t('batchSearch.pauseSearch') || 'Pause'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStopSearch}
                      className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition flex items-center space-x-1.5"
                    >
                      <Square className="w-3.5 h-3.5 fill-red-400" />
                      <span>{t('batchSearch.stopSearch') || 'Stop'}</span>
                    </button>
                    {completedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('results')}
                        className="px-3 py-2 rounded-xl border border-[#b8864d]/40 text-[#b8864d] hover:bg-[#b8864d]/10 text-xs font-medium transition flex items-center space-x-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{t('batchSearch.preview') || 'Preview Notes'}</span>
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="px-3 py-2 rounded-xl border border-light-300 dark:border-[#2a2119] text-stone-700 dark:text-stone-300 hover:border-[#b8864d] text-xs font-medium transition flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('batchSearch.addRow') || 'Add Query'}</span>
                </button>
              </div>
            </div>

            {/* Bulk Setup Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-2 py-1">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-stone-500 hover:text-[#b8864d] transition"
                >
                  {t('batchSearch.selectAll') || 'Select all'}
                </button>
                <span className="text-stone-400">•</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-stone-500 hover:text-[#b8864d] transition"
                >
                  {t('batchSearch.deselectAll') || 'Deselect all'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-stone-500">Apply to all:</span>
                <button
                  type="button"
                  onClick={() => handleApplySourcesToAll(['web'])}
                  className="px-2 py-0.5 rounded border border-light-300 dark:border-[#28211a] hover:border-[#b8864d] text-[11px] text-stone-600 dark:text-stone-400"
                >
                  🌐 Web only
                </button>
                <button
                  type="button"
                  onClick={() => handleApplySourcesToAll(['academic'])}
                  className="px-2 py-0.5 rounded border border-light-300 dark:border-[#28211a] hover:border-[#b8864d] text-[11px] text-stone-600 dark:text-stone-400"
                >
                  🎓 Academic only
                </button>
                <button
                  type="button"
                  onClick={() => handleApplySourcesToAll(['web', 'academic'])}
                  className="px-2 py-0.5 rounded border border-light-300 dark:border-[#28211a] hover:border-[#b8864d] text-[11px] text-stone-600 dark:text-stone-400"
                >
                  🌐+🎓 Web & Academic
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyOptimizationToAll('speed')}
                  className="px-2 py-0.5 rounded border border-light-300 dark:border-[#28211a] hover:border-[#b8864d] text-[11px] text-stone-600 dark:text-stone-400"
                >
                  ⚡ Speed mode
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyOptimizationToAll('balanced')}
                  className="px-2 py-0.5 rounded border border-light-300 dark:border-[#28211a] hover:border-[#b8864d] text-[11px] text-stone-600 dark:text-stone-400"
                >
                  ⚖️ Balanced mode
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyOptimizationToAll('quality')}
                  className="px-2 py-0.5 rounded border border-light-300 dark:border-[#28211a] hover:border-[#b8864d] text-[11px] text-stone-600 dark:text-stone-400"
                >
                  ⭐ Quality mode
                </button>

                <div className="flex items-center space-x-1.5 bg-light-primary dark:bg-[#18130f] px-2 py-0.5 rounded-lg border border-light-300 dark:border-[#2a2119]">
                  <Cpu className="w-3 h-3 text-[#b8864d]" />
                  <span className="text-[11px] text-stone-500 whitespace-nowrap">
                    {t('batchSearch.setAllModel') || 'Model for all'}:
                  </span>
                  <select
                    id="batch-bulk-model-select"
                    value={
                      defaultModelKey && defaultProviderId
                        ? `${defaultProviderId}:::${defaultModelKey}`
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        handleApplyModelToAll('', '');
                      } else {
                        const [pId, mKey] = val.split(':::');
                        handleApplyModelToAll(pId, mKey);
                      }
                    }}
                    className="bg-transparent text-[11px] text-stone-800 dark:text-stone-200 focus:outline-none max-w-[160px] truncate cursor-pointer font-medium"
                  >
                    <option value="">Default AI Model</option>
                    {availableModelsList.map((m) => (
                      <option
                        key={`${m.providerId}:::${m.modelKey}`}
                        value={`${m.providerId}:::${m.modelKey}`}
                      >
                        {m.modelName} ({m.providerName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Queries Table */}
            {items.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-light-300 dark:border-[#282119] rounded-2xl p-6">
                <FileSpreadsheet className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-xs text-stone-500">
                  {t('batchSearch.noItemsLoaded') || 'No queries loaded yet. Go to Import to upload a CSV.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-[#b8864d]/15 text-[#b8864d] text-xs font-medium"
                >
                  {t('batchSearch.uploadTab') || 'Go to Import'}
                </button>
              </div>
            ) : (
              <div className="border border-light-200 dark:border-[#221c16] rounded-2xl overflow-hidden bg-light-secondary/20 dark:bg-[#110e0c]/60 shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-light-secondary/70 dark:bg-[#181410] text-stone-500 dark:text-stone-400 border-b border-light-200 dark:border-[#221c16]">
                      <tr>
                        <th className="p-3 w-10 text-center">✓</th>
                        <th className="p-3 w-16">{t('batchSearch.colNumber') || 'No.'}</th>
                        <th className="p-3 min-w-[240px]">{t('batchSearch.colQuery') || 'Query / Concept'}</th>
                        <th className="p-3 min-w-[190px]">{t('batchSearch.colSources') || 'Sources'}</th>
                        <th className="p-3 w-32">{t('batchSearch.colOptimization') || 'Mode'}</th>
                        <th className="p-3 w-40">
                          <div className="flex items-center justify-between">
                            <span>Model</span>
                            <span className="text-[10px] text-[#b8864d] font-normal">
                              (bulk above)
                            </span>
                          </div>
                        </th>
                        <th className="p-3 w-28">{t('batchSearch.colStatus') || 'Status'}</th>
                        <th className="p-3 w-16 text-center">{t('batchSearch.colActions') || 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-light-200 dark:divide-[#201812]">
                      {paginatedQueueItems.map(({ item, idx }) => (
                        <BatchItemRow
                          key={item.id}
                          item={item}
                          idx={idx}
                          isRunningThis={currentRunningIndex === idx}
                          memoizedModelOptions={memoizedModelOptions}
                          onToggleSelect={handleToggleSelect}
                          onUpdateNumber={handleUpdateItemNumber}
                          onUpdateQuery={handleUpdateItemQuery}
                          onToggleSource={handleToggleItemSource}
                          onUpdateOptimization={handleUpdateItemOptimization}
                          onUpdateModel={handleUpdateItemModel}
                          onDelete={handleDeleteItem}
                          t={t}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Queue Pagination Footer */}
                {items.length > 25 && (
                  <div className="p-3 border-t border-light-200 dark:border-[#201812] bg-light-secondary/40 dark:bg-[#16120e] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-stone-500">
                      <span>
                        Showing {queuePageSize === 'all' ? 1 : queuePage * queuePageSize + 1}–
                        {queuePageSize === 'all'
                          ? items.length
                          : Math.min(items.length, (queuePage + 1) * queuePageSize)}{' '}
                        of {items.length} queries
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-stone-400 text-[11px]">Per page:</span>
                        <select
                          value={queuePageSize}
                          onChange={(e) => {
                            const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                            setQueuePageSize(val);
                            setQueuePage(0);
                          }}
                          className="px-2 py-0.5 rounded bg-light-primary dark:bg-[#191410] border border-light-200 dark:border-[#28211a] text-xs font-medium focus:outline-none focus:border-[#b8864d]"
                        >
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value="all">All</option>
                        </select>
                      </div>

                      {queuePageSize !== 'all' && (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={queuePage === 0}
                            onClick={() => setQueuePage((p) => Math.max(0, p - 1))}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="font-mono text-stone-500 px-1">
                            {queuePage + 1} / {Math.ceil(items.length / queuePageSize)}
                          </span>
                          <button
                            type="button"
                            disabled={(queuePage + 1) * queuePageSize >= items.length}
                            onClick={() =>
                              setQueuePage((p) =>
                                (p + 1) * queuePageSize < items.length ? p + 1 : p,
                              )
                            }
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NOTES & REVIEW ("ale najpierw mozna przejrzeć przed wygenerowaniem") */}
        {/* ========================================================================= */}
        {activeTab === 'results' && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="flex items-center justify-between pb-2 border-b border-light-200 dark:border-[#221c16]">
              <div>
                <h2 className="text-base font-bold text-black dark:text-stone-100 flex items-center space-x-2">
                  <span>{t('batchSearch.resultsTab') || 'Generated Notes & Review'}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                    {completedCount} / {totalQueries} ready
                  </span>
                </h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Inspect and refine generated notes per question before compiling the final export file.
                </p>
              </div>

              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('export')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs shadow-sm flex items-center space-x-1.5"
                >
                  <span>Proceed to Final Export</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Live Search Runner Banner in Tab 3 */}
            {isSearching && (
              <div className="p-3.5 rounded-xl border border-[#b8864d]/40 bg-[#b8864d]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <span className="font-semibold text-black dark:text-stone-100">
                    {t('batchSearch.statusSearching') || 'Searching'}:
                  </span>
                  <span className="text-stone-600 dark:text-stone-300 font-medium truncate max-w-[250px] sm:max-w-md">
                    {currentRunningQuery
                      ? `"${currentRunningQuery}"`
                      : `#${(currentRunningIndex ?? 0) + 1}`}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="px-2.5 py-1 rounded-lg border border-amber-500/50 text-amber-400 hover:bg-amber-500/15 text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    {isPaused ? <Play className="w-3 h-3 fill-amber-400" /> : <Pause className="w-3 h-3" />}
                    <span>{isPaused ? t('batchSearch.resume') || 'Resume' : t('batchSearch.pause') || 'Pause'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStopSearch}
                    className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[11px] font-medium transition flex items-center space-x-1"
                  >
                    <Square className="w-3 h-3 fill-red-400" />
                    <span>{t('batchSearch.abort') || 'Stop'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Resume / Continue Incomplete Batch Banner in Tab 3 */}
            {!isSearching && completedCount > 0 && completedCount < totalQueries && (
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-[#2d241c] bg-light-secondary/60 dark:bg-[#16120e] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 text-stone-600 dark:text-stone-300">
                  <span className="font-semibold text-black dark:text-stone-100">
                    {completedCount} / {totalQueries} {t('batchSearch.statusCompleted') || 'completed'}
                  </span>
                  <span className="text-stone-400">•</span>
                  <span>
                    {totalQueries - completedCount} {t('batchSearch.remaining') || 'queries remaining'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStartBatchSearch(false)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-sm flex items-center space-x-1.5 transition self-start sm:self-auto"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>{t('batchSearch.continueSearch') || 'Continue remaining queries'}</span>
                </button>
              </div>
            )}

            {completedOrHasResponseItems.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-light-300 dark:border-[#282119] rounded-2xl p-6">
                <FileText className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-stone-300">
                  {t('batchSearch.noResultsYet') || 'No notes generated yet'}
                </h3>
                <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                  Start the batch search in the &quot;Queue &amp; Run&quot; tab to research questions sequentially.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#b8864d]/15 text-[#b8864d] text-xs font-semibold hover:bg-[#b8864d]/25 transition"
                >
                  Go to Queue &amp; Run
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedResultsItems.map(({ item, idx }) => {
                  const isEditingThis = editingItemIndex === idx;

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl border border-light-200 dark:border-[#251e18] bg-light-secondary/30 dark:bg-[#130f0c] shadow-sm space-y-3"
                    >
                      {/* Note Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-light-200 dark:border-[#221c16]">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#b8864d]/20 text-[#b8864d]">
                            #{item.number}
                          </span>
                          <h3 className="text-sm font-bold text-black dark:text-stone-100">
                            {item.query}
                          </h3>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-light-200 dark:bg-[#201812] text-stone-400">
                            {item.optimizationMode}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingItemIndex(isEditingThis ? null : idx)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center space-x-1',
                              isEditingThis
                                ? 'border-[#b8864d] text-[#b8864d] bg-[#b8864d]/10'
                                : 'border-light-300 dark:border-[#2c2219] text-stone-600 dark:text-stone-300 hover:border-[#b8864d]',
                            )}
                          >
                            {isEditingThis ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                            <span>{isEditingThis ? 'Preview' : t('batchSearch.editNote') || 'Edit Note'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Note Content (Preview or Textarea Editor) */}
                      {isEditingThis ? (
                        <div className="space-y-2">
                          <textarea
                            value={item.response || ''}
                            onChange={(e) => {
                              const newResp = e.target.value;
                              setItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, response: newResp } : it)),
                              );
                            }}
                            rows={8}
                            className="w-full p-3 rounded-xl bg-light-primary dark:bg-[#191410] border border-light-200 dark:border-[#2a221a] text-xs font-mono text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d] transition leading-relaxed"
                          />
                          <p className="text-[11px] text-stone-500">
                            Edits here update the exported final document instantly.
                          </p>
                        </div>
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                          {item.response}
                        </div>
                      )}

                      {/* Source Citations */}
                      {item.sourcesList && item.sourcesList.length > 0 && (
                        <div className="pt-3 border-t border-light-200 dark:border-[#1d1713]">
                          <span className="text-[11px] font-semibold text-stone-400 block mb-1">
                            Discovered Sources ({item.sourcesList.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.sourcesList.map((src, sIdx) => (
                              <a
                                key={sIdx}
                                href={src.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-light-200 dark:bg-[#1b1511] hover:bg-[#b8864d]/15 text-[11px] text-stone-600 dark:text-stone-300 hover:text-[#b8864d] transition border border-light-300 dark:border-[#271f18]"
                              >
                                <Globe className="w-2.5 h-2.5 text-[#b8864d]" />
                                <span className="max-w-[200px] truncate">{src.title || src.url}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Results Pagination Controls */}
                {completedOrHasResponseItems.length > 10 && (
                  <div className="p-3.5 rounded-xl border border-light-200 dark:border-[#251e18] bg-light-secondary/40 dark:bg-[#140f0c] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-stone-500">
                      Showing {resultsPageSize === 'all' ? 1 : resultsPage * resultsPageSize + 1}–
                      {resultsPageSize === 'all'
                        ? completedOrHasResponseItems.length
                        : Math.min(
                            completedOrHasResponseItems.length,
                            (resultsPage + 1) * resultsPageSize,
                          )}{' '}
                      of {completedOrHasResponseItems.length} notes
                    </span>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <span className="text-stone-400 text-[11px]">Per page:</span>
                        <select
                          value={resultsPageSize}
                          onChange={(e) => {
                            const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                            setResultsPageSize(val);
                            setResultsPage(0);
                          }}
                          className="px-2 py-0.5 rounded bg-light-primary dark:bg-[#191410] border border-light-200 dark:border-[#28211a] text-xs font-medium focus:outline-none focus:border-[#b8864d]"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value="all">All</option>
                        </select>
                      </div>

                      {resultsPageSize !== 'all' && (
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            disabled={resultsPage === 0}
                            onClick={() => setResultsPage((p) => Math.max(0, p - 1))}
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="font-mono text-stone-500 px-1">
                            {resultsPage + 1} / {Math.ceil(completedOrHasResponseItems.length / resultsPageSize)}
                          </span>
                          <button
                            type="button"
                            disabled={(resultsPage + 1) * resultsPageSize >= completedOrHasResponseItems.length}
                            onClick={() =>
                              setResultsPage((p) =>
                                (p + 1) * resultsPageSize < completedOrHasResponseItems.length ? p + 1 : p,
                              )
                            }
                            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-40 transition"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: EXPORT DOCUMENT ("i jest sporządzany plik: np. pytanie [nr]...")   */}
        {/* ========================================================================= */}
        {activeTab === 'export' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Export Configurations & Actions */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-[#241c15] bg-light-secondary/40 dark:bg-[#130f0c] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-black dark:text-stone-100 flex items-center space-x-2">
                  <Download className="w-4 h-4 text-[#b8864d]" />
                  <span>{t('batchSearch.finalDocumentTitle') || 'Compiled Research Document'}</span>
                </h3>

                {/* Formatting toggles */}
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-stone-500">{t('batchSearch.headerFormat') || 'Header'}:</span>
                    <select
                      value={headerFormat}
                      onChange={(e) => setHeaderFormat(e.target.value as HeaderFormatType)}
                      className="px-2 py-1 rounded bg-light-primary dark:bg-[#191410] border border-light-200 dark:border-[#282119] text-xs focus:outline-none focus:border-[#b8864d]"
                    >
                      <option value="query_number">
                        {t('batchSearch.headerFormatOption1') || 'Pytanie [Nr]'}
                      </option>
                      <option value="number_query">
                        {t('batchSearch.headerFormatOption2') || '[Nr] Pytanie'}
                      </option>
                    </select>
                  </div>

                  <label className="flex items-center space-x-1.5 cursor-pointer text-stone-600 dark:text-stone-300">
                    <input
                      type="checkbox"
                      checked={includeSources}
                      onChange={(e) => setIncludeSources(e.target.checked)}
                      className="rounded text-[#b8864d] focus:ring-[#b8864d] border-light-300 dark:border-[#2e2319] dark:bg-[#191410]"
                    />
                    <span>{t('batchSearch.includeSources') || 'Include source links'}</span>
                  </label>
                </div>
              </div>

              {/* Action Export Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs shadow-sm hover:brightness-110 active:scale-95 transition flex items-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('batchSearch.downloadMarkdown') || 'Markdown (.md)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadText}
                  className="px-3 py-2 rounded-xl border border-light-300 dark:border-[#2a2119] hover:border-[#b8864d] text-xs font-medium text-stone-700 dark:text-stone-300 transition flex items-center space-x-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{t('batchSearch.downloadText') || 'Text (.txt)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="px-3 py-2 rounded-xl border border-light-300 dark:border-[#2a2119] hover:border-[#b8864d] text-xs font-medium text-stone-700 dark:text-stone-300 transition flex items-center space-x-1.5"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{t('batchSearch.downloadCsv') || 'CSV (.csv)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="px-3 py-2 rounded-xl border border-light-300 dark:border-[#2a2119] hover:border-[#b8864d] text-xs font-medium text-stone-700 dark:text-stone-300 transition flex items-center space-x-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('batchSearch.copyToClipboard') || 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToScratchpad}
                  className="px-3 py-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 hover:bg-purple-500/25 text-xs font-medium transition flex items-center space-x-1.5"
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  <span>{t('batchSearch.saveToScratchpad') || 'Save to Scratchpad'}</span>
                </button>
              </div>
            </div>

            {/* Live Document Preview Box */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-500 block">
                Final Document Preview:
              </span>
              <div className="p-6 rounded-2xl border border-light-200 dark:border-[#241c15] bg-light-secondary/20 dark:bg-[#120f0c] max-h-[550px] overflow-y-auto">
                {compiledMarkdown ? (
                  <pre className="text-xs font-mono text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                    {compiledMarkdown}
                  </pre>
                ) : (
                  <div className="text-center py-12 text-xs text-stone-500">
                    No completed queries to compile. Complete queries in the Queue &amp; Run tab to see the final file.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchSearchWorkspace;
