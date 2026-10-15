'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { MinimalProvider } from '@/lib/models/types';
import { BatchQueryItem, HeaderFormatType } from './types';
import {
  parseCsvInput,
  generateSampleCsv,
  compileDocument,
  exportToCsv,
} from './parser';

const STORAGE_KEY = 'vane_batch_search_persisted_session_v1';

interface AvailableModelInfo {
  providerId: string;
  providerName: string;
  modelKey: string;
  modelName: string;
}

interface BatchSearchContextType {
  // State
  items: BatchQueryItem[];
  setItems: React.Dispatch<React.SetStateAction<BatchQueryItem[]>>;
  activeTab: 'upload' | 'queue' | 'results' | 'export';
  setActiveTab: (tab: 'upload' | 'queue' | 'results' | 'export') => void;
  rawCsvText: string;
  setRawCsvText: (text: string) => void;
  isSearching: boolean;
  isPaused: boolean;
  currentRunningIndex: number | null;
  currentRunningQuery: string | null;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;

  // Configurations
  defaultSources: string[];
  setDefaultSources: (sources: string[]) => void;
  defaultOptimization: 'speed' | 'balanced' | 'quality';
  setDefaultOptimization: (mode: 'speed' | 'balanced' | 'quality') => void;
  defaultModelKey: string;
  setDefaultModelKey: (key: string) => void;
  defaultProviderId: string;
  setDefaultProviderId: (id: string) => void;
  headerFormat: HeaderFormatType;
  setHeaderFormat: (fmt: HeaderFormatType) => void;
  includeSources: boolean;
  setIncludeSources: (inc: boolean) => void;
  availableModelsList: AvailableModelInfo[];

  // Action methods
  startBatchSearch: (retryOnlyErrors?: boolean) => Promise<void>;
  pauseBatchSearch: () => void;
  resumeBatchSearch: () => void;
  stopBatchSearch: () => void;
  clearBatch: () => void;
  handleParseAndSetItems: (text: string) => void;
  handleToggleSelect: (index: number) => void;
  handleSelectAll: (select: boolean) => void;
  handleUpdateItemQuery: (index: number, newQuery: string) => void;
  handleUpdateItemNumber: (index: number, newNumber: string) => void;
  handleToggleItemSource: (index: number, sourceKey: string) => void;
  handleUpdateItemOptimization: (
    index: number,
    mode: 'speed' | 'balanced' | 'quality',
  ) => void;
  handleUpdateItemModel: (
    index: number,
    providerId: string,
    modelKey: string,
  ) => void;
  handleDeleteItem: (index: number) => void;
  handleAddNewItem: () => void;
  handleApplySourcesToAll: (sourcesToApply: string[]) => void;
  handleApplyOptimizationToAll: (mode: 'speed' | 'balanced' | 'quality') => void;
  handleApplyModelToAll: (providerId: string, modelKey: string) => void;

  // Computed metrics
  totalQueries: number;
  completedCount: number;
  errorCount: number;
  selectedCount: number;
  progressPercent: number;
  compiledMarkdown: string;
}

const BatchSearchContext = createContext<BatchSearchContextType | undefined>(
  undefined,
);

