'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  Clock,
  Cpu,
  Zap,
  Activity,
  Download,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Users,
  Terminal,
  ShieldAlert,
  Globe,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogPanel } from '@headlessui/react';
import { useTranslation } from '@/lib/i18n';

interface StatsKPI {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalRequests: number;
  avgDurationMs: number;
  avgTtftMs: number;
  avgTokensPerSecond: number;
  avgTokensPerRequest: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  activeModelsCount: number;
  topModel: string;
  topProvider: string;
  topProviderName?: string;
}

interface TimeSeriesPoint {
  timestamp: string;
  label: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requests: number;
  avgDurationMs: number;
}

interface ModelBreakdownItem {
  modelKey: string;
  providerId: string;
  providerName?: string;
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  avgDurationMs: number;
  errorRate: number;
  percentage: number;
}

interface ProviderBreakdownItem {
  providerId: string;
  providerName?: string;
  requests: number;
  totalTokens: number;
  percentage: number;
}

interface StepBreakdownItem {
  step: string;
  requests: number;
  totalTokens: number;
  avgDurationMs: number;
  percentage: number;
}

interface ModeBreakdownItem {
  mode: string;
  requests: number;
  totalTokens: number;
  percentage: number;
}

interface UserBreakdownItem {
  userId: string;
  username: string;
  displayName?: string | null;
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  avgDurationMs: number;
  percentage: number;
}

interface ApiKeyBreakdownItem {
  apiKeyId: string;
  name: string;
  keyPrefix: string;
  username: string;
  requests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  avgDurationMs: number;
  lastUsedAt?: string | null;
  percentage: number;
}

interface SourceBreakdownItem {
  source: string;
  requests: number;
  totalTokens: number;
  percentage: number;
  tokenPercentage: number;
}

interface RequestLogItem {
  id: number;
  chatId: string | null;
  messageId: string | null;
  providerId: string;
  providerName?: string;
  modelKey: string;
  query: string | null;
  step: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  timeToFirstTokenMs: number | null;
  tokensPerSecond: number | null;
  optimizationMode: string | null;
  status: 'success' | 'error';
  errorMessage: string | null;
  createdAt: string;
  keyName?: string | null;
  keyPrefix?: string | null;
  username?: string | null;
  effectiveSource?: string | null;
}

interface ScraperDomainItem {
  domain: string;
  total: number;
  success: number;
  errors: number;
  avgDurationMs: number;
  errorRate: number;
  errorReasons: Record<string, number>;
}

interface ScraperStats {
  totalScrapes: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  topFailedDomains: ScraperDomainItem[];
  allDomains: ScraperDomainItem[];
}

interface StatsData {
  kpi: StatsKPI;
  timeSeries: TimeSeriesPoint[];
  modelBreakdown: ModelBreakdownItem[];
  providerBreakdown: ProviderBreakdownItem[];
  stepBreakdown: StepBreakdownItem[];
  modeBreakdown: ModeBreakdownItem[];
  userBreakdown?: UserBreakdownItem[];
  apiKeyBreakdown?: ApiKeyBreakdownItem[];
  sourceBreakdown?: SourceBreakdownItem[];
  scraperStats?: ScraperStats;
  recentLogs: RequestLogItem[];
  availableModels: string[];
  availableProviders: string[];
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'k';
  }
  return num.toLocaleString();
};

const formatLatency = (ms: number): string => {
  if (ms >= 1000) {
    return (ms / 1000).toFixed(2) + 's';
  }
  return ms + 'ms';
};

const getPaginationPageNumbers = (current: number, total: number): (number | string)[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
};

