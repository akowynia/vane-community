'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers,
  FileText,
  Columns,
  MessageSquare,
  Sparkles,
  Download,
  Share2,
  Printer,
  Quote,
  Eye,
  Edit3,
  Presentation as PresentationIcon,
  Check,
} from 'lucide-react';
import Markdown, { RuleType } from 'markdown-to-jsx';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import SlideChartRenderer, { GroundedChartData } from './SlideChartRenderer';
import SlideVisualRenderer, { VisualBlockData } from './SlideVisualRenderer';
import CodeBlock from '../MessageRenderer/CodeBlock';
import { exportPresentationToPptx } from '@/lib/presentation/exportPptx';

export interface ParsedSlide {
  id: number;
  rawContent: string;
  title: string;
  subtitle?: string;
  bodyMarkdown: string;
  charts: GroundedChartData[];
  visuals: VisualBlockData[];
  speakerNotes: string;
  citations: number[];
}

interface PresentationCanvasProps {
  content: string;
  title: string;
  theme?: string;
  sources?: any[];
  readOnly?: boolean;
  isGenerating?: boolean;
  onChangeContent?: (newContent: string) => void;
  onHoverCitation?: (sourceIndex: number | null) => void;
  hoveredSourceIndex?: number | null;
}

// Search research can surface dozens of results; raw citation indices like [69] or [66]
// are meaningless to a reader and rarely fit in the exported bibliography. This renumbers
// every citation (inline `[N]` and chart `sourceIndex` fields) to a compact, per-deck
// sequence based on first appearance, and returns the matching reordered source list.
const remapCitationsToLocalIndices = (
  rawContent: string,
  sources: any[],
): { content: string; citedSources: any[] } => {
  if (!rawContent || !Array.isArray(sources) || sources.length === 0) {
    return { content: rawContent, citedSources: [] };
  }

  const bracketRegex = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const sourceIndexRegex = /"sourceIndex"\s*:\s*(\d+)/g;

  const orderedOriginalIndices: number[] = [];
  const seen = new Set<number>();
  const registerIndex = (n: number) => {
    if (Number.isFinite(n) && n >= 1 && n <= sources.length && !seen.has(n)) {
      seen.add(n);
      orderedOriginalIndices.push(n);
    }
  };

  const matches: { index: number; nums: number[] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = bracketRegex.exec(rawContent)) !== null) {
    const nums = m[1].split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    matches.push({ index: m.index, nums });
  }
  while ((m = sourceIndexRegex.exec(rawContent)) !== null) {
    matches.push({ index: m.index, nums: [parseInt(m[1], 10)] });
  }
  matches.sort((a, b) => a.index - b.index);
  matches.forEach((mm) => mm.nums.forEach(registerIndex));

  if (orderedOriginalIndices.length === 0) {
    return { content: rawContent, citedSources: [] };
  }

  const oldToNew = new Map<number, number>();
  orderedOriginalIndices.forEach((orig, idx) => oldToNew.set(orig, idx + 1));

  let remapped = rawContent.replace(bracketRegex, (full, group) => {
    const newNums = group
      .split(',')
      .map((s: string) => s.trim())
      .map((n: string) => {
        const parsed = parseInt(n, 10);
        return oldToNew.has(parsed) ? String(oldToNew.get(parsed)) : n;
      });
    return `[${newNums.join(', ')}]`;
  });

  remapped = remapped.replace(sourceIndexRegex, (full, num) => {
    const parsed = parseInt(num, 10);
    const newNum = oldToNew.get(parsed);
    return `"sourceIndex": ${newNum !== undefined ? newNum : num}`;
  });

  const citedSources = orderedOriginalIndices.map((i) => sources[i - 1]);

  return { content: remapped, citedSources };
};

// A bare fence-language-tag-shaped line: lowercase identifier, no spaces/punctuation.
// Real bullets in this pipeline always start with "- **Bold:** ...", so a lone line like
// "table", "chart" or "bullet_summary" is never legitimate prose — it's the model dropping
// the ``` fence (or inventing a label) while still writing well-formed content below it.
const isBareLabelLine = (line: string): boolean => /^[a-z][a-z0-9_-]{2,40}$/.test(line.trim());