export const BatchSearchProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();

  // Tab & raw input state
  const [activeTab, setActiveTab] = useState<
    'upload' | 'queue' | 'results' | 'export'
  >('upload');
  const [rawCsvText, setRawCsvText] = useState('');
  const [items, setItems] = useState<BatchQueryItem[]>([]);

  // Configurations
  const [defaultSources, setDefaultSources] = useState<string[]>(['web']);
  const [defaultOptimization, setDefaultOptimization] = useState<
    'speed' | 'balanced' | 'quality'
  >('balanced');
  const [defaultModelKey, setDefaultModelKey] = useState<string>('');
  const [defaultProviderId, setDefaultProviderId] = useState<string>('');
  const [headerFormat, setHeaderFormat] =
    useState<HeaderFormatType>('query_number');
  const [includeSources, setIncludeSources] = useState(true);

  // Modal open state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Execution states
  const [isSearching, setIsSearching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number | null>(
    null,
  );
  const isPausedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Providers state
  const [providers, setProviders] = useState<MinimalProvider[]>([]);

  // Track initial load from localStorage
  const isHydratedRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Load providers from API
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/providers');
        if (res.ok) {
          const data = await res.json();
          if (data?.providers && Array.isArray(data.providers)) {
            setProviders(data.providers);
            if (!defaultModelKey && data.providers.length > 0) {
              const firstWithModel = data.providers.find(
                (p: MinimalProvider) => p.chatModels && p.chatModels.length > 0,
              );
              if (firstWithModel && firstWithModel.chatModels[0]) {
                setDefaultProviderId(firstWithModel.id);
                setDefaultModelKey(firstWithModel.chatModels[0].key);
              }
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    };
    fetchProviders();
  }, [defaultModelKey]);

  // Restore session from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          // Reset any dangling 'searching' states to 'pending'
          const sanitizedItems = parsed.items.map((it: BatchQueryItem) => ({
            ...it,
            status: it.status === 'searching' ? 'pending' : it.status,
          }));
          setItems(sanitizedItems);
          if (parsed.activeTab) setActiveTab(parsed.activeTab);
          if (parsed.rawCsvText) setRawCsvText(parsed.rawCsvText);
          if (parsed.defaultSources) setDefaultSources(parsed.defaultSources);
          if (parsed.defaultOptimization)
            setDefaultOptimization(parsed.defaultOptimization);
          if (parsed.defaultModelKey)
            setDefaultModelKey(parsed.defaultModelKey);
          if (parsed.defaultProviderId)
            setDefaultProviderId(parsed.defaultProviderId);
          if (parsed.headerFormat) setHeaderFormat(parsed.headerFormat);
          if (typeof parsed.includeSources === 'boolean')
            setIncludeSources(parsed.includeSources);
        }
      }
    } catch {
      // Ignore storage read errors
    } finally {
      isHydratedRef.current = true;
    }
  }, []);

  // Persist session to localStorage on changes
  useEffect(() => {
    if (!isHydratedRef.current) return;
    try {
      const payload = {
        items,
        activeTab,
        rawCsvText,
        defaultSources,
        defaultOptimization,
        defaultModelKey,
        defaultProviderId,
        headerFormat,
        includeSources,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage write errors
    }
  }, [
    items,
    activeTab,
    rawCsvText,
    defaultSources,
    defaultOptimization,
    defaultModelKey,
    defaultProviderId,
    headerFormat,
    includeSources,
  ]);

  const availableModelsList = useMemo(() => {
    const list: AvailableModelInfo[] = [];
    for (const p of providers) {
      for (const m of p.chatModels || []) {
        list.push({
          providerId: p.id,
          providerName: p.name,
          modelKey: m.key,
          modelName: m.name || m.key,
        });
      }
    }
    return list;
  }, [providers]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Listen to open-batch-search event
  useEffect(() => {
    const handleOpen = () => {
      setIsModalOpen(true);
    };
    window.addEventListener('open-batch-search', handleOpen);
    return () => {
      window.removeEventListener('open-batch-search', handleOpen);
    };
  }, []);

  // Parse CSV
  const handleParseAndSetItems = useCallback(
    (text: string) => {
      try {
        const parsed = parseCsvInput(
          text,
          defaultSources,
          defaultOptimization,
          defaultModelKey,
          defaultProviderId,
        );
        if (parsed.length === 0) {
          toast.error(
            t('batchSearch.noItemsLoaded') ||
              'No valid query rows detected in the CSV input.',
          );
          return;
        }
        setItems(parsed);
        toast.success(
          t('batchSearch.parseSuccess', { count: parsed.length }) ||
            `Loaded ${parsed.length} queries successfully.`,
        );
        setActiveTab('queue');
      } catch {
        toast.error(
          t('batchSearch.parseError') ||
            'Failed to parse CSV. Please check the format.',
        );
      }
    },
    [defaultSources, defaultOptimization, defaultModelKey, defaultProviderId, t],
  );

  // Row manipulation handlers
  const handleToggleSelect = useCallback((index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item,
      ),
    );
  }, []);

  const handleSelectAll = useCallback((select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  }, []);

  const handleUpdateItemQuery = useCallback(
    (index: number, newQuery: string) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, query: newQuery } : item,
        ),
      );
    },
    [],
  );

  const handleUpdateItemNumber = useCallback(
    (index: number, newNumber: string) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, number: newNumber } : item,
        ),
      );
    },
    [],
  );

  const handleToggleItemSource = useCallback(
    (index: number, sourceKey: string) => {
      setItems((prev) =>
        prev.map((item, i) => {
          if (i !== index) return item;
          const exists = item.sources.includes(sourceKey);
          let nextSources = exists
            ? item.sources.filter((s) => s !== sourceKey)
            : [...item.sources, sourceKey];
          if (nextSources.length === 0) {
            nextSources = ['web'];
          }
          return { ...item, sources: nextSources };
        }),
      );
    },
    [],
  );

  const handleUpdateItemOptimization = useCallback(
    (index: number, mode: 'speed' | 'balanced' | 'quality') => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, optimizationMode: mode } : item,
        ),
      );
    },
    [],
  );

  const handleUpdateItemModel = useCallback(
    (index: number, providerId: string, modelKey: string) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, providerId, modelKey } : item,
        ),
      );
    },
    [],
  );

  const handleDeleteItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddNewItem = useCallback(() => {
    setItems((prev) => {
      const nextNum = String(prev.length + 1);
      const newItem: BatchQueryItem = {
        id: `query_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        number: nextNum,
        query: '',
        sources: [...defaultSources],
        optimizationMode: defaultOptimization,
        modelKey: defaultModelKey,
        providerId: defaultProviderId,
        selected: true,
        status: 'pending',
      };
      return [...prev, newItem];
    });
  }, [defaultSources, defaultOptimization, defaultModelKey, defaultProviderId]);

  const handleApplySourcesToAll = useCallback(
    (sourcesToApply: string[]) => {
      setDefaultSources([...sourcesToApply]);
      setItems((prev) =>
        prev.map((item) => ({ ...item, sources: [...sourcesToApply] })),
      );
      toast.success(
        t('batchSearch.setAllSources') || 'Applied sources to all queries.',
      );
    },
    [t],
  );

  const handleApplyOptimizationToAll = useCallback(
    (optToApply: 'speed' | 'balanced' | 'quality') => {
      setDefaultOptimization(optToApply);
      setItems((prev) =>
        prev.map((item) => ({ ...item, optimizationMode: optToApply })),
      );
      toast.success(
        t('batchSearch.setAllOptimization') ||
          'Applied optimization mode to all queries.',
      );
    },
    [t],
  );

  const handleApplyModelToAll = useCallback(
    (providerId: string, modelKey: string) => {
      setDefaultProviderId(providerId);
      setDefaultModelKey(modelKey);
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          providerId,
          modelKey,
        })),
      );
      const modelObj = availableModelsList.find(
        (m) => m.providerId === providerId && m.modelKey === modelKey,
      );
      const label = modelObj
        ? `${modelObj.modelName} (${modelObj.providerName})`
        : 'Default AI Model';
      toast.success(
        t('batchSearch.setAllModel') || `Applied model ${label} to all queries.`,
      );
    },
    [availableModelsList, t],
  );

  const clearBatch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSearching(false);
    setIsPaused(false);
    setCurrentRunningIndex(null);
    setItems([]);
    setRawCsvText('');
    localStorage.removeItem(STORAGE_KEY);
    toast.info(t('batchSearch.clearAll') || 'Cleared batch search.');
  }, [t]);

  // Single query runner
  const executeQuery = async (
    item: BatchQueryItem,
    signal: AbortSignal,
  ): Promise<{ response: string; sourcesList: any[] }> => {
    const payload = {
      query: item.query,
      sources: item.sources && item.sources.length > 0 ? item.sources : ['web'],
      optimizationMode: item.optimizationMode || 'speed',
      chatModelKey: item.modelKey || defaultModelKey || undefined,
      chatModelProviderId: item.providerId || defaultProviderId || undefined,
      stream: false,
    };

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      let errMsg = `Search failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    return {
      response: data.message || '',
      sourcesList: data.sources || [],
    };
  };

  // Batch orchestrator
  const startBatchSearch = useCallback(
    async (retryOnlyErrors = false) => {
      if (items.length === 0) {
        toast.error(t('batchSearch.noItemsLoaded') || 'No queries to process.');
        return;
      }

      setIsSearching(true);
      setIsPaused(false);
      isPausedRef.current = false;
      abortControllerRef.current = new AbortController();

      const targets = items
        .map((item, idx) => ({ item, idx }))
        .filter(({ item }) => {
          if (!item.selected) return false;
          if (retryOnlyErrors) return item.status === 'error';
          return item.status !== 'completed';
        });

      if (targets.length === 0) {
        toast.info(
          t('batchSearch.searchCompletedToast') ||
            'All selected queries have already completed.',
        );
        setIsSearching(false);
        return;
      }

      let processedCount = 0;

      for (const { item, idx } of targets) {
        // Handle pause condition
        while (isPausedRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }
        }

        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        setCurrentRunningIndex(idx);
        setItems((prev) =>
          prev.map((it, i) =>
            i === idx ? { ...it, status: 'searching', error: undefined } : it,
          ),
        );

        const startTime = Date.now();
        try {
          const result = await executeQuery(
            item,
            abortControllerRef.current.signal,
          );
          const duration = Date.now() - startTime;

          setItems((prev) =>
            prev.map((it, i) =>
              i === idx
                ? {
                    ...it,
                    status: 'completed',
                    response: result.response,
                    sourcesList: result.sourcesList,
                    durationMs: duration,
                  }
                : it,
            ),
          );
          processedCount++;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setItems((prev) =>
              prev.map((it, i) =>
                i === idx ? { ...it, status: 'pending' } : it,
              ),
            );
            break;
          } else {
            setItems((prev) =>
              prev.map((it, i) =>
                i === idx
                  ? {
                      ...it,
                      status: 'error',
                      error: err?.message || 'Search execution failed.',
                    }
                  : it,
              ),
            );
          }
        }
      }

      setCurrentRunningIndex(null);
      setIsSearching(false);

      if (!abortControllerRef.current?.signal.aborted && processedCount > 0) {
        toast.success(
          t('batchSearch.searchCompletedToast') ||
            'Batch search execution completed!',
        );
      }
    },
    [items, defaultModelKey, defaultProviderId, t],
  );

  const pauseBatchSearch = useCallback(() => {
    setIsPaused(true);
    isPausedRef.current = true;
    toast.info(t('batchSearch.searchPausedToast') || 'Paused batch search.');
  }, [t]);

  const resumeBatchSearch = useCallback(() => {
    setIsPaused(false);
    isPausedRef.current = false;
    toast.info(t('batchSearch.resumeSearch') || 'Resumed batch search.');
    if (!isSearching) {
      startBatchSearch(false);
    }
  }, [isSearching, startBatchSearch, t]);

  const stopBatchSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsSearching(false);
    setIsPaused(false);
    setCurrentRunningIndex(null);
    toast.info(t('batchSearch.searchStoppedToast') || 'Stopped batch search.');
  }, [t]);

  // Compiled full document
  const compiledMarkdown = useMemo(() => {
    return compileDocument(items, headerFormat, includeSources);
  }, [items, headerFormat, includeSources]);

  // Metrics
  const totalQueries = items.length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const selectedCount = items.filter((i) => i.selected).length;
  const progressPercent =
    totalQueries > 0 ? Math.round((completedCount / totalQueries) * 100) : 0;

  const currentRunningQuery =
    currentRunningIndex !== null && items[currentRunningIndex]
      ? items[currentRunningIndex].query
      : null;

  return (
    <BatchSearchContext.Provider
      value={{
        items,
        setItems,
        activeTab,
        setActiveTab,
        rawCsvText,
        setRawCsvText,
        isSearching,
        isPaused,
        currentRunningIndex,
        currentRunningQuery,
        isModalOpen,
        openModal,
        closeModal,
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
      }}
    >
      {children}
    </BatchSearchContext.Provider>
  );
};

export const useBatchSearch = () => {
  const context = useContext(BatchSearchContext);
  if (!context) {
    throw new Error('useBatchSearch must be used within a BatchSearchProvider');
  }
  return context;
};
