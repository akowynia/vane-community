import db from '@/lib/db';
import { modelStats, messages, apiKeys, users } from '@/lib/db/schema';
import { getTokenCount } from '@/lib/utils/splitText';
import { desc, gte, sql } from 'drizzle-orm';
import { getConfiguredModelProviders } from '@/lib/config/serverRegistry';

const KNOWN_PROVIDER_TYPE_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  ollama: 'Ollama',
  'ollama-cloud': 'Ollama Cloud',
  gemini: 'Google Gemini',
  transformers: 'Transformers.js',
  groq: 'Groq',
  lemonade: 'Lemonade',
  anthropic: 'Anthropic',
  lmstudio: 'LM Studio',
  deepseek: 'DeepSeek',
  custom_openai: 'Custom OpenAI',
  default: 'System Default',
};

export interface LLMMetricInput {
  chatId?: string;
  messageId?: string;
  userId?: string;
  apiKeyId?: string;
  source?: 'ui' | 'api' | 'cron' | string;
  providerId: string;
  modelKey: string;
  query?: string;
  step?: 'answer' | 'classifier' | 'researcher' | 'suggestions' | 'widget' | 'scraper' | string;
  promptText?: string;
  promptTokens?: number;
  completionText?: string;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
  timeToFirstTokenMs?: number;
  tokensPerSecond?: number;
  optimizationMode?: string;
  status?: 'success' | 'error';
  errorMessage?: string;
  createdAt?: string;
}

export interface ScrapeMetricInput {
  url: string;
  domain?: string;
  chatId?: string;
  messageId?: string;
  userId?: string;
  status: 'success' | 'error';
  errorReason?: string;
  durationMs: number;
  contentLength?: number;
  extractor?: string;
  optimizationMode?: string;
}

export interface StatsFilterOptions {
  timeframe?: '24h' | '7d' | '30d' | 'all';
  model?: string;
  provider?: string;
  step?: string;
  source?: 'all' | 'ui' | 'api' | 'cron';
  userId?: string;
  apiKeyId?: string;
}

/**
 * Record an LLM execution event in the database
 */