const Page = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ui' | 'api'>('all');
  const [selectedModelFilter, setSelectedModelFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<RequestLogItem | null>(null);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [hoveredDataPoint, setHoveredDataPoint] = useState<TimeSeriesPoint | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const fetchStats = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({ timeframe });
      if (selectedModelFilter !== 'all') {
        params.append('model', selectedModelFilter);
      }
      if (sourceFilter !== 'all') {
        params.append('source', sourceFilter);
      }

      const res = await fetch(`/api/statistics?${params.toString()}`);
      if (res.status === 401 || res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        setAuthError(
          errData.message ||
            t('auth.statsAdminRequired') ||
            'Access to statistics requires administrator privileges.',
        );
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch statistics');
      const json = await res.json();
      setData(json);
      setAuthError(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load model statistics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [timeframe, sourceFilter, selectedModelFilter]);

  const handleClearStats = async () => {
    try {
      const res = await fetch('/api/statistics', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear');
      toast.success('Model statistics cleared successfully');
      setIsClearDialogOpen(false);
      await fetchStats();
    } catch (err) {
      toast.error('Failed to clear model statistics');
    }
  };

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vane-statistics-${sourceFilter}-${timeframe}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported statistics report to JSON');
  };

  const filteredLogs = useMemo(() => {
    if (!data?.recentLogs) return [];
    return data.recentLogs.filter((log) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const queryMatch = log.query?.toLowerCase().includes(q);
        const modelMatch = log.modelKey.toLowerCase().includes(q);
        const stepMatch = log.step.toLowerCase().includes(q);
        const keyMatch = log.keyName?.toLowerCase().includes(q) || log.keyPrefix?.toLowerCase().includes(q);
        const userMatch = log.username?.toLowerCase().includes(q);
        if (!queryMatch && !modelMatch && !stepMatch && !keyMatch && !userMatch) return false;
      }
      return true;
    });
  }, [data?.recentLogs, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedModelFilter, sourceFilter, timeframe, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safeCurrentPage, pageSize]);

  const startItem = filteredLogs.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, filteredLogs.length);

  const maxTimelineTokens = useMemo(() => {
    if (!data?.timeSeries || data.timeSeries.length === 0) return 100;
    return Math.max(...data.timeSeries.map((t) => t.totalTokens), 100);
  }, [data?.timeSeries]);

  const maxModelTokens = useMemo(() => {
    if (!data?.modelBreakdown || data.modelBreakdown.length === 0) return 100;
    return Math.max(...data.modelBreakdown.map((m) => m.totalTokens), 1);
  }, [data?.modelBreakdown]);

  const maxUserTokens = useMemo(() => {
    if (!data?.userBreakdown || data.userBreakdown.length === 0) return 100;
    return Math.max(...data.userBreakdown.map((u) => u.totalTokens), 1);
  }, [data?.userBreakdown]);

  const maxApiKeyTokens = useMemo(() => {
    if (!data?.apiKeyBreakdown || data.apiKeyBreakdown.length === 0) return 100;
    return Math.max(...data.apiKeyBreakdown.map((k) => k.totalTokens), 1);
  }, [data?.apiKeyBreakdown]);

  const maxLatency = useMemo(() => {
    if (!data?.modelBreakdown || data.modelBreakdown.length === 0) return 1000;
    return Math.max(...data.modelBreakdown.map((m) => m.avgDurationMs), 1000);
  }, [data?.modelBreakdown]);

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-4 shadow-lg shadow-amber-500/5">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-xl font-semibold text-black dark:text-stone-100 mb-2">
          {t('auth.accessRestricted') || 'Access Restricted'}
        </h2>
        <p className="text-sm text-black/60 dark:text-stone-400 max-w-md mb-6">
          {authError}
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-light-200 dark:bg-[#1a1612] hover:bg-light-300 dark:hover:bg-[#252019] text-xs font-medium text-black dark:text-stone-200 transition border border-light-300 dark:border-[#382d20]"
        >
          {t('navigation.home') || 'Return to Home'}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 pt-8 px-2 md:px-4">
      {/* Header section */}
      <div className="flex flex-col border-b border-light-200/20 dark:border-dark-200/20 pb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[#b8864d]/10 text-[#b8864d] dark:bg-[#b8864d]/20">
              <BarChart3 size={36} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-black dark:text-stone-100">
                {t('statistics.title')}
              </h1>
              <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mt-1 font-normal">
                {t('statistics.subtitle')}
              </p>
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Source filter selector (All / UI / API) */}
            <div className="flex items-center p-1 rounded-xl bg-light-200 dark:bg-dark-200 text-xs">
              <button
                onClick={() => setSourceFilter('all')}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg transition font-medium',
                  sourceFilter === 'all'
                    ? 'bg-light-primary dark:bg-dark-primary text-black dark:text-white shadow-sm'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white',
                )}
              >
                {t('statistics.sourceAll') || 'All Sources'}
              </button>
              <button
                onClick={() => setSourceFilter('ui')}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5',
                  sourceFilter === 'ui'
                    ? 'bg-light-primary dark:bg-dark-primary text-black dark:text-white shadow-sm'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white',
                )}
              >
                <Globe size={13} />
                <span>{t('statistics.sourceUi') || 'Web UI'}</span>
              </button>
              <button
                onClick={() => setSourceFilter('api')}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5',
                  sourceFilter === 'api'
                    ? 'bg-[#b8864d] text-white shadow-sm'
                    : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white',
                )}
              >
                <KeyRound size={13} />
                <span>{t('statistics.sourceApi') || 'Klucze API'}</span>
              </button>
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center p-1 rounded-xl bg-light-200 dark:bg-dark-200 text-xs">
              {(
                [
                  { key: '24h', label: t('statistics.timeframe24h') },
                  { key: '7d', label: t('statistics.timeframe7d') },
                  { key: '30d', label: t('statistics.timeframe30d') },
                  { key: 'all', label: t('statistics.timeframeAll') },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTimeframe(item.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg transition font-medium',
                    timeframe === item.key
                      ? 'bg-light-primary dark:bg-dark-primary text-black dark:text-white shadow-sm'
                      : 'text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Refresh button */}
            <button
              onClick={() => fetchStats(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary hover:opacity-80 transition text-black/70 dark:text-white/70"
              title="Refresh data"
            >
              <RefreshCw size={17} className={cn(isRefreshing && 'animate-spin')} />
            </button>

            {/* Export JSON button */}
            <button
              onClick={handleExportJson}
              disabled={!data}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary hover:opacity-80 transition text-xs font-medium text-black/70 dark:text-white/70"
            >
              <Download size={14} />
              <span>{t('statistics.exportJson')}</span>
            </button>

            {/* Clear logs button */}
            <button
              onClick={() => setIsClearDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition text-xs font-medium"
            >
              <Trash2 size={14} />
              <span>{t('statistics.clearStats')}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-row items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#b8864d] animate-spin" />
            <p className="text-sm text-black/60 dark:text-white/60">
              {t('common.loading')}
            </p>
          </div>
        </div>
      ) : !data || data.kpi.totalRequests === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-3xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary mb-3">
            <BarChart3 className="text-black/50 dark:text-white/50" size={32} />
          </div>
          <h3 className="text-lg font-medium">{t('statistics.noTelemetryData')}</h3>
          <p className="text-sm text-black/60 dark:text-white/60 max-w-md mt-1">
            {t('statistics.noTelemetryDesc')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-6">
          {/* Top KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Tokens */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-black/60 dark:text-white/60">
                  {t('statistics.totalTokens')}
                </span>
                <div className="p-1.5 rounded-lg bg-[#b8864d]/15 text-[#b8864d]">
                  <Zap size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">
                  {formatNumber(data.kpi.totalTokens)}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  tokens
                </span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 w-full bg-light-200 dark:bg-dark-200 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${data.kpi.totalTokens > 0 ? (data.kpi.totalPromptTokens / data.kpi.totalTokens) * 100 : 50}%`,
                    }}
                    className="bg-blue-500"
                    title={`Prompt: ${formatNumber(data.kpi.totalPromptTokens)}`}
                  />
                  <div
                    style={{
                      width: `${data.kpi.totalTokens > 0 ? (data.kpi.totalCompletionTokens / data.kpi.totalTokens) * 100 : 50}%`,
                    }}
                    className="bg-emerald-500"
                    title={`Completion: ${formatNumber(data.kpi.totalCompletionTokens)}`}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-black/60 dark:text-white/60 mt-1.5">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    Prompt: {formatNumber(data.kpi.totalPromptTokens)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Output: {formatNumber(data.kpi.totalCompletionTokens)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Avg Response Time */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-black/60 dark:text-white/60">
                  {t('statistics.avgResponseTime')}
                </span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Clock size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">
                  {formatLatency(data.kpi.avgDurationMs)}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-black/60 dark:text-white/60 border-t border-light-200/50 dark:border-dark-200/50 pt-2">
                <span>{t('statistics.avgTtft')}: <strong>{formatLatency(data.kpi.avgTtftMs)}</strong></span>
                <span>{t('statistics.speed')}: <strong>{data.kpi.avgTokensPerSecond} {t('statistics.tokensPerSec')}</strong></span>
              </div>
            </div>

            {/* Card 3: Invocations & Success Rate */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-black/60 dark:text-white/60">
                  {t('statistics.modelInvocations')}
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Activity size={16} />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">
                  {data.kpi.totalRequests}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {t('statistics.queries')}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-black/60 dark:text-white/60 border-t border-light-200/50 dark:border-dark-200/50 pt-2">
                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                  <CheckCircle2 size={13} />
                  {data.kpi.successRate}% {t('statistics.successRate')}
                </span>
                <span>{t('statistics.errors')}: {data.kpi.errorCount}</span>
              </div>
            </div>

            {/* Card 4: Top Model */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-black/60 dark:text-white/60">
                  {t('statistics.primaryModel')}
                </span>
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                  <Cpu size={16} />
                </div>
              </div>
              <div className="mt-2 flex flex-col">
                <span className="text-xl font-semibold tracking-tight truncate" title={data.kpi.topModel}>
                  {data.kpi.topModel}
                </span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {t('statistics.providers')}: {data.kpi.topProviderName || data.kpi.topProvider}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-black/60 dark:text-white/60 border-t border-light-200/50 dark:border-dark-200/50 pt-2">
                <span>{t('statistics.activeModels')}: <strong>{data.kpi.activeModelsCount}</strong></span>
                <span>{t('statistics.speedTokSec', { speed: data.kpi.avgTokensPerRequest })}</span>
              </div>
            </div>
          </div>

          {/* Timeline Chart Card */}
          <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold">{t('statistics.tokenConsumptionOverTime')}</h3>
                <p className="text-xs text-black/60 dark:text-white/60">
                  {t('statistics.tokenConsumptionDesc', { interval: timeframe === '24h' ? t('common.hour') : t('common.day') })}
                </p>
              </div>

              {hoveredDataPoint && (
                <div className="flex items-center gap-3 text-xs bg-light-primary dark:bg-dark-primary px-3 py-1.5 rounded-xl border border-light-200 dark:border-dark-200">
                  <span className="font-medium">{hoveredDataPoint.label}:</span>
                  <span className="text-[#b8864d] font-semibold">{formatNumber(hoveredDataPoint.totalTokens)} tokens</span>
                  <span className="text-black/60 dark:text-white/60">({hoveredDataPoint.requests} {t('statistics.queries')})</span>
                  <span className="text-amber-500">{formatLatency(hoveredDataPoint.avgDurationMs)}</span>
                </div>
              )}
            </div>

            <div className="h-44 w-full flex items-end gap-1 sm:gap-2 pt-6 pb-2">
              {data.timeSeries.map((point, index) => {
                const heightPercent = Math.max(8, (point.totalTokens / maxTimelineTokens) * 100);
                const promptPercent = point.totalTokens > 0 ? (point.promptTokens / point.totalTokens) * 100 : 50;

                return (
                  <div
                    key={index}
                    onMouseEnter={() => setHoveredDataPoint(point)}
                    onMouseLeave={() => setHoveredDataPoint(null)}
                    className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                  >
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[32px] rounded-t-md bg-light-200 dark:bg-dark-200 group-hover:opacity-90 overflow-hidden flex flex-col justify-end transition-all"
                    >
                      <div
                        style={{ height: `${100 - promptPercent}%` }}
                        className="w-full bg-emerald-500/80 group-hover:bg-emerald-500"
                      />
                      <div
                        style={{ height: `${promptPercent}%` }}
                        className="w-full bg-blue-500/80 group-hover:bg-blue-500"
                      />
                    </div>
                    <span className="text-[10px] text-black/50 dark:text-white/50 mt-1 truncate w-full text-center group-hover:text-[#b8864d]">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 mt-2 pt-3 border-t border-light-200/50 dark:border-dark-200/50 text-xs text-black/60 dark:text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                {t('statistics.inputTokensPrompt')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                {t('statistics.outputTokensCompletion')}
              </span>
            </div>
          </div>

          {/* User Breakdown & API Key Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* User Usage Breakdown */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                      <Users size={16} />
                    </div>
                    <h3 className="text-base font-semibold">
                      {t('statistics.usageByUser') || 'Usage by User'}
                    </h3>
                  </div>
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {data.userBreakdown?.length || 0} {t('accessControl.tabUsers') || 'Users'}
                  </span>
                </div>

                <div className="flex flex-col gap-3 mt-3">
                  {(data.userBreakdown || []).slice(0, 8).map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-black dark:text-white">
                            {item.displayName || item.username}
                          </span>
                          {item.displayName && item.username !== item.displayName && (
                            <span className="text-[10px] text-black/50 dark:text-white/50">
                              (@{item.username})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-black/60 dark:text-white/60">
                            {item.requests} {t('statistics.queries')}
                          </span>
                          <span className="font-semibold text-blue-500">
                            {formatNumber(item.totalTokens)} ({item.percentage}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-light-200 dark:bg-dark-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${(item.totalTokens / maxUserTokens) * 100}%` }}
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                  {(!data.userBreakdown || data.userBreakdown.length === 0) && (
                    <p className="text-xs text-black/50 dark:text-white/50 py-4 text-center">
                      {t('statistics.noUserData') || 'No user data available'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* API Key Usage Breakdown */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#b8864d]/15 text-[#b8864d]">
                      <KeyRound size={16} />
                    </div>
                    <h3 className="text-base font-semibold">
                      {t('statistics.usageByApiKey') || 'Usage by API Key'}
                    </h3>
                  </div>
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {data.apiKeyBreakdown?.length || 0} {t('apiAccess.tabKeys') || 'Keys'}
                  </span>
                </div>

                <div className="flex flex-col gap-3 mt-3">
                  {(data.apiKeyBreakdown || []).slice(0, 8).map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-black dark:text-white">
                            {item.name}
                          </span>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-light-200 dark:bg-[#1a1612] text-[#b8864d] border border-light-300 dark:border-[#382d20]">
                            {item.keyPrefix}...
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-black/60 dark:text-white/60">
                            {item.requests} {t('statistics.queries')}
                          </span>
                          <span className="font-semibold text-[#b8864d]">
                            {formatNumber(item.totalTokens)} ({item.percentage}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-light-200 dark:bg-dark-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${(item.totalTokens / maxApiKeyTokens) * 100}%` }}
                          className="h-full bg-gradient-to-r from-[#b8864d] to-amber-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                  {(!data.apiKeyBreakdown || data.apiKeyBreakdown.length === 0) && (
                    <p className="text-xs text-black/50 dark:text-white/50 py-4 text-center">
                      {t('statistics.noApiUsageYet') || 'No API key requests recorded in the selected period.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Model Breakdown & Latency Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Model Usage & Share */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold">{t('statistics.modelUsageDistribution')}</h3>
                  <span className="text-xs text-black/50 dark:text-white/50">
                    {data.modelBreakdown.length} {t('statistics.model')}
                  </span>
                </div>
                <div className="flex flex-col gap-3.5 mt-2">
                  {data.modelBreakdown.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Cpu size={14} className="text-purple-400" />
                          <span className="font-medium text-black dark:text-white">
                            {item.modelKey}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-light-200 dark:bg-dark-200 text-black/60 dark:text-white/60">
                            {item.providerName || item.providerId}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-black/60 dark:text-white/60">
                            {item.requests} {t('statistics.queries')}
                          </span>
                          <span className="font-semibold text-[#b8864d]">
                            {formatNumber(item.totalTokens)} ({item.percentage}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-light-200 dark:bg-dark-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${(item.totalTokens / maxModelTokens) * 100}%` }}
                          className="h-full bg-gradient-to-r from-purple-500 to-[#b8864d] rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-light-200/50 dark:border-dark-200/50 flex flex-wrap items-center gap-3 text-xs text-black/60 dark:text-white/60">
                <span className="font-medium">{t('statistics.providers')}:</span>
                {data.providerBreakdown.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="font-semibold text-black dark:text-white">{p.providerName || p.providerId}</span>
                    <span>({p.percentage}%)</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Latency Comparison by Model */}
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">{t('statistics.averageModelLatency')}</h3>
                <span className="text-xs text-black/50 dark:text-white/50">{t('statistics.duration')}</span>
              </div>
              <div className="flex flex-col gap-4 mt-2">
                {data.modelBreakdown.map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-black dark:text-white">
                        {item.modelKey}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-amber-500">
                          {formatLatency(item.avgDurationMs)}
                        </span>
                        {item.errorRate > 0 && (
                          <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                            {item.errorRate}% err
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 w-full bg-light-200 dark:bg-dark-200 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(10, (item.avgDurationMs / maxLatency) * 100))}%`,
                        }}
                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Pipeline Steps Breakdown */}
              <div className="mt-6 pt-4 border-t border-light-200/50 dark:border-dark-200/50">
                <h4 className="text-xs font-semibold uppercase text-black/60 dark:text-white/60 mb-2">
                  {t('statistics.pipelineSteps')}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {data.stepBreakdown.map((step, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="font-medium capitalize text-black dark:text-white">{step.step}</span>
                      <div className="flex justify-between text-[11px] text-black/50 dark:text-white/50 mt-1">
                        <span>{step.requests} {t('statistics.queries')}</span>
                        <span>{formatLatency(step.avgDurationMs)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Web Scraper & Extraction Resilience Telemetry */}
          {data.scraperStats && data.scraperStats.totalScrapes > 0 && (
            <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Globe size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">
                      {t('statistics.scraperTelemetryTitle') || 'Web Scraper & Extraction Health'}
                    </h3>
                    <p className="text-xs text-black/60 dark:text-white/60">
                      {t('statistics.scraperTelemetryDesc') || 'Domain-level extraction success rates, latency, and failure diagnostic breakdown'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200">
                    {t('statistics.totalScrapes') || 'Total Scrapes'}: <strong>{data.scraperStats.totalScrapes}</strong>
                  </span>
                  <span
                    className={cn(
                      'px-2.5 py-1 rounded-lg font-medium border',
                      data.scraperStats.successRate >= 85
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                    )}
                  >
                    {data.scraperStats.successRate}% {t('statistics.successRate') || 'Success'} ({data.scraperStats.errorCount} {t('statistics.errors') || 'errors'})
                  </span>
                </div>
              </div>

              {/* Scraped Domains Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.scraperStats.allDomains.slice(0, 6).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-black dark:text-white truncate max-w-[180px]" title={item.domain}>
                        {item.domain}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          item.errors === 0
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-red-500/10 text-red-500',
                        )}
                      >
                        {item.errors === 0 ? '100% OK' : `${item.errorRate}% ERR`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-black/60 dark:text-white/60">
                      <span>
                        {item.total} {item.total === 1 ? 'req' : 'reqs'} ({item.success} ok / {item.errors} err)
                      </span>
                      <span>{formatLatency(item.avgDurationMs)}</span>
                    </div>

                    {item.errors > 0 && Object.keys(item.errorReasons).length > 0 && (
                      <div className="text-[10px] text-red-500/90 truncate border-t border-light-200/40 dark:border-dark-200/40 pt-1">
                        {Object.entries(item.errorReasons)[0][0]}: {Object.entries(item.errorReasons)[0][1]}x
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Request Audit Log Table */}
          <div className="p-5 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold">{t('statistics.auditLog')}</h3>
                <p className="text-xs text-black/60 dark:text-white/60">
                  {t('statistics.auditLogDesc')}
                </p>
              </div>

              {/* Search & Model filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('statistics.searchLogPlaceholder')}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#b8864d] w-48 sm:w-64"
                  />
                </div>
                {data.availableModels.length > 1 && (
                  <select
                    value={selectedModelFilter}
                    onChange={(e) => setSelectedModelFilter(e.target.value)}
                    className="text-xs py-1.5 px-2.5 rounded-xl border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-black dark:text-white focus:outline-none"
                  >
                    <option value="all">{t('statistics.allModels')}</option>
                    {data.availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-light-200/50 dark:border-dark-200/50 text-black/50 dark:text-white/50">
                    <th className="py-2.5 px-3 font-medium">{t('statistics.time')}</th>
                    <th className="py-2.5 px-3 font-medium">{t('statistics.source') || 'Source'}</th>
                    <th className="py-2.5 px-3 font-medium">{t('statistics.queryStep')}</th>
                    <th className="py-2.5 px-3 font-medium">{t('statistics.model')}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{t('statistics.promptOutput')}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{t('statistics.total')}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{t('statistics.duration')}</th>
                    <th className="py-2.5 px-3 font-medium text-right">{t('statistics.speed')}</th>
                    <th className="py-2.5 px-3 font-medium text-center">{t('statistics.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-light-200/30 dark:divide-dark-200/30">
                  {paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-light-200/50 dark:hover:bg-dark-200/50 cursor-pointer transition"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap text-black/60 dark:text-white/60">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.effectiveSource === 'api' || log.keyPrefix ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#b8864d]/15 text-[#b8864d] font-mono border border-[#b8864d]/30">
                            <KeyRound size={10} />
                            {log.keyPrefix ? `${log.keyPrefix}...` : 'API'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                            <Globe size={10} />
                            UI
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate">
                        <span className="font-medium text-black dark:text-white">
                          {log.query || '—'}
                        </span>
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-light-200 dark:bg-dark-200 text-black/60 dark:text-white/60 uppercase">
                          {log.step}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-medium">{log.modelKey}</span>
                        <span className="ml-1 text-[10px] text-black/50 dark:text-white/50">
                          ({log.providerName || log.providerId})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap text-black/60 dark:text-white/60">
                        {log.promptTokens} / {log.completionTokens}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-[#b8864d]">
                        {log.totalTokens}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium text-amber-500">
                        {formatLatency(log.durationMs)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap text-black/60 dark:text-white/60">
                        {log.tokensPerSecond ? `${log.tokensPerSecond} t/s` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                            <CheckCircle2 size={11} /> {t('statistics.statusOk')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                            <AlertCircle size={11} /> {t('statistics.statusError')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLogs.length === 0 && (
                <div className="py-8 text-center text-xs text-black/50 dark:text-white/50">
                  {t('statistics.noRecordsFound')}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-light-200/40 dark:border-dark-200/40 text-xs">
                {/* Entries count & rows per page selector */}
                <div className="flex flex-wrap items-center gap-3 text-black/60 dark:text-white/60">
                  <span>
                    {t('statistics.showingEntries', {
                      from: startItem,
                      to: endItem,
                      total: filteredLogs.length,
                    }) || `Showing ${startItem}–${endItem} of ${filteredLogs.length} entries`}
                  </span>

                  <div className="flex items-center gap-1.5 pl-2 sm:border-l border-light-200/60 dark:border-dark-200/60">
                    <span className="text-[11px]">{t('statistics.rowsPerPage') || 'Rows per page:'}</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="py-1 px-2 text-xs rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-[#b8864d]"
                    >
                      {[10, 15, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Navigation Buttons */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    {/* First Page */}
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={safeCurrentPage === 1}
                      title={t('statistics.firstPage') || 'First page'}
                      className={cn(
                        'p-1.5 rounded-lg border border-light-200 dark:border-dark-200 transition',
                        safeCurrentPage === 1
                          ? 'opacity-30 cursor-not-allowed text-black/40 dark:text-white/40'
                          : 'hover:bg-light-200 dark:hover:bg-dark-200 text-black/80 dark:text-white/80'
                      )}
                    >
                      <ChevronsLeft size={14} />
                    </button>

                    {/* Prev Page */}
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      title={t('statistics.previousPage') || 'Previous page'}
                      className={cn(
                        'p-1.5 rounded-lg border border-light-200 dark:border-dark-200 transition',
                        safeCurrentPage === 1
                          ? 'opacity-30 cursor-not-allowed text-black/40 dark:text-white/40'
                          : 'hover:bg-light-200 dark:hover:bg-dark-200 text-black/80 dark:text-white/80'
                      )}
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {/* Page Number Pills */}
                    <div className="flex items-center gap-1 mx-1">
                      {getPaginationPageNumbers(safeCurrentPage, totalPages).map((p, idx) =>
                        typeof p === 'number' ? (
                          <button
                            key={idx}
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              'min-w-[28px] h-7 px-2 text-xs font-medium rounded-lg transition',
                              safeCurrentPage === p
                                ? 'bg-[#b8864d] text-white font-semibold shadow-sm'
                                : 'border border-light-200 dark:border-dark-200 hover:bg-light-200 dark:hover:bg-dark-200 text-black/70 dark:text-white/70'
                            )}
                          >
                            {p}
                          </button>
                        ) : (
                          <span key={idx} className="px-1 text-black/40 dark:text-white/40 select-none">
                            …
                          </span>
                        )
                      )}
                    </div>

                    {/* Next Page */}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      title={t('statistics.nextPage') || 'Next page'}
                      className={cn(
                        'p-1.5 rounded-lg border border-light-200 dark:border-dark-200 transition',
                        safeCurrentPage === totalPages
                          ? 'opacity-30 cursor-not-allowed text-black/40 dark:text-white/40'
                          : 'hover:bg-light-200 dark:hover:bg-dark-200 text-black/80 dark:text-white/80'
                      )}
                    >
                      <ChevronRight size={14} />
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={safeCurrentPage === totalPages}
                      title={t('statistics.lastPage') || 'Last page'}
                      className={cn(
                        'p-1.5 rounded-lg border border-light-200 dark:border-dark-200 transition',
                        safeCurrentPage === totalPages
                          ? 'opacity-30 cursor-not-allowed text-black/40 dark:text-white/40'
                          : 'hover:bg-light-200 dark:hover:bg-dark-200 text-black/80 dark:text-white/80'
                      )}
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      <Dialog
        open={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 shadow-2xl flex flex-col gap-4 text-black dark:text-white max-h-[90vh] overflow-y-auto">
            {selectedLog && (
              <>
                <div className="flex items-center justify-between border-b border-light-200/50 dark:border-dark-200/50 pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-[#b8864d]" />
                    <h3 className="text-sm font-semibold">{t('statistics.invocationDetails')}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="p-1 rounded-lg text-black/50 dark:text-white/50 hover:bg-light-200 dark:hover:bg-dark-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-col gap-3 text-xs">
                  <div>
                    <span className="text-black/50 dark:text-white/50 block mb-1">Query:</span>
                    <p className="p-3 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50 font-mono text-[11px] leading-relaxed">
                      {selectedLog.query || '—'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-black/50 dark:text-white/50 block mb-1">Model:</span>
                      <span className="font-semibold">{selectedLog.modelKey}</span>
                      <span className="text-[10px] text-black/50 dark:text-white/50 block">
                        Provider: {selectedLog.providerName || selectedLog.providerId}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-black/50 dark:text-white/50 block mb-1">Source / Key:</span>
                      <span className="font-semibold">
                        {selectedLog.keyName || (selectedLog.effectiveSource === 'api' ? 'API Key' : 'Web UI')}
                      </span>
                      {selectedLog.keyPrefix && (
                        <span className="text-[10px] text-[#b8864d] block font-mono">
                          {selectedLog.keyPrefix}...
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-[10px] text-black/50 dark:text-white/50 block">Prompt</span>
                      <span className="font-semibold">{selectedLog.promptTokens} tok</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-[10px] text-black/50 dark:text-white/50 block">Completion</span>
                      <span className="font-semibold">{selectedLog.completionTokens} tok</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-[10px] text-black/50 dark:text-white/50 block">Total</span>
                      <span className="font-semibold text-[#b8864d]">{selectedLog.totalTokens} tok</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-[10px] text-black/50 dark:text-white/50 block">Duration</span>
                      <span className="font-semibold text-amber-500">{formatLatency(selectedLog.durationMs)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200/50 dark:border-dark-200/50">
                      <span className="text-[10px] text-black/50 dark:text-white/50 block">TTFT</span>
                      <span className="font-semibold">
                        {selectedLog.timeToFirstTokenMs ? formatLatency(selectedLog.timeToFirstTokenMs) : '—'}
                      </span>
                    </div>
                  </div>

                  {selectedLog.errorMessage && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 font-mono text-[11px]">
                      {selectedLog.errorMessage}
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
};

export default Page;
