'use client';

import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ExternalLink, FileText } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface CitationProps {
  href?: string;
  title?: string;
  hoveredSourceIndex?: number | null;
  onHoverCitation?: (sourceIndex: number | null) => void;
  children: React.ReactNode;
}

const Citation: React.FC<CitationProps> = ({
  href = '',
  title,
  hoveredSourceIndex,
  onHoverCitation,
  children,
}) => {
  const { t } = useTranslation();

  // Extract clean URL if formatted as [http...](http...)
  const cleanHref = React.useMemo(() => {
    if (!href) return '';
    const match = href.match(/https?:\/\/[^\s)\]]+/);
    return match ? match[0] : href.trim();
  }, [href]);

  // Determine numeric source index
  const resolvedIndex = React.useMemo(() => {
    if (typeof children === 'string' || typeof children === 'number') {
      const parsed = parseInt(String(children).replace(/[^\d]/g, ''), 10);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  }, [children]);

  const isHighlighted =
    resolvedIndex !== null &&
    hoveredSourceIndex !== null &&
    hoveredSourceIndex !== undefined &&
    hoveredSourceIndex === resolvedIndex;

  const isFile =
    !cleanHref ||
    cleanHref === 'File' ||
    cleanHref.startsWith('file_id://') ||
    !cleanHref.startsWith('http');

  const cleanDomain = React.useMemo(() => {
    if (!cleanHref || isFile) return '';
    try {
      return new URL(cleanHref).hostname.replace(/^www\./, '');
    } catch {
      return cleanHref.replace(/.+\/\/|www.|\..+/g, '');
    }
  }, [cleanHref, isFile]);

  const displayTitle =
    title || (isFile ? t('chat.citationAttachedFile') || 'Attached file' : cleanDomain || cleanHref);

  const handleMouseEnter = () => {
    if (resolvedIndex !== null && onHoverCitation) {
      onHoverCitation(resolvedIndex);
    }
  };

  const handleMouseLeave = () => {
    if (onHoverCitation) {
      onHoverCitation(null);
    }
  };

  const badgeContent = (
    <span
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-4.5 px-1.5 rounded-md text-[11px] font-semibold align-super cursor-pointer transition-all duration-150 select-none ml-0.5',
        isHighlighted
          ? 'bg-amber-400 text-stone-950 ring-2 ring-amber-500 scale-110 shadow-sm font-extrabold'
          : 'bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white border border-light-200/80 dark:border-dark-200/80'
      )}
    >
      {children}
    </span>
  );

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {isFile ? (
            badgeContent
          ) : (
            <a
              href={cleanHref}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline inline-block"
            >
              {badgeContent}
            </a>
          )}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            align="center"
            sideOffset={6}
            className="z-50 max-w-sm w-72 rounded-xl bg-light-primary dark:bg-[#181410] p-3 shadow-xl border border-light-200 dark:border-[#2f271f] text-left text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {/* Header: Badge + Title + External link icon */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 truncate">
                {resolvedIndex !== null && (
                  <span className="inline-flex items-center justify-center w-4.5 h-4.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold shrink-0 px-1">
                    [{resolvedIndex}]
                  </span>
                )}
                <span className="font-semibold text-stone-900 dark:text-stone-100 truncate text-xs">
                  {displayTitle}
                </span>
              </div>
              {!isFile && (
                <ExternalLink
                  size={13}
                  className="shrink-0 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors mt-0.5"
                />
              )}
            </div>

            {/* Meta info: Domain / File */}
            <div className="flex items-center gap-2 text-[11px] text-stone-500 dark:text-stone-400">
              {cleanDomain ? (
                <span>{cleanDomain}</span>
              ) : (
                <span className="flex items-center gap-1">
                  <FileText size={11} />
                  <span>{isFile ? 'Document' : 'Web Reference'}</span>
                </span>
              )}
            </div>

            <Tooltip.Arrow className="fill-light-primary dark:fill-[#181410]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
};

export default Citation;

