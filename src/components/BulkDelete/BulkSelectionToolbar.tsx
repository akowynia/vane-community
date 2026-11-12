'use client';

import React from 'react';
import { CheckSquare, Square, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface BulkSelectionToolbarProps {
  isSelectionMode: boolean;
  selectedCount: number;
  selectableCount: number;
  allSelected: boolean;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onDeleteAll?: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable toolbar for toggling selection mode and triggering single/bulk deletes.
 */
export const BulkSelectionToolbar: React.FC<BulkSelectionToolbarProps> = ({
  isSelectionMode,
  selectedCount,
  selectableCount,
  allSelected,
  onToggleSelectionMode,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onDeleteAll,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation();

  if (selectableCount === 0 && !isSelectionMode) {
    return null;
  }

  if (!isSelectionMode) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          type="button"
          disabled={disabled || selectableCount === 0}
          onClick={onToggleSelectionMode}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#181411] hover:border-[#b8864d]/60 text-xs font-medium text-black/75 dark:text-stone-300 hover:text-black dark:hover:text-stone-100 transition disabled:opacity-40 cursor-pointer"
        >
          <CheckSquare size={14} className="text-[#b8864d]" />
          <span>{t('bulkDelete.selectMode') || 'Select'}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl border border-[#b8864d]/35 bg-[#b8864d]/10 dark:bg-[#1b1510]/90 shadow-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#b8864d]/20 text-[#b8864d] font-semibold">
          {t('bulkDelete.selectedCount', { count: selectedCount }) ||
            `${selectedCount} selected`}
        </span>

        <button
          type="button"
          disabled={disabled || selectableCount === 0}
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-light-200 dark:border-[#30271e] bg-light-primary/80 dark:bg-[#14110e] hover:border-[#b8864d]/60 text-black/75 dark:text-stone-300 hover:text-black dark:hover:text-stone-100 font-medium transition disabled:opacity-40 cursor-pointer"
        >
          {allSelected ? (
            <>
              <Square size={13} />
              <span>{t('bulkDelete.deselectAll') || 'Deselect all'}</span>
            </>
          ) : (
            <>
              <CheckSquare size={13} className="text-[#b8864d]" />
              <span>{t('bulkDelete.selectAll') || 'Select all'}</span>
            </>
          )}
        </button>

        {selectedCount > 0 && !allSelected && (
          <button
            type="button"
            disabled={disabled}
            onClick={onDeselectAll}
            className="px-2 py-1 rounded-lg text-black/55 dark:text-stone-400 hover:text-black dark:hover:text-stone-200 transition cursor-pointer"
          >
            {t('bulkDelete.deselectAll') || 'Deselect all'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || selectedCount === 0}
          onClick={onDeleteSelected}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
        >
          <Trash2 size={13} />
          <span>
            {t('bulkDelete.deleteSelected', { count: selectedCount }) ||
              `Delete selected (${selectedCount})`}
          </span>
        </button>

        {onDeleteAll && selectableCount > 1 && (
          <button
            type="button"
            disabled={disabled || selectableCount === 0}
            onClick={onDeleteAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold transition disabled:opacity-40 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>{t('bulkDelete.deleteAll') || 'Delete all'}</span>
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={onToggleSelectionMode}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-light-200 dark:border-[#2e261e] text-xs font-medium text-black/65 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/70 dark:hover:bg-[#221c16] transition cursor-pointer"
        >
          <X size={13} />
          <span>{t('bulkDelete.exitSelectMode') || 'Cancel'}</span>
        </button>
      </div>
    </div>
  );
};

export default BulkSelectionToolbar;

