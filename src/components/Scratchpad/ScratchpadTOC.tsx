'use client';

import React, { useMemo } from 'react';
import { ListTree, Sparkles, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface TOCItem {
  id: string;
  text: string;
  level: number;
  raw: string;
}

interface ScratchpadTOCProps {
  content: string;
  onSelectHeading?: (headingText: string) => void;
  onAskAiForHeading?: (headingText: string) => void;
}

const ScratchpadTOC: React.FC<ScratchpadTOCProps> = ({
  content,
  onSelectHeading,
  onAskAiForHeading,
}) => {
  const { t } = useTranslation();

  const items = useMemo<TOCItem[]>(() => {
    if (!content) return [];
    const lines = content.split('\n');
    const headings: TOCItem[] = [];

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].replace(/[#*`_~]/g, '').trim();
        headings.push({
          id: `heading-${index}-${text.toLowerCase().replace(/\s+/g, '-')}`,
          text,
          level,
          raw: line,
        });
      }
    });

    return headings;
  }, [content]);

  if (items.length === 0) {
    return (
      <div className="p-4 text-xs text-stone-400 dark:text-stone-500 text-center italic">
        {t('scratchpad.tableOfContents') || 'Table of Contents'}: {t('scratchpad.noSketchesFound') || 'No notes found'}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-1.5 p-3">
      <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2 px-1">
        <ListTree className="w-3.5 h-3.5 text-[#b8864d]" />
        <span>{t('scratchpad.tableOfContents') || 'Table of Contents'}</span>
      </div>
      <div className="flex flex-col space-y-1">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className={`group flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-colors duration-150 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer ${
              item.level === 1
                ? 'font-medium text-stone-800 dark:text-stone-200'
                : item.level === 2
                  ? 'pl-4 text-stone-600 dark:text-stone-300'
                  : 'pl-6 text-stone-500 dark:text-stone-400'
            }`}
            onClick={() => onSelectHeading?.(item.text)}
          >
            <div className="flex items-center space-x-1.5 truncate">
              <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:text-[#b8864d] transition-opacity shrink-0" />
              <span className="truncate">{item.text}</span>
            </div>
            {onAskAiForHeading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAskAiForHeading(item.text);
                }}
                title={t('scratchpad.expandSection') || 'Expand section with AI'}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#b8864d]/20 text-[#b8864d] rounded shrink-0 ml-2"
              >
                <Sparkles className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScratchpadTOC;
