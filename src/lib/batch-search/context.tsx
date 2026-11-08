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
  startBatchSearch: (
    retryOnlyErrors?: boolean,
    forceRegenerate?: boolean,
    targetIndices?: number[],
  ) => Promise<void>;
  regenerateBatchSearch: (retryOnlyErrors?: boolean, targetIndices?: number[]) => Promise<void>;
  regenerateSingleQuery: (idx: number) => Promise<void>;
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
  handleDeleteSelected: () => void;
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

  // Persistence & Export actions
  saveToScratchpad: (customTitle?: string) => Promise<{ id: string } | null>;
  isSavingToScratchpad: boolean;
  exportAsMarkdown: () => void;
  exportAsCsv: () => void;
  exportAsTxt: () => void;
  copyToClipboard: () => void;
  loadSavedBatchSession: (savedNote: any) => Promise<boolean>;
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

  // Parse CSV with intelligent merge to preserve completed results and only restore missing queries
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

        setItems((prevItems) => {
          if (!prevItems || prevItems.length === 0) {
            toast.success(
              t('batchSearch.parseSuccess', { count: parsed.length }) ||
                `Loaded ${parsed.length} queries successfully.`,
            );
            return parsed;
          }

          // Build fast lookup maps for existing items to preserve results and execution status
          const existingByQuery = new Map<string, BatchQueryItem>();
          const existingByNumber = new Map<string, BatchQueryItem>();

          for (const item of prevItems) {
            const cleanQuery = item.query.trim().toLowerCase();
            if (cleanQuery) {
              existingByQuery.set(cleanQuery, item);
            }
            if (item.number) {
              existingByNumber.set(item.number.trim(), item);
            }
          }

          let addedCount = 0;
          let preservedCount = 0;

          const mergedList: BatchQueryItem[] = [];

          for (const incoming of parsed) {
            const cleanQuery = incoming.query.trim().toLowerCase();
            const cleanNum = incoming.number.trim();

            const existing =
              existingByQuery.get(cleanQuery) ||
              (cleanNum ? existingByNumber.get(cleanNum) : undefined);

            if (existing) {
              // Existing item found: keep its execution results and status, do not search again
              mergedList.push({
                ...existing,
                number: incoming.number || existing.number,
                query: existing.query || incoming.query,
              });
              preservedCount++;
            } else {
              // Missing or newly added item: append as pending
              mergedList.push(incoming);
              addedCount++;
            }
          }

          if (addedCount > 0) {
            toast.success(
              t('batchSearch.mergedMissingToast', {
                added: addedCount,
                preserved: preservedCount,
              }) ||
                `Zaimportowano: dodano ${addedCount} brakujących pytań, zachowano ${preservedCount} wykonanych wyników.`,
            );
          } else {
            toast.info(
              t('batchSearch.allQueriesAlreadyPresentToast') ||
                `Wszystkie pytania (${preservedCount}) są już w kolejce. Zachowano dotychczasowe wyniki.`,
            );
          }

          return mergedList;
        });

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

  const handleDeleteSelected = useCallback(() => {
    setItems((prev) => {
      const remaining = prev.filter((item) => !item.selected);
      const removedCount = prev.length - remaining.length;
      if (removedCount > 0) {
        toast.info(
          t('batchSearch.deletedSelected', { count: removedCount }) ||
            `Deleted ${removedCount} selected queries.`,
        );
      }
      return remaining;
    });
  }, [t]);

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
    setActiveTab('upload');
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

  // Helper to determine if a query item uses a local LLM or cloud API
  const isItemLocalModel = useCallback(
    (item: BatchQueryItem): boolean => {
      const providerId = item.providerId || defaultProviderId;
      if (!providerId) return false;
      const target = providerId.toLowerCase();
      const matched = providers.find(
        (p) =>
          p.id === providerId ||
          (p.type && p.type.toLowerCase() === target) ||
          (p.name && p.name.toLowerCase() === target),
      );
      if (!matched) {
        return (
          target === 'ollama' ||
          target === 'lmstudio' ||
          target === 'lemonade' ||
          target === 'local'
        );
      }
      const provType = (matched.type || '').toLowerCase();
      return (
        provType === 'ollama' ||
        provType === 'lmstudio' ||
        provType === 'lemonade' ||
        provType === 'local'
      );
    },
    [defaultProviderId, providers],
  );

  // Batch orchestrator
  const startBatchSearch = useCallback(
    async (
      retryOnlyErrors = false,
      forceRegenerate = false,
      targetIndices?: number[],
    ) => {
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
        .filter(({ item, idx }) => {
          if (targetIndices && targetIndices.length > 0) {
            return targetIndices.includes(idx);
          }
          if (!item.selected) return false;
          if (retryOnlyErrors) return item.status === 'error';
          if (forceRegenerate) return true;
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
      let localRunning = false;
      const queue = [...targets];

      // If at least one target uses an external API, allow concurrent workers (e.g. 3 at a time)
      // For local models, localRunning semaphore ensures strictly 1 local query at a time to protect VRAM
      const isAnyApi = targets.some(({ item }) => !isItemLocalModel(item));
      const concurrency = isAnyApi ? Math.min(3, targets.length) : 1;

      const runWorker = async () => {
        while (queue.length > 0) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

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

          // Pick the next available item from the queue
          let pickIndex = -1;
          for (let i = 0; i < queue.length; i++) {
            const isLocal = isItemLocalModel(queue[i].item);
            if (isLocal) {
              if (!localRunning) {
                pickIndex = i;
                break;
              }
            } else {
              pickIndex = i;
              break;
            }
          }

          if (pickIndex === -1) {
            // All remaining items are local and a local query is already executing. Wait briefly and retry.
            await new Promise((resolve) => setTimeout(resolve, 200));
            continue;
          }

          const [{ item, idx }] = queue.splice(pickIndex, 1);
          const isLocal = isItemLocalModel(item);
          if (isLocal) {
            localRunning = true;
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
              abortControllerRef.current!.signal,
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
          } finally {
            if (isLocal) {
              localRunning = false;
            }
          }
        }
      };

      const workers = Array.from({ length: concurrency }, () => runWorker());
      await Promise.all(workers);

      setCurrentRunningIndex(null);
      setIsSearching(false);

      if (!abortControllerRef.current?.signal.aborted && processedCount > 0) {
        toast.success(
          t('batchSearch.searchCompletedToast') ||
            'Batch search execution completed!',
        );
      }
    },
    [items, defaultModelKey, defaultProviderId, isItemLocalModel, t],
  );

  const regenerateBatchSearch = useCallback(
    async (retryOnlyErrors = false, targetIndices?: number[]) => {
      setItems((prev) =>
        prev.map((it, idx) => {
          const isTarget = targetIndices ? targetIndices.includes(idx) : it.selected;
          if (isTarget) {
            return {
              ...it,
              status: 'pending',
              response: undefined,
              error: undefined,
              sourcesList: undefined,
              durationMs: undefined,
            };
          }
          return it;
        }),
      );
      return startBatchSearch(retryOnlyErrors, true, targetIndices);
    },
    [startBatchSearch],
  );

  const regenerateSingleQuery = useCallback(
    async (idx: number) => {
      if (idx < 0 || idx >= items.length) return;
      return regenerateBatchSearch(false, [idx]);
    },
    [items.length, regenerateBatchSearch],
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

  // Scratchpad saving state & handlers
  const [isSavingToScratchpad, setIsSavingToScratchpad] = useState(false);

  const saveToScratchpad = useCallback(
    async (customTitle?: string): Promise<{ id: string } | null> => {
      if (completedCount === 0 && items.length === 0) {
        toast.error(t('batchSearch.noResultsYet') || 'No results to save.');
        return null;
      }

      setIsSavingToScratchpad(true);
      try {
        const aggregatedSources: any[] = [];
        const seenUrls = new Set<string>();

        items.forEach((item, itemIdx) => {
          const itemSources = Array.isArray(item.sourcesList) ? item.sourcesList : [];
          itemSources.forEach((src: any) => {
            const url = src?.metadata?.url || src?.url || '';
            const title = src?.metadata?.title || src?.title || `Query ${item.number}`;
            const dedupKey = url
              ? url.toLowerCase().trim()
              : `${title.toLowerCase().trim()}-${itemIdx}`;
            if (!seenUrls.has(dedupKey)) {
              seenUrls.add(dedupKey);
              aggregatedSources.push({
                pageContent:
                  src?.pageContent ||
                  src?.snippet ||
                  src?.metadata?.snippet ||
                  src?.content ||
                  '',
                metadata: {
                  title,
                  url,
                  queryNumber: item.number,
                  queryText: item.query,
                  ...(src?.metadata || {}),
                },
              });
            }
          });
        });

        const firstCompleted = items.find((i) => i.status === 'completed') || items[0];
        const defaultTitle = firstCompleted?.query
          ? `Batch Research: ${firstCompleted.query}${items.length > 1 ? ` (+${items.length - 1})` : ''}`
          : `Batch Research (${items.length} items)`;

        const titleToSave = (customTitle && customTitle.trim()) || defaultTitle;

        const res = await fetch('/api/scratchpad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleToSave,
            content: compiledMarkdown,
            type: 'batch',
            sources: aggregatedSources,
            metadata: {
              isBatchExport: true,
              batchCount: items.length,
              completedCount,
              sourcesCount: aggregatedSources.length,
              generatedAt: new Date().toISOString(),
              items: items.map((it) => ({
                id: it.id,
                number: it.number,
                query: it.query,
                status: it.status,
                response: it.response,
                sources: it.sources,
                optimizationMode: it.optimizationMode,
                modelKey: it.modelKey,
                providerId: it.providerId,
                sourcesList: it.sourcesList,
              })),
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          toast.success(
            t('batchSearch.savedToScratchpadSuccess') || 'Saved note to Scratchpad!',
          );
          return data?.scratchpad || { id: data?.id };
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.message || 'Failed to save note to Scratchpad.');
          return null;
        }
      } catch (err: any) {
        toast.error(err?.message || 'Error saving to Scratchpad.');
        return null;
      } finally {
        setIsSavingToScratchpad(false);
      }
    },
    [items, completedCount, compiledMarkdown, t],
  );

  const exportAsMarkdown = useCallback(() => {
    if (!compiledMarkdown) {
      toast.error(t('batchSearch.noResultsYet') || 'No results to export.');
      return;
    }
    const blob = new Blob([compiledMarkdown], {
      type: 'text/markdown;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-research-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [compiledMarkdown, t]);

  const exportAsTxt = useCallback(() => {
    if (!compiledMarkdown) {
      toast.error(t('batchSearch.noResultsYet') || 'No results to export.');
      return;
    }
    const blob = new Blob([compiledMarkdown], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-research-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [compiledMarkdown, t]);

  const exportAsCsv = useCallback(() => {
    const csvContent = exportToCsv(items);
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-research-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items]);

  const copyToClipboard = useCallback(() => {
    if (!compiledMarkdown) {
      toast.error(t('batchSearch.noResultsYet') || 'No results to copy.');
      return;
    }
    navigator.clipboard.writeText(compiledMarkdown);
    toast.success(t('common.copied') || 'Copied to clipboard!');
  }, [compiledMarkdown, t]);

  const loadSavedBatchSession = useCallback(
    async (savedNote: any): Promise<boolean> => {
      let fullNote = savedNote;

      // If content is missing or metadata items are absent, fetch full note if ID exists
      const meta =
        typeof fullNote.metadata === 'string'
          ? (() => {
              try {
                return JSON.parse(fullNote.metadata || '{}');
              } catch {
                return {};
              }
            })()
          : fullNote.metadata || {};

      const hasMetaItems = Array.isArray(meta.items) && meta.items.length > 0;
      const hasContent =
        typeof fullNote.content === 'string' && fullNote.content.trim().length > 0;

      if (!hasMetaItems && !hasContent && fullNote.id) {
        try {
          const res = await fetch(`/api/scratchpad/${fullNote.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.scratchpad) {
              fullNote = data.scratchpad;
            }
          }
        } catch (fetchErr) {
          console.error('Failed to fetch full scratchpad details:', fetchErr);
        }
      }

      let noteItems: BatchQueryItem[] = [];
      try {
        const fullMeta =
          typeof fullNote.metadata === 'string'
            ? JSON.parse(fullNote.metadata || '{}')
            : fullNote.metadata || {};
        if (Array.isArray(fullMeta.items) && fullMeta.items.length > 0) {
          noteItems = fullMeta.items;
        }
      } catch {}

      // Fallback: parse sections from markdown content if raw items not present
      if (noteItems.length === 0 && fullNote.content) {
        const contentStr = fullNote.content as string;
        // Split by top-level item headers like '# Title [1]' or '# [1] Title' or '# 1. Title'
        const sectionRegex = /(?:^|\n)(?:---\s*\n+)?(?=#\s+(?:\[\d+\]|.*?\[\d+\]|\d+\.))/;
        const rawSections = contentStr
          .split(sectionRegex)
          .map((s) => s.trim())
          .filter(Boolean);

        noteItems = [];
        let autoIdx = 1;

        for (let i = 0; i < rawSections.length; i++) {
          const sec = rawSections[i];
          const headerMatch = sec.match(/^#\s+([^\n]+)(?:\n+([\s\S]*))?$/);
          if (!headerMatch) continue;

          const rawHeader = headerMatch[1].trim();
          let rawBody = (headerMatch[2] || '').trim();

          let itemNumber = String(autoIdx++);
          let query = rawHeader;

          const bracketStartMatch = rawHeader.match(/^\[(\d+)\]\s+(.*)$/);
          const bracketEndMatch = rawHeader.match(/^(.*?)\s+\[(\d+)\]$/);
          const dotMatch = rawHeader.match(/^(\d+)\.\s+(.*)$/);

          if (bracketStartMatch) {
            itemNumber = bracketStartMatch[1];
            query = bracketStartMatch[2];
          } else if (bracketEndMatch) {
            query = bracketEndMatch[1];
            itemNumber = bracketEndMatch[2];
          } else if (dotMatch) {
            itemNumber = dotMatch[1];
            query = dotMatch[2];
          }

          // Strip references section if present, and parse sourcesList
          const referencesMatch = rawBody.match(
            /\n\n### References & Sources:\n([\s\S]*)$/i,
          );
          const sourcesList: Array<{ title: string; url: string }> = [];

          if (referencesMatch) {
            const refsText = referencesMatch[1];
            rawBody = rawBody.substring(0, referencesMatch.index).trim();
            const linkRegex = /-\s+\[(.*?)\]\((.*?)\)/g;
            let linkMatch;
            while ((linkMatch = linkRegex.exec(refsText)) !== null) {
              sourcesList.push({
                title: linkMatch[1],
                url: linkMatch[2],
              });
            }
          }

          noteItems.push({
            id: `loaded-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
            number: itemNumber,
            query: query.trim(),
            status: 'completed' as const,
            response: rawBody,
            sources: ['web'],
            sourcesList: sourcesList.length > 0 ? sourcesList : undefined,
            optimizationMode: 'balanced' as const,
            selected: true,
          });
        }
      }

      if (noteItems.length > 0) {
        setItems(noteItems);
        setActiveTab('results');
        openModal();
        toast.success(
          t('library.loadedIntoStudio') ||
            'Załadowano badanie wsadowe do Studia!',
        );
        return true;
      } else {
        toast.error(
          t('batchSearch.noResultsYet') ||
            'Nie znaleziono pytań w wybranym dokumencie.',
        );
        return false;
      }
    },
    [openModal, t],
  );

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
        regenerateBatchSearch,
        regenerateSingleQuery,
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
        handleDeleteSelected,
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
        saveToScratchpad,
        isSavingToScratchpad,
        exportAsMarkdown,
        exportAsCsv,
        exportAsTxt,
        copyToClipboard,
        loadSavedBatchSession,
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