// Removes lines that are nothing but a stray fence-tag/label (e.g. a leftover "bullet_summary"
// or "table" with no fence and no JSON attached), leaving whatever real content follows intact.
const stripBareLabelLines = (text: string): string =>
  text
    .split('\n')
    .filter((line) => !isBareLabelLine(line))
    .join('\n');

// A JSON object matches one of our known content-block schemas (chart/table/cards/
// illustration) if it has the telltale array fields those schemas use — checked structurally
// rather than by its own "type" field, since the model sometimes mislabels it (e.g. tags a
// chart payload as "table").
const looksLikeStrayBlockJson = (obj: any): boolean =>
  !!obj &&
  typeof obj === 'object' &&
  (Array.isArray(obj.series) ||
    Array.isArray(obj.columns) ||
    Array.isArray(obj.rows) ||
    Array.isArray(obj.steps) ||
    Array.isArray(obj.cards) ||
    (typeof obj.type === 'string' && 'title' in obj && ('data' in obj || 'icon' in obj || 'badge' in obj)));

// Scans for any brace-balanced JSON object embedded in the text — whether it follows a bare
// tag line, is glued directly onto the end of a prose sentence with no separator at all, or
// sits anywhere else — and drops it if it looks like a chart/table/cards/illustration block.
// This is the general safety net: the model doesn't reliably wrap these blocks in ``` fences,
// so raw JSON can otherwise leak straight onto the slide as visible text.
const stripEmbeddedBlockJson = (text: string): string => {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') {
      result += text[i];
      i++;
      continue;
    }
    let depth = 0;
    let inString = false;
    let escaped = false;
    let j = i;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) { j++; break; }
      }
    }
    const span = text.slice(i, j);
    let matched = false;
    try {
      matched = looksLikeStrayBlockJson(JSON.parse(span));
    } catch {
      // Malformed/truncated JSON (cut off mid-object) is still worth dropping if it clearly
      // started as one of our block schemas — broken JSON on screen is worse than nothing.
      matched = /^\{\s*"type"\s*:\s*"(chart|bar|line|pie|doughnut|table|cards?|illustration|visual|infographic|vector_infographic)"/.test(span);
    }
    if (matched) {
      i = j;
      continue;
    }
    result += text[i];
    i++;
  }
  return result;
};

const stripStrayBlockTags = (text: string): string => stripBareLabelLines(stripEmbeddedBlockJson(text));

const THEME_STYLES: Record<
  string,
  {
    bgClass: string;
    cardClass: string;
    textClass: string;
    accentColor: string;
    headingClass: string;
  }
> = {
  'dark-modern': {
    bgClass: 'bg-[#0b0f17] text-slate-100',
    cardClass: 'bg-slate-900/60 border-slate-800',
    textClass: 'text-slate-300',
    accentColor: '#38bdf8',
    headingClass: 'text-white',
  },
  'minimal-light': {
    bgClass: 'bg-[#f8fafc] text-slate-900',
    cardClass: 'bg-white/80 border-slate-200',
    textClass: 'text-slate-600',
    accentColor: '#2563eb',
    headingClass: 'text-slate-950',
  },
  'cyber-tech': {
    bgClass: 'bg-[#050811] text-cyan-50',
    cardClass: 'bg-[#0b1329]/70 border-cyan-900/50',
    textClass: 'text-cyan-200/80',
    accentColor: '#06b6d4',
    headingClass: 'text-cyan-400',
  },
  'business-emerald': {
    bgClass: 'bg-[#03221a] text-emerald-50',
    cardClass: 'bg-[#063b2f]/70 border-emerald-800/50',
    textClass: 'text-emerald-200/80',
    accentColor: '#34d399',
    headingClass: 'text-emerald-300',
  },
  'warm-gold': {
    bgClass: 'bg-[#14120e] text-amber-50',
    cardClass: 'bg-[#211c15]/70 border-amber-900/40',
    textClass: 'text-amber-200/80',
    accentColor: '#f59e0b',
    headingClass: 'text-amber-400',
  },
};

