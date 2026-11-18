'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Copy, AlertCircle, RefreshCw, Eye, Code } from 'lucide-react';
import { isThemeDark } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';

interface MermaidBlockProps {
  chart: string;
}

const cleanupStrayMermaidElements = (renderId?: string) => {
  if (typeof document === 'undefined') return;
  try {
    // 1. Remove rogue error-svg element if injected by Mermaid directly into document.body
    const errorSvg = document.getElementById('error-svg');
    if (errorSvg && errorSvg.parentElement === document.body) {
      errorSvg.remove();
    }

    // 2. Remove temporary measurement containers for this specific render instance
    if (renderId) {
      const tempContainer = document.getElementById(`d${renderId}`);
      if (tempContainer && tempContainer.parentElement === document.body) {
        tempContainer.remove();
      }

      const tempSvg = document.getElementById(renderId);
      if (tempSvg && tempSvg.parentElement === document.body) {
        tempSvg.remove();
      }

      // Safe cleanup of any lingering direct children strictly matching this renderId
      document.body
        .querySelectorAll(`:scope > [id^="d${renderId}"], :scope > [id^="${renderId}"]`)
        .forEach((el) => {
          if (el.parentElement === document.body) {
            el.remove();
          }
        });
    }
  } catch (err) {
    console.warn('[MermaidBlock] Error cleaning up stray DOM elements:', err);
  }
};

