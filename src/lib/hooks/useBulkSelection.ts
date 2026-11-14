'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getId: (item: T) => string;
  canSelect?: (item: T) => boolean;
  disableEscape?: boolean;
}

/**
 * Manage multi-item selection mode, shift-range selection, and visible-item scoping.
 */
export function useBulkSelection<T>({
  items,
  getId,
  canSelect,
  disableEscape = false,
}: UseBulkSelectionOptions<T>) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  const selectableIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of items) {
      if (!canSelect || canSelect(item)) {
        ids.push(getId(item));
      }
    }
    return ids;
  }, [items, getId, canSelect]);

  const selectableIdSet = useMemo(
    () => new Set(selectableIds),
    [selectableIds],
  );

  // Scope active selections strictly to currently visible & selectable items
  // so filtered-out or unowned records are never deleted unintentionally.
  const activeSelectedIds = useMemo(
    () => selectableIds.filter((id) => selectedIds.has(id)),
    [selectableIds, selectedIds],
  );

  const activeSelectedSet = useMemo(
    () => new Set(activeSelectedIds),
    [activeSelectedIds],
  );

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        lastClickedIdRef.current = null;
        return false;
      }
      setSelectedIds(new Set());
      lastClickedIdRef.current = null;
      return true;
    });
  }, []);

  const toggleItem = useCallback(
    (id: string, shiftKey = false) => {
      if (!selectableIdSet.has(id)) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastClickedIdRef.current && selectableIdSet.has(lastClickedIdRef.current)) {
          const startIdx = selectableIds.indexOf(lastClickedIdRef.current);
          const endIdx = selectableIds.indexOf(id);
          if (startIdx !== -1 && endIdx !== -1) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            const shouldSelect = !prev.has(id);
            for (let i = from; i <= to; i++) {
              if (shouldSelect) {
                next.add(selectableIds[i]);
              } else {
                next.delete(selectableIds[i]);
              }
            }
            return next;
          }
        }

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });

      lastClickedIdRef.current = id;
    },
    [selectableIdSet, selectableIds],
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(selectableIds));
  }, [selectableIds]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedIdRef.current = null;
  }, []);

  // Automatically exit selection mode if no selectable items remain
  useEffect(() => {
    if (isSelectionMode && items.length === 0) {
      exitSelectionMode();
    }
  }, [isSelectionMode, items.length, exitSelectionMode]);

  // Allow Escape key to exit selection mode when no dialog is open
  useEffect(() => {
    if (!isSelectionMode || disableEscape) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        exitSelectionMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, disableEscape, exitSelectionMode]);

  return {
    isSelectionMode,
    selectedIds: activeSelectedSet,
    selectedIdsList: activeSelectedIds,
    selectedCount: activeSelectedIds.length,
    selectableIds,
    selectableCount: selectableIds.length,
    allSelected:
      selectableIds.length > 0 &&
      activeSelectedIds.length === selectableIds.length,
    someSelected:
      activeSelectedIds.length > 0 &&
      activeSelectedIds.length < selectableIds.length,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
    toggleItem,
    selectAll,
    deselectAll,
  };
}