export const PresentationCanvas: React.FC<PresentationCanvasProps> = ({
  content,
  title,
  theme = 'dark-modern',
  sources = [],
  readOnly = false,
  isGenerating = false,
  onChangeContent,
  onHoverCitation,
  hoveredSourceIndex = null,
}) => {
  const { t } = useTranslation();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'slides' | 'markdown' | 'split'>('slides');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [showFilmstrip, setShowFilmstrip] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeThemeStyle = THEME_STYLES[theme] || THEME_STYLES['dark-modern'];

  // Renumber raw research citation indices (which can run into the dozens) to a compact
  // per-deck sequence, and derive the matching source list for the bibliography/hover lookups.
  const { remappedContent, citedSources } = useMemo(() => {
    const cleanedContent = (content || '')
      .replace(/<presentation_update(?:\s+title="[^"]*")?>/gi, '')
      .replace(/<\/presentation_update>/gi, '')
      .replace(/<presentation_suggestions[\s\S]*?(?:<\/presentation_suggestions>|$)/gi, '')
      .replace(/<note_update(?:\s+title="[^"]*")?>/gi, '')
      .replace(/<\/note_update>/gi, '')
      .trim();

    if (!cleanedContent) {
      return { remappedContent: '', citedSources: [] as any[] };
    }

    const { content: remapped, citedSources: cited } = remapCitationsToLocalIndices(cleanedContent, sources);
    return { remappedContent: remapped, citedSources: cited };
  }, [content, sources]);

  // Parse remapped markdown into structured slides
  const slides: ParsedSlide[] = useMemo(() => {
    const cleanedContent = remappedContent;

    if (!cleanedContent) {
      const placeholderTitle = title || t('presentation.newPresentation') || 'New Presentation';
      const placeholderBody =
        t('presentation.generatingPlaceholder') ||
        'The presentation is being generated or is waiting for the plan to be approved...';
      return [
        {
          id: 1,
          rawContent: `# ${placeholderTitle}\n\n${placeholderBody}`,
          title: placeholderTitle,
          bodyMarkdown: placeholderBody,
          charts: [],
          visuals: [],
          speakerNotes: '',
          citations: [],
        },
      ];
    }

    const normalizedContent = cleanedContent.replace(/\r\n/g, '\n');

    // 1. Primary Split: By markdown horizontal rules (---, ***, ___)
    let rawChunks = normalizedContent
      .split(/(?:^|\n)\s*(?:---|___|\*\*\*)\s*(?:\n|$)/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    // 2. Fallback Split: If horizontal rules produced only 1 chunk but there are multiple '# ' headings, split by '# '
    if (rawChunks.length <= 1) {
      const topLevelHeadings = normalizedContent.match(/(?:^|\n)#\s+[^\n]+/g);
      if (topLevelHeadings && topLevelHeadings.length > 1) {
        const headingChunks = normalizedContent
          .split(/(?=(?:^|\n)#\s+)/)
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        if (headingChunks.length > 1) {
          rawChunks = headingChunks;
        }
      }
    }

    if (rawChunks.length === 0) {
      rawChunks.push(normalizedContent);
    }

    return rawChunks.map((chunk, idx) => {
      let raw = chunk;
      let speakerNotes = '';

      // Extract speaker notes <!-- speaker: ... -->
      const speakerMatch = raw.match(/<!--\s*speaker:\s*([\s\S]*?)-->/i);
      if (speakerMatch) {
        speakerNotes = speakerMatch[1]?.trim() || '';
        raw = raw.replace(/<!--\s*speaker:\s*[\s\S]*?-->/gi, '').trim();
      }

      // Extract charts ```chart ... ```
      // The generator prompt requires 2-6 data points per chart, but the model sometimes
      // violates this. A chart with 0-1 points renders as a broken/empty card, so fall back
      // to a plain bullet with the single value instead of showing it.
      const charts: GroundedChartData[] = [];
      const fallbackChartBullets: string[] = [];
      const chartRegex = /```(?:chart|chart-bar|chart-line|chart-pie|chart-doughnut)\s*([\s\S]*?)```/gi;
      let match;
      while ((match = chartRegex.exec(raw)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          const points = parsed?.series?.[0]?.data;
          if (Array.isArray(points) && points.length >= 2) {
            charts.push(parsed);
          } else if (Array.isArray(points) && points.length === 1) {
            const point = points[0];
            const citation = point.sourceIndex ? ` [${point.sourceIndex}]` : '';
            fallbackChartBullets.push(
              `- **${parsed.title || t('presentation.chartMetricFallback') || 'Metric'}:** ${point.label}: ${point.value}${citation}`,
            );
          }
        } catch {}
      }
      raw = raw.replace(chartRegex, '').trim();

      // Extract visual infographics ```illustration ... ```
      const visuals: VisualBlockData[] = [];
      const visualRegex = /```(?:illustration|visual|infographic)\s*([\s\S]*?)```/gi;
      while ((match = visualRegex.exec(raw)) !== null) {
        try {
          const parsed = JSON.parse(match[1]);
          visuals.push(parsed);
        } catch {}
      }
      raw = raw.replace(visualRegex, '').trim();

      // Extract cards blocks `cards { ... }` or ```cards ... ```
      const cardsRegex = /(?:```(?:cards|card)\s*([\s\S]*?)```|`cards\s*(\{[\s\S]*?\})`)/gi;
      let cardMatch;
      while ((cardMatch = cardsRegex.exec(raw)) !== null) {
        try {
          const jsonStr = cardMatch[1] || cardMatch[2];
          const parsed = JSON.parse(jsonStr);
          visuals.push({
            type: 'cards',
            title: parsed.title || t('presentation.cardsFallbackTitle') || 'Key Concepts',
            cards: parsed.cards || [],
          });
        } catch {}
      }
      raw = raw.replace(cardsRegex, '').trim();

      // Convert json table blocks `table { ... }` or ```table ... ``` into native markdown table
      const tableRegex = /(?:```table\s*([\s\S]*?)```|`table\s*(\{[\s\S]*?\})`)/gi;
      let tableMatch;
      while ((tableMatch = tableRegex.exec(raw)) !== null) {
        try {
          const jsonStr = tableMatch[1] || tableMatch[2];
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
            const cols: string[] = parsed.columns;
            const mdHeader = `| ${cols.join(' | ')} |\n| ${cols.map(() => '---').join(' | ')} |`;
            const mdRows = parsed.rows
              .map((r: any) => `| ${cols.map((c) => r[c] ?? '').join(' | ')} |`)
              .join('\n');
            const mdTable = `\n\n${mdHeader}\n${mdRows}\n\n`;
            raw = raw.replace(tableMatch[0], mdTable);
          } else {
            raw = raw.replace(tableMatch[0], '');
          }
        } catch {
          raw = raw.replace(tableMatch[0], '');
        }
      }

      // Extract Title (# Title) and Subtitle (## Subtitle)
      let slideTitle = (t('presentation.slideNumberLabel') || 'Slide {number}').replace(
        '{number}',
        String(idx + 1),
      );
      let subtitle: string | undefined = undefined;

      const titleMatch = raw.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        slideTitle = titleMatch[1].trim();
      }

      const subtitleMatch = raw.match(/^##\s+(.+)$/m);
      if (subtitleMatch) {
        subtitle = subtitleMatch[1].trim();
      }

      // Remove extracted headings from body
      let body = raw
        .replace(/^#\s+.+$/m, '')
        .replace(/^##\s+.+$/m, '')
        .trim();

      // Sanitize raw mermaid code blocks or ::: container blocks if present
      body = body
        .replace(/:::mermaid[\s\S]*?:::/gi, '')
        .replace(/```mermaid[\s\S]*?```/gi, '')
        .replace(/:::[a-zA-Z0-9_-]*/gi, '')
        .replace(/`cards\s*\{[\s\S]*?\}`/gi, '')
        .replace(/`table\s*\{[\s\S]*?\}`/gi, '')
        .trim();

      // Safety net: remove any chart/cards/table/illustration block that survived the
      // regex extraction above (e.g. the model omitted the ``` fence), so raw JSON never
      // leaks onto the slide as one bullet per line.
      body = stripStrayBlockTags(body).trim();

      if (fallbackChartBullets.length > 0) {
        body = `${body}\n${fallbackChartBullets.join('\n')}`.trim();
      }

      // Check if slideTitle is a generic placeholder like "Slide Title", "Slide Title 2", "Title"
      // (also matches legacy Polish placeholders from decks generated before this was localized).
      const isPlaceholderTitle = /^(?:slide\s*title|title|tytuł\s*slajdu|tytuł|slajd)\s*\d*$/i.test(
        slideTitle,
      );

      if (isPlaceholderTitle) {
        const firstBulletBold = body.match(/^[-*]\s+\*\*([^*]+)\*\*/m);
        if (firstBulletBold) {
          slideTitle = firstBulletBold[1].trim();
        } else if (subtitle) {
          slideTitle = subtitle;
          subtitle = undefined;
        } else {
          slideTitle =
            idx === 0
              ? title || t('presentation.introductionFallback') || 'Introduction'
              : (t('presentation.topicNumberFallback') || 'Topic {number}').replace(
                  '{number}',
                  String(idx + 1),
                );
        }
      }

      // Extract citations [1], [2]
      const citations: number[] = [];
      const citeRegex = /\[([\d,\s]+)\]/g;
      let cMatch;
      while ((cMatch = citeRegex.exec(body)) !== null) {
        const nums = cMatch[1].split(',').map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n));
        citations.push(...nums);
      }

      return {
        id: idx + 1,
        rawContent: chunk,
        title: slideTitle,
        subtitle,
        bodyMarkdown: body,
        charts,
        visuals,
        speakerNotes,
        citations: Array.from(new Set(citations)),
      };
    });
  }, [remappedContent, title]);

  const currentSlide = slides[activeSlideIndex] || slides[0];

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'slides' && !isFullscreen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        setActiveSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setActiveSlideIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'f' || e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, viewMode, isFullscreen]);

  // Adjust active index if count shrinks
  useEffect(() => {
    if (activeSlideIndex >= slides.length) {
      setActiveSlideIndex(Math.max(0, slides.length - 1));
    }
  }, [slides.length, activeSlideIndex]);

  const [isExportingPptx, setIsExportingPptx] = useState(false);

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'presentation'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('presentation.markdownExportSuccess') || 'Downloaded the presentation as Markdown');
  };

  const handleExportPptx = async () => {
    setIsExportingPptx(true);
    try {
      await exportPresentationToPptx({
        title,
        slides,
        theme,
        sources: citedSources,
        includeSpeakerNotes: true,
        includeSources: true,
      });
      toast.success(t('presentation.pptxExportSuccess') || 'Successfully exported PowerPoint presentation (.pptx)');
    } catch (err: any) {
      console.error('PPTX export error:', err);
      const errMsg = err?.message || err?.toString() || '';
      toast.error(
        errMsg
          ? (t('presentation.pptxExportErrorWithMessage') || 'Error generating the PPTX file: {message}').replace(
              '{message}',
              errMsg,
            )
          : t('presentation.pptxExportError') || 'Error generating the PPTX file.',
      );
    } finally {
      setIsExportingPptx(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col h-full w-full select-none ${
        isFullscreen ? 'fixed inset-0 z-50 bg-black p-4 sm:p-8' : ''
      }`}
    >
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-light-secondary/60 dark:bg-[#16120e]/80 backdrop-blur-md border-b border-light-200 dark:border-[#221c16] flex-shrink-0 z-10">
        {/* Left: View Mode Switches */}
        <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
          <button
            type="button"
            onClick={() => setViewMode('slides')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'slides'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <PresentationIcon className="w-3.5 h-3.5" />
            <span>{t('presentation.slidesView') || 'Slides'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'split'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{t('presentation.splitView') || 'Split'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('markdown')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              viewMode === 'markdown'
                ? 'bg-amber-500 text-stone-950 shadow-sm'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t('presentation.markdownView') || 'Code / Markdown'}</span>
          </button>
        </div>

        {/* Center: Slide Index / Navigation */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            disabled={activeSlideIndex === 0}
            onClick={() => setActiveSlideIndex((prev) => Math.max(prev - 1, 0))}
            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-30"
            title={t('presentation.previousSlide') || 'Previous slide'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
            {activeSlideIndex + 1} / {slides.length}
          </span>

          <button
            type="button"
            disabled={activeSlideIndex === slides.length - 1}
            onClick={() => setActiveSlideIndex((prev) => Math.min(prev + 1, slides.length - 1))}
            className="p-1.5 rounded-lg text-stone-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-30"
            title={t('presentation.nextSlide') || 'Next slide'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Speaker Notes Toggle */}
          <button
            type="button"
            onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition ${
              showSpeakerNotes
                ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-white/5'
            }`}
            title={t('presentation.speakerNotes') || 'Speaker Notes'}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('presentation.speakerNotes') || 'Notes'}</span>
          </button>

          {/* Export PPTX */}
          <button
            type="button"
            disabled={isExportingPptx}
            onClick={handleExportPptx}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-semibold transition disabled:opacity-50"
            title={t('presentation.exportPptx') || 'Download PowerPoint presentation (.pptx)'}
          >
            <PresentationIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isExportingPptx ? t('presentation.exporting') || 'Exporting...' : 'PPTX'}
            </span>
          </button>

          {/* Export Markdown */}
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-white/5 transition"
            title={t('presentation.exportSlidesMarkdown') || 'Export as Markdown'}
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl text-stone-400 hover:text-amber-500 hover:bg-white/5 transition"
            title={
              isFullscreen
                ? t('presentation.exitFullscreen') || 'Exit Fullscreen'
                : t('presentation.fullscreen') || 'Fullscreen (F11)'
            }
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Workspace View Container */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* SLIDE DECK RENDERER (16:9 Slide Canvas) */}
        {(viewMode === 'slides' || viewMode === 'split') && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto bg-stone-950/40 min-w-0">
            {/* 16:9 Aspect Ratio Slide Container */}
            <div
              className={`w-full max-w-5xl aspect-[16/9] rounded-2xl sm:rounded-3xl p-6 sm:p-10 shadow-2xl border flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${activeThemeStyle.bgClass} ${activeThemeStyle.cardClass}`}
              style={{
                boxShadow: `0 20px 50px -10px ${activeThemeStyle.accentColor}15`,
              }}
            >
              {/* Slide Background Subtle Radial Glow */}
              <div
                className="absolute -right-20 -top-20 w-80 h-80 rounded-full opacity-20 pointer-events-none blur-3xl"
                style={{ backgroundColor: activeThemeStyle.accentColor }}
              />

              {/* Slide Header */}
              <div className="relative z-10 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-[11px] font-mono font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full border border-white/10"
                    style={{ color: activeThemeStyle.accentColor }}
                  >
                    {(t('presentation.slideNumberLabel') || 'Slide {number}').replace(
                      '{number}',
                      String(activeSlideIndex + 1),
                    )}
                  </span>

                  {/* Sources tags on slide */}
                  {currentSlide.citations.length > 0 && (
                    <div className="flex items-center space-x-1.5">
                      {currentSlide.citations.map((c) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-stone-300 hover:bg-amber-500/30 cursor-pointer transition"
                          onMouseEnter={() => onHoverCitation && onHoverCitation(c)}
                          onMouseLeave={() => onHoverCitation && onHoverCitation(null)}
                        >
                          [{c}]
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <h2
                  className={`text-xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-snug line-clamp-2 ${activeThemeStyle.headingClass}`}
                >
                  {currentSlide.title}
                </h2>

                {currentSlide.subtitle && (
                  <h3 className="text-xs sm:text-base font-medium text-stone-300 mt-1 opacity-90 line-clamp-2">
                    {currentSlide.subtitle}
                  </h3>
                )}
              </div>

              {/* Slide Body Content & Interactive Visuals */}
              <div className="relative z-10 flex-1 my-2 sm:my-3 overflow-y-auto pr-1 select-text">
                {/* Visual Charts */}
                {currentSlide.charts.map((chart, cIdx) => (
                  <SlideChartRenderer
                    key={cIdx}
                    chartData={chart}
                    sources={citedSources}
                    onHoverSource={onHoverCitation}
                    accentColor={activeThemeStyle.accentColor}
                  />
                ))}

                {/* Visual Infographics */}
                {currentSlide.visuals.map((visual, vIdx) => (
                  <SlideVisualRenderer
                    key={vIdx}
                    data={visual}
                    accentColor={activeThemeStyle.accentColor}
                  />
                ))}

                {/* Markdown Prose / Bullet points */}
                {currentSlide.bodyMarkdown && (
                  <div
                    className={`prose prose-invert max-w-none text-xs sm:text-sm md:text-base leading-relaxed ${activeThemeStyle.textClass}`}
                  >
                    <Markdown
                      options={{
                        renderRule(next, node, renderChildren, state) {
                          if (node.type === RuleType.codeBlock) {
                            return (
                              <CodeBlock key={state.key} language={node.lang || ''}>
                                {node.text ?? ''}
                              </CodeBlock>
                            );
                          }
                          return next();
                        },
                        overrides: {
                          h1: () => null, // Suppress extra h1 in body
                          h2: () => null,
                          ul: {
                            props: {
                              className: 'space-y-1.5 sm:space-y-2 my-1.5 list-disc pl-5',
                            },
                          },
                          ol: {
                            props: {
                              className: 'space-y-1.5 sm:space-y-2 my-1.5 list-decimal pl-5',
                            },
                          },
                          li: {
                            props: {
                              className: 'leading-relaxed',
                            },
                          },
                          p: {
                            props: {
                              className: 'my-1.5 leading-relaxed',
                            },
                          },
                        },
                      }}
                    >
                      {currentSlide.bodyMarkdown}
                    </Markdown>
                  </div>
                )}
              </div>

              {/* Slide Footer */}
              <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
                <span className="font-semibold truncate max-w-xs">{title}</span>
                <span className="font-mono text-[11px] opacity-70">
                  {activeSlideIndex + 1} / {slides.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* RAW MARKDOWN EDITOR VIEW */}
        {(viewMode === 'markdown' || viewMode === 'split') && (
          <div className="flex-1 flex flex-col bg-light-primary dark:bg-[#120f0d] border-l border-light-200 dark:border-[#221c16] min-w-0">
            <div className="p-2 border-b border-light-200 dark:border-[#221c16] flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold">
                {t('presentation.markdownEditorHint') || 'Markdown (slides separated by `---`)'}
              </span>
              {isGenerating && (
                <span className="text-amber-500 font-semibold animate-pulse flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('presentation.aiUpdatingSlides') || 'AI is updating the slides...'}</span>
                </span>
              )}
            </div>
            <textarea
              readOnly={readOnly || isGenerating}
              value={content}
              onChange={(e) => onChangeContent && onChangeContent(e.target.value)}
              placeholder={t('presentation.markdownEditorPlaceholder') || 'Presentation content in Markdown...'}
              className="flex-1 w-full p-4 font-mono text-xs bg-transparent text-stone-800 dark:text-stone-200 focus:outline-none resize-none leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* Speaker Notes Drawer */}
      {showSpeakerNotes && currentSlide.speakerNotes && (
        <div className="px-6 py-4 bg-[#14100d] border-t border-amber-500/30 text-xs text-stone-300 flex items-start space-x-3 flex-shrink-0 animate-fadeIn shadow-2xl">
          <Quote className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-amber-500 uppercase tracking-wider block mb-1">
              {(t('presentation.speakerNotesForSlide') || 'Speaker Notes (Slide {number})').replace(
                '{number}',
                String(activeSlideIndex + 1),
              )}
            </span>
            <p className="leading-relaxed text-stone-200">{currentSlide.speakerNotes}</p>
          </div>
        </div>
      )}

      {/* Bottom Filmstrip / Thumbnails Bar */}
      {showFilmstrip && !isFullscreen && slides.length > 1 && (
        <div className="flex items-center space-x-2.5 px-4 py-3 bg-light-secondary/80 dark:bg-[#120f0d]/90 backdrop-blur-md border-t border-light-200 dark:border-[#221c16] overflow-x-auto flex-shrink-0 z-10">
          {slides.map((slide, idx) => {
            const isSelected = activeSlideIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                className={`flex-shrink-0 w-28 h-16 rounded-xl border p-2 text-left transition flex flex-col justify-between ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/20 shadow-md'
                    : 'border-light-200 dark:border-[#26201a] bg-light-primary dark:bg-[#181410] opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between text-[9px] font-mono font-bold text-amber-500">
                  <span>{idx + 1}</span>
                  {slide.charts.length > 0 && <span>📊</span>}
                </div>
                <span className="text-[10px] font-semibold text-stone-800 dark:text-stone-200 line-clamp-1">
                  {slide.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PresentationCanvas;