const MermaidBlock: React.FC<MermaidBlockProps> = ({ chart }) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const rawId = useId();
  const cleanId = useMemo(
    () => `vane-mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawId],
  );

  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [retryNonce, setRetryNonce] = useState<number>(0);

  const cleanChart = useMemo(() => {
    let cleaned = (chart || '').trim();
    if (cleaned.startsWith('```mermaid')) {
      cleaned = cleaned.replace(/^```mermaid\s*\n?/, '').replace(/\n?```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\w*\s*\n?/, '').replace(/\n?```$/, '');
    }
    cleaned = cleaned.trim();

    // Auto-repair common LLM Mermaid syntax issues
    // 1. Replace non-breaking spaces and hyphens with standard characters
    cleaned = cleaned.replace(/\u00A0/g, ' ').replace(/\u2011/g, '-');

    // 2. Quote unquoted subgraph titles: subgraph ID[Title] -> subgraph ID["Title"]
    cleaned = cleaned.replace(
      /(subgraph\s+[a-zA-Z0-9_-]+)\[([^"\]\r\n]+)\]/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}["${trimmed.replace(/"/g, "'")}"]`;
      },
    );

    // 3. Subroutine shapes [[...]] containing special characters
    cleaned = cleaned.replace(
      /(\b[a-zA-Z0-9_-]+)\[\[([^"\[\]\r\n]*[\(\)\/\\:–—\?,&%@][^"\[\]\r\n]*)\]\]/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}[["${trimmed.replace(/"/g, "'")}"]]`;
      },
    );

    // 4. Stadium shapes ([...]) containing special characters
    cleaned = cleaned.replace(
      /(\b[a-zA-Z0-9_-]+)\(\[([^"\[\]\(\)\r\n]*[\/\\:–—\?,&%@][^"\[\]\(\)\r\n]*)\]\)/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}(["${trimmed.replace(/"/g, "'")}"])`;
      },
    );

    // 5. Cylinder shapes [(...)] containing special characters
    cleaned = cleaned.replace(
      /(\b[a-zA-Z0-9_-]+)\[\(([^"\[\]\(\)\r\n]*[\/\\:–—\?,&%@][^"\[\]\(\)\r\n]*)\)\]/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}[("${trimmed.replace(/"/g, "'")}")]`;
      },
    );

    // 6. Circle shapes ((...)) containing special characters
    cleaned = cleaned.replace(
      /(\b[a-zA-Z0-9_-]+)\(\(([^"\(\)\r\n]*[\/\\:–—\?,&%@][^"\(\)\r\n]*)\)\)/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}(("${trimmed.replace(/"/g, "'")}"))`;
      },
    );

    // 7. Node labels in [...] containing parentheses, colons, slashes, backslashes, dashes, question marks, commas
    cleaned = cleaned.replace(
      /(\b[a-zA-Z0-9_-]+)\[([^"\[\]\r\n]*[\(\)\/\\:–—\?,&%@][^"\[\]\r\n]*)\]/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}["${trimmed.replace(/"/g, "'")}"]`;
      },
    );

    // 8. Node labels in {...} containing special characters
    cleaned = cleaned.replace(
      /(\b[a-zA-Z0-9_-]+)\{([^"\{\}\r\n]*[\(\)\/\\:–—\?,&%@][^"\{\}\r\n]*)\}/g,
      (match, id, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${id}{"${trimmed.replace(/"/g, "'")}"}`;
      },
    );

    // 9. Edge labels containing special characters: -->|label with info| -> -->|"label with info"|
    cleaned = cleaned.replace(
      /(-->|---\>|==>|-.->|\.->)\|([^"\|\r\n]*[\(\)\/\\:–—\?,&%@][^"\|\r\n]*)\|/g,
      (match, arrow, label) => {
        const trimmed = label.trim();
        return trimmed.startsWith('"') && trimmed.endsWith('"')
          ? match
          : `${arrow}|"${trimmed.replace(/"/g, "'")}"|`;
      },
    );

    return cleaned;
  }, [chart]);

  useEffect(() => {
    let isMounted = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let currentRenderId: string | null = null;

    if (!cleanChart) {
      setIsLoading(false);
      setSvg('');
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const executeRender = async () => {
      currentRenderId = `${cleanId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: isThemeDark(resolvedTheme) ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'inherit',
          suppressErrorRendering: true,
        });

        // 1. In-memory syntax validation without DOM side effects
        let isValid = false;
        try {
          const parseResult = await mermaid.parse(cleanChart, {
            suppressErrors: true,
          });
          isValid = Boolean(parseResult);
        } catch {
          isValid = false;
        }

        if (!isValid) {
          if (isMounted) {
            cleanupStrayMermaidElements(currentRenderId);
            setError(t('diagram.syntaxError') || 'Diagram syntax is incomplete or invalid');
            setIsLoading(false);
          }
          return;
        }

        // 2. Perform DOM render with an isolated unique identifier
        const { svg: renderedSvg } = await mermaid.render(
          currentRenderId,
          cleanChart,
        );

        if (
          !renderedSvg ||
          renderedSvg.includes('Syntax error in text') ||
          renderedSvg.includes('id="error-svg"') ||
          renderedSvg.includes('class="error-icon"')
        ) {
          throw new Error('Mermaid returned syntax error SVG');
        }

        // 3. Security verification: prevent script injection in SVG
        if (renderedSvg.includes('<script') || /on\w+\s*=/i.test(renderedSvg)) {
          throw new Error('Unsafe content detected in SVG diagram');
        }

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.warn('[MermaidBlock] Failed to render mermaid chart:', err);
        if (isMounted) {
          setError(err?.message || (t('diagram.renderError') || 'Failed to render Mermaid diagram'));
          setIsLoading(false);
        }
      } finally {
        if (currentRenderId) {
          cleanupStrayMermaidElements(currentRenderId);
        }
      }
    };

    // Debounce rendering to avoid concurrent race conditions during LLM streaming
    debounceTimer = setTimeout(() => {
      executeRender();
    }, 250);

    return () => {
      isMounted = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (currentRenderId) {
        cleanupStrayMermaidElements(currentRenderId);
      }
    };
  }, [cleanChart, cleanId, resolvedTheme, retryNonce, t]);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(cleanChart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy mermaid source:', err);
    }
  };

  return (
    <div className="my-5 rounded-2xl border border-light-200 dark:border-[#2a241d] bg-light-primary dark:bg-[#14100c] shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-light-200/70 dark:border-[#26201a] bg-light-secondary/30 dark:bg-[#1c1611]/50 text-xs text-black/60 dark:text-white/60">
        {/* Left: Badge & Tabs */}
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide uppercase text-[11px] text-stone-600 dark:text-stone-400 mr-1">
            {t('diagram.diagram') || 'Diagram'}
          </span>
          <div className="inline-flex rounded-lg bg-black/5 dark:bg-white/5 p-0.5 border border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              aria-label="View rendered diagram"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-[#251e17] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              }`}
            >
              <Eye size={12} />
              <span>{t('diagram.preview') || 'Preview'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              aria-label="View diagram source code"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                activeTab === 'code'
                  ? 'bg-white dark:bg-[#251e17] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              }`}
            >
              <Code size={12} />
              <span>{t('diagram.code') || 'Code'}</span>
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {error && activeTab === 'preview' && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                setRetryNonce((prev) => prev + 1);
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition-colors"
              title={t('diagram.retry') || 'Retry'}
            >
              <RefreshCw size={12} />
              <span>{t('diagram.retry') || 'Retry'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy mermaid code"
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[11px]"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-500" />
                <span className="text-emerald-500">{t('diagram.copied') || 'Copied!'}</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>{t('diagram.copy') || 'Copy'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {activeTab === 'preview' ? (
        <div className="p-4 overflow-x-auto flex justify-center items-center min-h-[100px]">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-stone-500 py-6">
              <RefreshCw size={14} className="animate-spin" />
              <span>{t('diagram.rendering') || 'Rendering diagram...'}</span>
            </div>
          ) : error ? (
            <div className="w-full rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3 my-1">
              <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 mb-2">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setIsLoading(true);
                    setRetryNonce((prev) => prev + 1);
                  }}
                  className="flex items-center gap-1 hover:text-amber-900 dark:hover:text-amber-200 transition-colors font-medium"
                >
                  <RefreshCw size={12} />
                  <span>{t('diagram.retry') || 'Retry'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-black/5 dark:bg-white/5 font-mono text-xs overflow-x-auto whitespace-pre text-stone-800 dark:text-stone-200 leading-relaxed border border-black/5 dark:border-white/5">
                <code>{cleanChart}</code>
              </pre>
            </div>
          ) : (
            <div
              className="mermaid-svg-container max-w-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      ) : (
        <div className="p-3">
          <pre className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 font-mono text-xs overflow-x-auto whitespace-pre text-stone-800 dark:text-stone-200 leading-relaxed border border-black/5 dark:border-white/5">
            <code>{cleanChart}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default MermaidBlock;
