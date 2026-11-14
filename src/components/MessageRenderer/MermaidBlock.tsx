'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import { isThemeDark } from '@/lib/theme';

interface MermaidBlockProps {
  chart: string;
}

const cleanupStrayMermaidElements = (diagramId?: string) => {
  if (typeof document === 'undefined') return;
  try {
    const selectors = [
      '#error-svg',
      '[id^="dmermaid"]',
      diagramId ? `[id*="${diagramId}"]` : null,
    ].filter(Boolean) as string[];

    const stray = document.querySelectorAll(selectors.join(', '));
    stray.forEach((el) => {
      if (
        el.parentElement === document.body ||
        el.closest?.('body > [id^="dmermaid"]') ||
        el.closest?.('body > #error-svg')
      ) {
        el.remove();
      }
    });

    // Remove any direct child in document.body injected by Mermaid error handling
    document.body.querySelectorAll(':scope > svg, :scope > div').forEach((el) => {
      if (
        el.id?.startsWith('dmermaid') ||
        el.id?.startsWith('mermaid-') ||
        el.id === 'error-svg' ||
        el.textContent?.includes('Syntax error in text')
      ) {
        el.remove();
      }
    });
  } catch (err) {
    console.warn('[MermaidBlock] Error cleaning up stray DOM elements:', err);
  }
};

const MermaidBlock: React.FC<MermaidBlockProps> = ({ chart }) => {
  const { resolvedTheme } = useTheme();
  const rawId = useId();
  const cleanId = useMemo(
    () => `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [rawId],
  );

  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

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

    if (!cleanChart) {
      setIsLoading(false);
      setSvg('');
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const executeRender = async () => {
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
            cleanupStrayMermaidElements(cleanId);
            setError('Diagram syntax is incomplete or invalid');
            setIsLoading(false);
          }
          return;
        }

        // 2. Perform DOM render with an isolated unique identifier
        const uniqueRenderId = `${cleanId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const { svg: renderedSvg } = await mermaid.render(
          uniqueRenderId,
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

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.warn('[MermaidBlock] Failed to render mermaid chart:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to render Mermaid diagram');
          setIsLoading(false);
        }
      } finally {
        cleanupStrayMermaidElements(cleanId);
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
      cleanupStrayMermaidElements(cleanId);
    };
  }, [cleanChart, cleanId, resolvedTheme]);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(cleanChart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy mermaid source:', err);
    }
  };

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3">
        <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 mb-2">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertCircle size={14} />
            <span>Diagram Syntax View</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <pre className="p-3 rounded-lg bg-black/5 dark:bg-white/5 font-mono text-xs overflow-x-auto whitespace-pre text-stone-800 dark:text-stone-200 leading-relaxed">
          <code>{cleanChart}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-5 rounded-2xl border border-light-200 dark:border-[#2a241d] bg-light-primary dark:bg-[#14100c] shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-light-200/70 dark:border-[#26201a] bg-light-secondary/30 dark:bg-[#1c1611]/50 text-xs text-black/60 dark:text-white/60">
        <span className="font-semibold tracking-wide uppercase text-[11px] text-stone-600 dark:text-stone-400">
          Diagram
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy mermaid code"
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[11px]"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="p-4 overflow-x-auto flex justify-center items-center min-h-[100px]">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-stone-500 py-6">
            <RefreshCw size={14} className="animate-spin" />
            <span>Rendering diagram...</span>
          </div>
        ) : (
          <div
            className="mermaid-svg-container max-w-full [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:mx-auto"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );
};

export default MermaidBlock;
