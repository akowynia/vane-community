import { toast } from 'sonner';

interface ExecuteBulkDeleteParams {
  endpoint: string;
  ids: string[];
  onUnauthorized?: () => void;
  t: (key: string, params?: Record<string, any>) => string;
  fallbackError?: string;
}

interface ExecuteBulkDeleteResult {
  ok: boolean;
  deletedIds: string[];
  skippedIds: string[];
}

/**
 * Execute a bulk delete HTTP request and surface localized toast feedback.
 */
export async function executeBulkDelete({
  endpoint,
  ids,
  onUnauthorized,
  t,
  fallbackError,
}: ExecuteBulkDeleteParams): Promise<ExecuteBulkDeleteResult> {
  if (!ids.length) {
    return { ok: false, deletedIds: [], skippedIds: [] };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    if (res.status === 401) {
      onUnauthorized?.();
      const data = await res.json().catch(() => ({}));
      toast.error(data?.message || t('crons.loginRequired') || 'Login required.');
      return { ok: false, deletedIds: [], skippedIds: ids };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data?.message || fallbackError || t('bulkDelete.deleteError') || 'Failed to delete selected items.',
      );
    }

    const deletedIds: string[] = Array.isArray(data?.deletedIds) ? data.deletedIds : ids;
    const skippedIds: string[] = Array.isArray(data?.skippedIds) ? data.skippedIds : [];

    if (skippedIds.length > 0) {
      toast.warning(
        t('bulkDelete.deletedPartial', {
          deleted: deletedIds.length,
          skipped: skippedIds.length,
        }) || `Deleted ${deletedIds.length} item(s). ${skippedIds.length} skipped due to permissions.`,
      );
    } else {
      toast.success(
        t('bulkDelete.deletedSuccess', { count: deletedIds.length }) ||
          `Deleted ${deletedIds.length} item(s).`,
      );
    }

    return { ok: true, deletedIds, skippedIds };
  } catch (err: any) {
    toast.error(
      err?.message || fallbackError || t('bulkDelete.deleteError') || 'Failed to delete selected items.',
    );
    return { ok: false, deletedIds: [], skippedIds: ids };
  }
}