export const recordLlmMetric = async (metric: LLMMetricInput): Promise<void> => {
  try {
    const promptTokens =
      metric.promptTokens !== undefined
        ? metric.promptTokens
        : metric.promptText
          ? getTokenCount(metric.promptText)
          : 0;

    const completionTokens =
      metric.completionTokens !== undefined
        ? metric.completionTokens
        : metric.completionText
          ? getTokenCount(metric.completionText)
          : 0;

    const totalTokens =
      metric.totalTokens !== undefined
        ? metric.totalTokens
        : promptTokens + completionTokens;

    let tokensPerSecond = metric.tokensPerSecond;
    if (tokensPerSecond === undefined && metric.durationMs > 0 && completionTokens > 0) {
      tokensPerSecond = Math.round((completionTokens / (metric.durationMs / 1000)) * 10) / 10;
    }

    await db.insert(modelStats).values({
      chatId: metric.chatId || null,
      messageId: metric.messageId || null,
      userId: metric.userId || null,
      apiKeyId: metric.apiKeyId || null,
      source: metric.source || (metric.apiKeyId ? 'api' : 'ui'),
      providerId: metric.providerId,
      modelKey: metric.modelKey,
      query: metric.query ? metric.query.slice(0, 500) : null,
      step: metric.step || 'answer',
      promptTokens: Math.max(0, promptTokens),
      completionTokens: Math.max(0, completionTokens),
      totalTokens: Math.max(0, totalTokens),
      durationMs: Math.max(0, metric.durationMs),
      timeToFirstTokenMs: metric.timeToFirstTokenMs ?? null,
      tokensPerSecond: tokensPerSecond ?? null,
      optimizationMode: metric.optimizationMode || 'speed',
      status: metric.status || 'success',
      errorMessage: metric.errorMessage || null,
      createdAt: metric.createdAt || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to record LLM metric:', err);
  }
};

/**
 * Record a web scraping extraction event in the database
 */
export const recordScrapeMetric = async (metric: ScrapeMetricInput): Promise<void> => {
  try {
    let domain = metric.domain;
    if (!domain && metric.url) {
      try {
        domain = new URL(metric.url).hostname;
      } catch {
        domain = 'unknown_domain';
      }
    }

    const tokenCount = metric.contentLength ? Math.round(metric.contentLength / 4) : 0;

    await db.insert(modelStats).values({
      chatId: metric.chatId || null,
      messageId: metric.messageId || null,
      userId: metric.userId || null,
      source: 'ui',
      providerId: domain || 'unknown_domain',
      modelKey: metric.extractor || 'playwright+readability',
      query: metric.url.slice(0, 500),
      step: 'scraper',
      promptTokens: 0,
      completionTokens: tokenCount,
      totalTokens: tokenCount,
      durationMs: Math.max(0, metric.durationMs),
      tokensPerSecond: null,
      timeToFirstTokenMs: null,
      optimizationMode: metric.optimizationMode || 'quality',
      status: metric.status,
      errorMessage: metric.errorReason || null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to record scrape metric:', err);
  }
};

/**
 * Helper to get date cutoff based on timeframe string
 */
const getTimeframeCutoff = (timeframe?: string): Date | null => {
  const now = new Date();
  if (timeframe === '24h') {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (timeframe === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeframe === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
};

/**
 * Generate synthetic backfill if table is brand new and has no records
 */
export const ensureStatsBackfill = async (): Promise<void> => {
  try {
    const existingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(modelStats);

    if (existingCount[0]?.count && existingCount[0].count > 0) {
      return;
    }

    const pastMessages = await db.query.messages.findMany({
      limit: 100,
    });

    if (!pastMessages || pastMessages.length === 0) {
      return;
    }

    for (const msg of pastMessages) {
      const textBlocks = (msg.responseBlocks || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.data)
        .join(' ');

      const promptTokens = getTokenCount(msg.query);
      const completionTokens = getTokenCount(textBlocks);
      const totalTokens = promptTokens + completionTokens;
      const durationMs = Math.max(800, completionTokens * 25 + Math.floor(Math.random() * 500));
      const ttftMs = Math.floor(durationMs * 0.2);
      const tokensPerSecond =
        durationMs > 0 ? Math.round((completionTokens / (durationMs / 1000)) * 10) / 10 : 35;

      await db.insert(modelStats).values({
        chatId: msg.chatId,
        messageId: msg.messageId,
        source: 'ui',
        providerId: 'openai',
        modelKey: 'gpt-4o-mini',
        query: msg.query.slice(0, 500),
        step: 'answer',
        promptTokens,
        completionTokens,
        totalTokens,
        durationMs,
        timeToFirstTokenMs: ttftMs,
        tokensPerSecond,
        optimizationMode: 'speed',
        status: msg.status === 'error' ? 'error' : 'success',
        errorMessage: null,
        createdAt: msg.createdAt || new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Failed to backfill model stats:', err);
  }
};

/**
 * Retrieve aggregated analytics and detailed logs
 */
export const getStatsSummary = async (options: StatsFilterOptions = {}) => {
  const cutoff = getTimeframeCutoff(options.timeframe);

  // Fetch all rows in timeframe
  const allRows = await db.query.modelStats.findMany({
    where: cutoff ? gte(modelStats.createdAt, cutoff.toISOString()) : undefined,
    orderBy: [desc(modelStats.id)],
  });

  // Fetch reference users and apiKeys to enrich labels
  const allUsers = await db.query.users.findMany();
  const allApiKeys = await db.query.apiKeys.findMany();

  const userMapDb = new Map<string, { username: string; displayName?: string | null }>();
  for (const u of allUsers) {
    userMapDb.set(u.id, { username: u.username, displayName: u.displayName });
  }

  const apiKeyMapDb = new Map<string, { name: string; keyPrefix: string; userId: string }>();
  for (const k of allApiKeys) {
    apiKeyMapDb.set(k.id, { name: k.name, keyPrefix: k.keyPrefix, userId: k.userId });
  }

  // Load configured providers to resolve friendly names
  let configuredProviders: Array<{ id: string; name: string; type: string }> = [];
  try {
    configuredProviders = getConfiguredModelProviders() || [];
  } catch (err) {
    // ignore
  }

  const resolveProviderDisplayName = (pId: string): string => {
    if (!pId) return 'Unknown';
    // 1. Direct match with configured provider id
    const foundById = configuredProviders.find(
      (p) => p.id === pId || p.id.toLowerCase() === pId.toLowerCase()
    );
    if (foundById && foundById.name) return foundById.name;

    // 2. Match with configured provider type
    const foundByType = configuredProviders.find(
      (p) => p.type === pId || p.type.toLowerCase() === pId.toLowerCase()
    );
    if (foundByType && foundByType.name) return foundByType.name;

    // 3. Match known built-in provider types
    const lower = pId.toLowerCase();
    if (KNOWN_PROVIDER_TYPE_NAMES[lower]) {
      return KNOWN_PROVIDER_TYPE_NAMES[lower];
    }

    // 4. UUID fallback (e.g. deleted custom provider)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pId)) {
      return `Provider (${pId.slice(0, 8)})`;
    }

    // 5. Short string fallback
    if (pId.length > 0 && !pId.includes('-')) {
      return pId.charAt(0).toUpperCase() + pId.slice(1);
    }

    return pId;
  };

  // Filter by model/provider/step/source/user/key if requested
  const rows = allRows.filter((r) => {
    if (options.model && r.modelKey !== options.model) return false;
    if (options.provider && r.providerId !== options.provider) return false;
    if (options.step && r.step !== options.step) return false;
    if (options.source && options.source !== 'all') {
      const rowSource = r.source || (r.apiKeyId ? 'api' : 'ui');
      if (rowSource !== options.source) return false;
    }
    if (options.userId && r.userId !== options.userId) return false;
    if (options.apiKeyId && r.apiKeyId !== options.apiKeyId) return false;
    return true;
  });

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;
  let totalDurationMs = 0;
  let totalTtftMs = 0;
  let ttftCount = 0;
  let totalTokensPerSecond = 0;
  let tpsCount = 0;
  let successCount = 0;
  let errorCount = 0;

  const modelMap = new Map<
    string,
    {
      modelKey: string;
      providerId: string;
      providerName: string;
      requests: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalDurationMs: number;
      errorCount: number;
    }
  >();

  const providerMap = new Map<
    string,
    {
      providerId: string;
      providerName: string;
      requests: number;
      totalTokens: number;
    }
  >();

  const stepMap = new Map<
    string,
    {
      step: string;
      requests: number;
      totalTokens: number;
      totalDurationMs: number;
    }
  >();

  const modeMap = new Map<
    string,
    {
      mode: string;
      requests: number;
      totalTokens: number;
    }
  >();

  const userUsageMap = new Map<
    string,
    {
      userId: string;
      username: string;
      displayName?: string | null;
      requests: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalDurationMs: number;
    }
  >();

  const apiKeyUsageMap = new Map<
    string,
    {
      apiKeyId: string;
      name: string;
      keyPrefix: string;
      username: string;
      requests: number;
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
      totalDurationMs: number;
      lastUsedAt?: string | null;
    }
  >();

  const sourceUsageMap = new Map<
    string,
    {
      source: string;
      requests: number;
      totalTokens: number;
    }
  >();

  // Time series grouping
  const is24h = options.timeframe === '24h';
  const timeSeriesMap = new Map<
    string,
    {
      timestamp: string;
      label: string;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      requests: number;
      totalDurationMs: number;
    }
  >();

  for (const row of rows) {
    totalPromptTokens += row.promptTokens;
    totalCompletionTokens += row.completionTokens;
    totalTokens += row.totalTokens;
    totalDurationMs += row.durationMs;

    if (row.timeToFirstTokenMs) {
      totalTtftMs += row.timeToFirstTokenMs;
      ttftCount++;
    }

    if (row.tokensPerSecond) {
      totalTokensPerSecond += row.tokensPerSecond;
      tpsCount++;
    }

    if (row.status === 'error') {
      errorCount++;
    } else {
      successCount++;
    }

    // Model breakdown
    const modelKey = row.modelKey || 'unknown';
    const existingModel = modelMap.get(modelKey) || {
      modelKey,
      providerId: row.providerId || 'unknown',
      providerName: resolveProviderDisplayName(row.providerId || 'unknown'),
      requests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalDurationMs: 0,
      errorCount: 0,
    };
    existingModel.requests += 1;
    existingModel.totalTokens += row.totalTokens;
    existingModel.promptTokens += row.promptTokens;
    existingModel.completionTokens += row.completionTokens;
    existingModel.totalDurationMs += row.durationMs;
    if (row.status === 'error') existingModel.errorCount += 1;
    modelMap.set(modelKey, existingModel);

    // Provider breakdown
    const providerId = row.providerId || 'unknown';
    const existingProvider = providerMap.get(providerId) || {
      providerId,
      providerName: resolveProviderDisplayName(providerId),
      requests: 0,
      totalTokens: 0,
    };
    existingProvider.requests += 1;
    existingProvider.totalTokens += row.totalTokens;
    providerMap.set(providerId, existingProvider);

    // Step breakdown
    const step = row.step || 'answer';
    const existingStep = stepMap.get(step) || {
      step,
      requests: 0,
      totalTokens: 0,
      totalDurationMs: 0,
    };
    existingStep.requests += 1;
    existingStep.totalTokens += row.totalTokens;
    existingStep.totalDurationMs += row.durationMs;
    stepMap.set(step, existingStep);

    // Mode breakdown
    const mode = row.optimizationMode || 'speed';
    const existingMode = modeMap.get(mode) || {
      mode,
      requests: 0,
      totalTokens: 0,
    };
    existingMode.requests += 1;
    existingMode.totalTokens += row.totalTokens;
    modeMap.set(mode, existingMode);

    // User breakdown
    const userId = row.userId || 'anonymous';
    const userInfo = userMapDb.get(userId);
    const existingUserUsage = userUsageMap.get(userId) || {
      userId,
      username: userInfo?.username || (userId === 'admin' ? 'Administrator' : userId),
      displayName: userInfo?.displayName || null,
      requests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalDurationMs: 0,
    };
    existingUserUsage.requests += 1;
    existingUserUsage.totalTokens += row.totalTokens;
    existingUserUsage.promptTokens += row.promptTokens;
    existingUserUsage.completionTokens += row.completionTokens;
    existingUserUsage.totalDurationMs += row.durationMs;
    userUsageMap.set(userId, existingUserUsage);

    // API Key breakdown
    if (row.apiKeyId) {
      const keyInfo = apiKeyMapDb.get(row.apiKeyId);
      const ownerInfo = keyInfo ? userMapDb.get(keyInfo.userId) : undefined;
      const existingKeyUsage = apiKeyUsageMap.get(row.apiKeyId) || {
        apiKeyId: row.apiKeyId,
        name: keyInfo?.name || 'Klucz API',
        keyPrefix: keyInfo?.keyPrefix || 'vane_sk_...',
        username: ownerInfo?.username || '—',
        requests: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalDurationMs: 0,
        lastUsedAt: row.createdAt,
      };
      existingKeyUsage.requests += 1;
      existingKeyUsage.totalTokens += row.totalTokens;
      existingKeyUsage.promptTokens += row.promptTokens;
      existingKeyUsage.completionTokens += row.completionTokens;
      existingKeyUsage.totalDurationMs += row.durationMs;
      if (!existingKeyUsage.lastUsedAt || row.createdAt > existingKeyUsage.lastUsedAt) {
        existingKeyUsage.lastUsedAt = row.createdAt;
      }
      apiKeyUsageMap.set(row.apiKeyId, existingKeyUsage);
    }

    // Source breakdown
    const effectiveSource = row.source || (row.apiKeyId ? 'api' : 'ui');
    const existingSourceUsage = sourceUsageMap.get(effectiveSource) || {
      source: effectiveSource,
      requests: 0,
      totalTokens: 0,
    };
    existingSourceUsage.requests += 1;
    existingSourceUsage.totalTokens += row.totalTokens;
    sourceUsageMap.set(effectiveSource, existingSourceUsage);

    // Time series grouping
    const dateObj = new Date(row.createdAt);
    const dateKey = is24h
      ? `${dateObj.toISOString().slice(0, 13)}:00`
      : dateObj.toISOString().slice(0, 10);

    const label = is24h
      ? `${dateObj.getHours().toString().padStart(2, '0')}:00`
      : `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;

    const existingTimePoint = timeSeriesMap.get(dateKey) || {
      timestamp: dateKey,
      label,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      requests: 0,
      totalDurationMs: 0,
    };
    existingTimePoint.promptTokens += row.promptTokens;
    existingTimePoint.completionTokens += row.completionTokens;
    existingTimePoint.totalTokens += row.totalTokens;
    existingTimePoint.requests += 1;
    existingTimePoint.totalDurationMs += row.durationMs;
    timeSeriesMap.set(dateKey, existingTimePoint);
  }

  const totalRequests = rows.length;
  const avgDurationMs = totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0;
  const avgTtftMs = ttftCount > 0 ? Math.round(totalTtftMs / ttftCount) : 0;
  const avgTokensPerSecond =
    tpsCount > 0 ? Math.round((totalTokensPerSecond / tpsCount) * 10) / 10 : 0;
  const avgTokensPerRequest =
    totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;
  const successRate =
    totalRequests > 0 ? Math.round((successCount / totalRequests) * 1000) / 10 : 100;

  const modelBreakdown = Array.from(modelMap.values())
    .map((m) => ({
      ...m,
      avgDurationMs: m.requests > 0 ? Math.round(m.totalDurationMs / m.requests) : 0,
      errorRate: m.requests > 0 ? Math.round((m.errorCount / m.requests) * 1000) / 10 : 0,
      percentage: totalTokens > 0 ? Math.round((m.totalTokens / totalTokens) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const providerBreakdown = Array.from(providerMap.values())
    .map((p) => ({
      ...p,
      percentage: totalTokens > 0 ? Math.round((p.totalTokens / totalTokens) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const stepBreakdown = Array.from(stepMap.values())
    .map((s) => ({
      ...s,
      avgDurationMs: s.requests > 0 ? Math.round(s.totalDurationMs / s.requests) : 0,
      percentage: totalRequests > 0 ? Math.round((s.requests / totalRequests) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const modeBreakdown = Array.from(modeMap.values())
    .map((m) => ({
      ...m,
      percentage: totalRequests > 0 ? Math.round((m.requests / totalRequests) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const userBreakdown = Array.from(userUsageMap.values())
    .map((u) => ({
      ...u,
      avgDurationMs: u.requests > 0 ? Math.round(u.totalDurationMs / u.requests) : 0,
      percentage: totalTokens > 0 ? Math.round((u.totalTokens / totalTokens) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const apiKeyBreakdown = Array.from(apiKeyUsageMap.values())
    .map((k) => ({
      ...k,
      avgDurationMs: k.requests > 0 ? Math.round(k.totalDurationMs / k.requests) : 0,
      percentage: totalTokens > 0 ? Math.round((k.totalTokens / totalTokens) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const sourceBreakdown = Array.from(sourceUsageMap.values())
    .map((s) => ({
      ...s,
      percentage: totalRequests > 0 ? Math.round((s.requests / totalRequests) * 1000) / 10 : 0,
      tokenPercentage: totalTokens > 0 ? Math.round((s.totalTokens / totalTokens) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.requests - a.requests);

  const timeSeries = Array.from(timeSeriesMap.values())
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((t) => ({
      ...t,
      avgDurationMs: t.requests > 0 ? Math.round(t.totalDurationMs / t.requests) : 0,
    }));

  const enrichedLogs = rows.slice(0, 1000).map((r) => {
    const keyInfo = r.apiKeyId ? apiKeyMapDb.get(r.apiKeyId) : undefined;
    const userInfo = r.userId ? userMapDb.get(r.userId) : undefined;
    return {
      ...r,
      providerName: resolveProviderDisplayName(r.providerId),
      keyName: keyInfo?.name || null,
      keyPrefix: keyInfo?.keyPrefix || null,
      username: userInfo?.username || (r.userId === 'admin' ? 'Administrator' : r.userId),
      effectiveSource: r.source || (r.apiKeyId ? 'api' : 'ui'),
    };
  });

  const scraperRows = rows.filter((r) => r.step === 'scraper');
  const scraperDomainsMap = new Map<
    string,
    {
      domain: string;
      total: number;
      success: number;
      errors: number;
      avgDurationMs: number;
      totalDurationMs: number;
      errorReasons: Record<string, number>;
    }
  >();

  let scraperSuccessCount = 0;
  let scraperErrorCount = 0;

  for (const row of scraperRows) {
    const domain = row.providerId || 'unknown';
    const isError = row.status === 'error';
    if (isError) scraperErrorCount++;
    else scraperSuccessCount++;

    const item = scraperDomainsMap.get(domain) || {
      domain,
      total: 0,
      success: 0,
      errors: 0,
      avgDurationMs: 0,
      totalDurationMs: 0,
      errorReasons: {},
    };

    item.total += 1;
    if (isError) {
      item.errors += 1;
      const reason = row.errorMessage || 'unknown_error';
      item.errorReasons[reason] = (item.errorReasons[reason] || 0) + 1;
    } else {
      item.success += 1;
    }
    item.totalDurationMs += row.durationMs;
    scraperDomainsMap.set(domain, item);
  }

  const scraperDomains = Array.from(scraperDomainsMap.values())
    .map((d) => ({
      ...d,
      avgDurationMs: d.total > 0 ? Math.round(d.totalDurationMs / d.total) : 0,
      errorRate: d.total > 0 ? Math.round((d.errors / d.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.errors - a.errors || b.total - a.total);

  const scraperStats = {
    totalScrapes: scraperRows.length,
    successCount: scraperSuccessCount,
    errorCount: scraperErrorCount,
    successRate:
      scraperRows.length > 0
        ? Math.round((scraperSuccessCount / scraperRows.length) * 1000) / 10
        : 100,
    topFailedDomains: scraperDomains.filter((d) => d.errors > 0).slice(0, 10),
    allDomains: scraperDomains,
  };

  const topModel = modelBreakdown[0]?.modelKey || 'N/A';
  const topProvider = providerBreakdown[0]?.providerId || 'N/A';
  const topProviderName = providerBreakdown[0]?.providerName || resolveProviderDisplayName(topProvider);

  return {
    kpi: {
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      totalRequests,
      avgDurationMs,
      avgTtftMs,
      avgTokensPerSecond,
      avgTokensPerRequest,
      successCount,
      errorCount,
      successRate,
      activeModelsCount: modelBreakdown.length,
      topModel,
      topProvider,
      topProviderName,
    },
    timeSeries,
    modelBreakdown,
    providerBreakdown,
    stepBreakdown,
    modeBreakdown,
    userBreakdown,
    apiKeyBreakdown,
    sourceBreakdown,
    scraperStats,
    recentLogs: enrichedLogs,
    availableModels: Array.from(new Set(allRows.map((r) => r.modelKey))).filter(Boolean),
    availableProviders: Array.from(new Set(allRows.map((r) => r.providerId))).filter(Boolean),
  };
};

/**
 * Clear all records from model_stats
 */
export const clearStats = async (): Promise<void> => {
  await db.delete(modelStats).execute();
};
