'use client';

import React from 'react';
import { Layers, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface BatchSearchTriggerProps {
  className?: string;
  onClick?: () => void;
  position?: 'top' | 'bottom';
  showLabel?: boolean;
}

export const BatchSearchTrigger: React.FC<BatchSearchTriggerProps> = ({
  className,
  onClick,
  position = 'bottom',
  showLabel = true,
}) => {
  const { t } = useTranslation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      window.dispatchEvent(new CustomEvent('open-batch-search'));
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={t('batchSearch.triggerTooltip') || 'Batch Search (CSV)'}
      className={cn(
        'group flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-light-200 dark:border-[#2a221b] bg-light-primary/60 dark:bg-[#1b1612]/60 hover:bg-[#b8864d]/10 dark:hover:bg-[#b8864d]/15 text-stone-600 dark:text-stone-300 hover:text-[#b8864d] dark:hover:text-[#b8864d] transition-all duration-200 text-xs font-medium focus:outline-none active:scale-95 shadow-sm',
        className,
      )}
    >
      <div className="relative">
        <Layers className="w-3.5 h-3.5 text-[#b8864d] group-hover:scale-110 transition-transform duration-200" />
        <span className="absolute -top-1 -right-1 flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#b8864d] opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#b8864d]" />
        </span>
      </div>
      {showLabel && (
        <span className="tracking-wide">
          {t('batchSearch.triggerBadge') || 'Batch'}
        </span>
      )}
    </button>
  );
};

export default BatchSearchTrigger;
