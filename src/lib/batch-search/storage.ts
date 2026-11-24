import type { BatchQueryItem, BatchSourceResult, HeaderFormatType } from './types';

export const LEGACY_BATCH_STORAGE_KEY = 'vane_batch_search_persisted_session_v1';
const IDB_NAME = 'vane_batch_search_db';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'sessions';
const IDB_SESSION_KEY = 'current_session';

export const MAX_SOURCE_SNIPPET_LENGTH = 500;
export const MAX_SCRATCHPAD_TITLE_LENGTH = 200;

export interface PersistedBatchSession {
  items: BatchQueryItem[];
  activeTab?: 'upload' | 'queue' | 'results' | 'export';
  rawCsvText?: string;
  defaultSources?: string[];
  defaultOptimization?: 'speed' | 'balanced' | 'quality';
  defaultModelKey?: string;
  defaultProviderId?: string;
  headerFormat?: HeaderFormatType;
  includeSources?: boolean;
  isFloatingHidden?: boolean;
}

/**
 * Normalizes raw search sources into compact objects and deduplicates by URL.
 * Prevents multi-megabyte pageContent blobs from bloating session storage and API payloads.
 */
export function normalizeBatchSources(
  sources: any[] | undefined,
  includeSnippet = true,
): BatchSourceResult[] {
  if (!Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  const normalized: BatchSourceResult[] = [];
  const seenKeys = new Set<string>();

  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;

    const rawUrl = src?.metadata?.url ?? src?.url ?? '';
    const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';

    const rawTitle = src?.metadata?.title ?? src?.title ?? src?.metadata?.fileName ?? '';
    const title = (typeof rawTitle === 'string' ? rawTitle.trim() : '') || url;

    const dedupKey = url ? url.toLowerCase() : title.toLowerCase();
    if (!dedupKey || seenKeys.has(dedupKey)) {
      continue;
    }
    seenKeys.add(dedupKey);

    const entry: BatchSourceResult = {
      title,
      url,
    };

    if (includeSnippet) {
      const rawSnippet =
        src?.content ?? src?.snippet ?? src?.metadata?.snippet ?? src?.pageContent ?? '';
      if (typeof rawSnippet === 'string' && rawSnippet.trim().length > 0) {
        entry.content = rawSnippet.trim().slice(0, MAX_SOURCE_SNIPPET_LENGTH);
      }
    }

    normalized.push(entry);
  }

  return normalized;
}

/**
 * Normalizes persisted batch items, resetting transient 'searching' states and trimming source payloads.
 */
export function sanitizePersistedItems(items: BatchQueryItem[]): BatchQueryItem[] {
  if (!Array.isArray(items)) return [];

  return items.map((it) => ({
    ...it,
    status: it.status === 'searching' ? 'pending' : it.status,
    sourcesList: Array.isArray(it.sourcesList)
      ? normalizeBatchSources(it.sourcesList, true)
      : undefined,
  }));
}

/**
 * Truncates a generated batch title to fit the backend schema length limit.
 */
export function buildBoundedBatchTitle(
  customTitle: string | undefined,
  items: BatchQueryItem[],
): string {
  const custom = customTitle?.trim();
  if (custom) {
    return custom.length > MAX_SCRATCHPAD_TITLE_LENGTH
      ? `${custom.slice(0, MAX_SCRATCHPAD_TITLE_LENGTH - 3).trimEnd()}...`
      : custom;
  }

  const firstCompleted = items.find((i) => i.status === 'completed') || items[0];
  if (!firstCompleted?.query) {
    return `Batch Research (${items.length} items)`;
  }

  const suffix = items.length > 1 ? ` (+${items.length - 1})` : '';
  const prefix = 'Batch Research: ';
  const maxQueryLen = MAX_SCRATCHPAD_TITLE_LENGTH - prefix.length - suffix.length;
  const rawQuery = firstCompleted.query.trim();

  if (rawQuery.length <= maxQueryLen) {
    return `${prefix}${rawQuery}${suffix}`;
  }

  const safeMax = Math.max(10, maxQueryLen - 3);
  return `${prefix}${rawQuery.slice(0, safeMax).trimEnd()}...${suffix}`;
}

function openBatchDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

async function readFromIndexedDb(): Promise<PersistedBatchSession | null> {
  const db = await openBatchDb();
  try {
    return await new Promise<PersistedBatchSession | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(IDB_SESSION_KEY);
      req.onsuccess = () => resolve((req.result as PersistedBatchSession) || null);
      req.onerror = () => reject(req.error || new Error('Failed to read from IndexedDB'));
    });
  } finally {
    db.close();
  }
}

async function writeToIndexedDb(payload: PersistedBatchSession): Promise<void> {
  const db = await openBatchDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(payload, IDB_SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to write to IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    });
  } finally {
    db.close();
  }
}

async function deleteFromIndexedDb(): Promise<void> {
  const db = await openBatchDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.delete(IDB_SESSION_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to clear IndexedDB'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB delete aborted'));
    });
  } finally {
    db.close();
  }
}

function readFromLegacyLocalStorage(): PersistedBatchSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_BATCH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed as PersistedBatchSession;
  } catch {
    return null;
  }
}

/**
 * Loads persisted batch search session from IndexedDB, falling back to legacy localStorage.
 */
export async function loadPersistedBatchSession(): Promise<PersistedBatchSession | null> {
  if (typeof window === 'undefined') return null;

  try {
    const idbData = await readFromIndexedDb();
    if (idbData && Array.isArray(idbData.items) && idbData.items.length > 0) {
      return {
        ...idbData,
        items: sanitizePersistedItems(idbData.items),
      };
    }
  } catch {
    // Fall back to localStorage if IndexedDB is unavailable
  }

  const legacyData = readFromLegacyLocalStorage();
  if (legacyData && Array.isArray(legacyData.items) && legacyData.items.length > 0) {
    return {
      ...legacyData,
      items: sanitizePersistedItems(legacyData.items),
    };
  }

  return null;
}

/**
 * Persists the batch search session to IndexedDB (large quota) and updates or cleans legacy localStorage.
 */
export async function savePersistedBatchSession(
  session: PersistedBatchSession,
): Promise<{ saved: boolean; error?: string }> {
  if (typeof window === 'undefined') return { saved: true };

  const compactSession: PersistedBatchSession = {
    ...session,
    items: sanitizePersistedItems(session.items),
  };

  let idbSaved = false;
  let lastError: string | undefined;

  try {
    await writeToIndexedDb(compactSession);
    idbSaved = true;
  } catch (err: any) {
    lastError = err?.message || 'IndexedDB write failed';
  }

  try {
    window.localStorage.setItem(LEGACY_BATCH_STORAGE_KEY, JSON.stringify(compactSession));
    return { saved: true };
  } catch (err: any) {
    if (idbSaved) {
      // Remove stale legacy entry so an older truncated snapshot does not linger
      try {
        window.localStorage.removeItem(LEGACY_BATCH_STORAGE_KEY);
      } catch {
        // Ignore cleanup failure
      }
      return { saved: true };
    }
    return {
      saved: false,
      error: lastError || err?.message || 'Browser storage quota exceeded',
    };
  }
}

/**
 * Clears persisted batch session from both IndexedDB and legacy localStorage.
 */
export async function clearPersistedBatchSession(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(LEGACY_BATCH_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }

  try {
    await deleteFromIndexedDb();
  } catch {
    // Ignore IndexedDB cleanup errors
  }
}
