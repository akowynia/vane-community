'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Layers,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { BatchSection } from '@/lib/scratchpad/batchSections';

interface BatchQueryNavigatorProps {
  sections: BatchSection[];
  activeQueryIndex: number;
  onSelectQueryIndex: (index: number) => void;
  viewMode: 'queries' | 'full';
  onChangeViewMode: (mode: 'queries' | 'full') => void;
  isAiGenerating?: boolean;
}

const BatchQueryNavigator: React.FC<BatchQueryNavigatorProps> = ({
  sections,
  activeQueryIndex,
  onSelectQueryIndex,
  viewMode,
  onChangeViewMode,
  isAiGenerating = false,
}) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeSection = sections[activeQueryIndex] || sections[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const filteredSections = useMemo(() => {
    if (!searchFilter.trim()) return sections;
    const lower = searchFilter.toLowerCase().trim();
    return sections.filter(
      (s) =>
        s.number.toLowerCase().includes(lower) ||
        s.title.toLowerCase().includes(lower) ||
        s.body.toLowerCase().includes(lower),
    );
  }, [sections, searchFilter]);

  if (sections.length <= 1) {
    return null;
  }

  return (
    <div className="w-full px-3 py-2 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#16120f]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* View Mode Switcher: Query Studio vs Full Document */}
      <div className="flex items-center space-x-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => onChangeViewMode('queries')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-medium transition ${
            viewMode === 'queries'
              ? 'bg-light-primary dark:bg-[#1a1613] text-[#b8864d] shadow-sm'
              : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
          title={t('scratchpad.queryStudio') || 'Query Studio'}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{t('scratchpad.queryStudio') || 'Query Studio'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#b8864d]/15 text-[#b8864d] font-bold">
            {sections.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeViewMode('full')}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-medium transition ${
            viewMode === 'full'
              ? 'bg-light-primary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }`}
          title={t('scratchpad.fullDocument') || 'Full Document'}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t('scratchpad.fullDocument') || 'Full Document'}</span>
        </button>
      </div>

      {/* Query Selector & Step Controls (Shown in queries view) */}
      {viewMode === 'queries' && activeSection && (
        <div className="flex-1 flex items-center justify-end space-x-2 min-w-0" ref={dropdownRef}>
          {/* Previous Query Button */}
          <button
            type="button"
            disabled={activeQueryIndex <= 0 || isAiGenerating}
            onClick={() => onSelectQueryIndex(Math.max(0, activeQueryIndex - 1))}
            className="p-1.5 rounded-lg border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
            title="Previous Query"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Active Query Dropdown Anchor */}
          <div className="relative max-w-xs sm:max-w-md flex-1">
            <button
              type="button"
              disabled={isAiGenerating}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-2.5 py-1 rounded-xl border border-light-200 dark:border-[#26201a] bg-light-primary dark:bg-[#120f0d] text-stone-800 dark:text-stone-200 hover:border-[#b8864d]/50 transition truncate shadow-sm text-left"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <span className="font-mono font-semibold text-[#b8864d] shrink-0">
                  #{activeSection.number}
                </span>
                <span className="truncate">{activeSection.title}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 ml-1.5 shrink-0" />
            </button>

            {/* Dropdown Popover */}
            {isDropdownOpen && (
              <div className="absolute top-full mt-1.5 right-0 w-80 sm:w-96 max-h-80 bg-light-primary dark:bg-[#15110e] border border-light-200 dark:border-[#2a221b] rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden animate-fadeIn">
                <div className="p-2 border-b border-light-200 dark:border-[#221c16] flex items-center space-x-2 bg-black/[0.02] dark:bg-white/[0.02]">
                  <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={t('scratchpad.searchQueryPlaceholder') || 'Search questions / topics...'}
                    className="w-full bg-transparent text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto p-1 divide-y divide-light-200/40 dark:divide-[#221c16]/40">
                  {filteredSections.length === 0 ? (
                    <div className="p-4 text-center text-stone-400 text-xs">
                      No matching queries found.
                    </div>
                  ) : (
                    filteredSections.map((item) => {
                      const isSelected = item.index === activeQueryIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onSelectQueryIndex(item.index);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-xl flex items-start space-x-2 transition ${
                            isSelected
                              ? 'bg-[#b8864d]/15 text-[#b8864d] font-medium'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 shrink-0 text-[#b8864d] mt-0.5 font-bold">
                            #{item.number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-xs">{item.title}</div>
                            <div className="text-[10.5px] text-stone-400 truncate mt-0.5 opacity-80">
                              {item.body.slice(0, 70)}...
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#b8864d] shrink-0 mt-0.5" />}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="p-2 border-t border-light-200 dark:border-[#221c16] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-stone-400">
                  <span>
                    {sections.length} {t('scratchpad.queries') || 'queries'}
                  </span>
                  <span className="flex items-center space-x-1 text-[#b8864d]">
                    <Sparkles className="w-3 h-3" />
                    <span>AI Copilot Scoped</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Next Query Button */}
          <button
            type="button"
            disabled={activeQueryIndex >= sections.length - 1 || isAiGenerating}
            onClick={() => onSelectQueryIndex(Math.min(sections.length - 1, activeQueryIndex + 1))}
            className="p-1.5 rounded-lg border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition"
            title="Next Query"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BatchQueryNavigator;

