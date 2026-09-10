'use client';

import React from 'react';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Sparkles,
  Search,
  Globe,
  File,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Chunk } from '@/lib/types';

interface ScratchpadSourcesPanelProps {
  sources: Chunk[];
  hoveredSourceIndex: number | null;
  onHoverSource: (index: number | null) => void;
  onSelectSource?: (index: number) => void;
}

const ScratchpadSourcesPanel: React.FC<ScratchpadSourcesPanelProps> = ({
  sources,
  hoveredSourceIndex,
  onHoverSource,
  onSelectSource,
}) => {
  const { t } = useTranslation();

  const getUrl = (source: Chunk) => source?.metadata?.url || '';
  const getTitle = (source: Chunk) => source?.metadata?.title || source?.metadata?.fileName || 'Untitled';
  const formatDomain = (url: string) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/.+\/\/|www.|\..+/g, '');
    }
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="p-6 text-center text-stone-400 dark:text-stone-500 flex flex-col items-center justify-center space-y-2">
        <div className="p-3 rounded-2xl bg-black/5 dark:bg-white/5 text-stone-400">
          <BookOpen className="w-5 h-5" />
        </div>
        <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
          {t('scratchpad.noSourcesInNote') || 'No sources in this note'}
        </p>
        <p className="text-[11px] text-stone-400 max-w-[200px]">
          {t('scratchpad.sourcesAutoCollected') || 'Sources will be collected automatically when AI searches the web.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2.5 p-3">
      {/* Header Info */}
      <div className="flex items-center justify-between px-1 pb-1 border-b border-light-200 dark:border-[#221c16]">
        <div className="flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          <BookOpen className="w-3.5 h-3.5 text-[#b8864d]" />
          <span>{t('scratchpad.sourcesPanelTitle') || 'Sources & Citations'}</span>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#b8864d]/15 text-[#b8864d]">
          {sources.length}
        </span>
      </div>

      <p className="text-[11px] text-stone-500 dark:text-stone-400 px-1">
        {t('scratchpad.hoverSourceHint') || 'Hover over a source to highlight the associated sentence in yellow.'}
      </p>

      {/* Sources List */}
      <div className="flex flex-col space-y-2 pt-1">
        {sources.map((source, index) => {
          const sourceNumber = index + 1;
          const url = getUrl(source);
          const title = getTitle(source);
          const domain = formatDomain(url);
          const isFile = !url || url.includes('file_id://') || url === 'File' || !url.startsWith('http');
          const isHovered = hoveredSourceIndex === sourceNumber;
          const snippet = source.content || '';

          return (
            <div
              key={url || index}
              onMouseEnter={() => onHoverSource(sourceNumber)}
              onMouseLeave={() => onHoverSource(null)}
              onClick={() => onSelectSource?.(sourceNumber)}
              className={`group p-3 rounded-xl border transition-all duration-200 cursor-pointer ${
                isHovered
                  ? 'bg-amber-500/15 dark:bg-amber-400/15 border-amber-400 dark:border-amber-500 ring-2 ring-amber-400/40 shadow-sm scale-[1.01]'
                  : 'bg-light-primary dark:bg-[#15110e] border-light-200 dark:border-[#26201a] hover:border-[#b8864d]/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
              }`}
            >
              {/* Card Header: Index Badge + Favicon/Domain + External Link */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center space-x-2 truncate">
                  {/* Number Badge */}
                  <span
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold shrink-0 transition-colors ${
                      isHovered
                        ? 'bg-amber-500 text-stone-950 shadow-sm'
                        : 'bg-[#b8864d]/20 text-[#b8864d]'
                    }`}
                  >
                    [{sourceNumber}]
                  </span>

                  {/* Favicon & Domain */}
                  <div className="flex items-center space-x-1.5 truncate">
                    {isFile ? (
                      <div className="w-4 h-4 rounded bg-stone-200 dark:bg-stone-800 flex items-center justify-center shrink-0">
                        <File className="w-2.5 h-2.5 text-stone-500" />
                      </div>
                    ) : (
                      <img
                        src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${encodeURIComponent(url)}`}
                        width={14}
                        height={14}
                        alt="icon"
                        className="rounded shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 truncate">
                      {isFile ? (t('chat.uploadedFile') || 'Uploaded File') : domain}
                    </span>
                  </div>
                </div>

                {/* External link button */}
                {url && !isFile && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={t('scratchpad.openSourceLink') || 'Open source in a new tab'}
                    className="p-1 rounded-md text-stone-400 hover:text-[#b8864d] hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Title */}
              <h5 className="text-xs font-semibold text-stone-800 dark:text-stone-200 leading-snug line-clamp-2 group-hover:text-[#b8864d] transition-colors">
                {title}
              </h5>

              {/* Content Snippet */}
              {snippet && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 line-clamp-3 leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-1.5 rounded-lg border border-black/5 dark:border-white/5">
                  {snippet}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScratchpadSourcesPanel;
