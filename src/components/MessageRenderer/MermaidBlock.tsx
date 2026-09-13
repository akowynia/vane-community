'use client';

import React, { useEffect, useId, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import CodeBlock from './CodeBlock';

interface MermaidBlockProps {
  chart: string;
}

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
    return (chart || '').trim();
  }, [chart]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const renderDiagram = async () => {
      if (!cleanChart) {
        setIsLoading(false);
        return;
      }

      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        // Use unique container ID to avoid colliding with other diagrams
        const uniqueRenderId = `${cleanId}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(
          uniqueRenderId,
          cleanChart,
        );

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[MermaidBlock] Failed to render mermaid chart:', err);
          setError(err?.message || 'Failed to render Mermaid diagram');
          setIsLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
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
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <CodeBlock language="mermaid">{cleanChart}</CodeBlock>
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
