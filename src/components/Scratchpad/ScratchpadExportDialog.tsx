import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  Download,
  Copy,
  Printer,
  FileCode,
  FileText,
  X,
  BookOpen,
  Loader2,
  Globe,
  Layers,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';

import {
  buildNotePrintDocumentHtml,
  executeIframePrint,
  downloadPrintDocumentHtml,
} from '@/lib/utils/printExport';

interface ScratchpadExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  sources?: any[];
  isPresentation?: boolean;
  theme?: string;
}

const stripCitations = (markdown: string): string => {
  if (!markdown) return '';
  const lines = markdown.split('\n');
  return lines
    .map((line) => {
      // Do not strip numbering from headings such as "# Question [1]"
      if (line.trim().startsWith('#')) {
        return line.replace(/<citation\b[^>]*>([\s\S]*?)<\/citation>/gi, '');
      }
      let res = line.replace(/<citation\b[^>]*>([\s\S]*?)<\/citation>/gi, '');
      res = res.replace(/\s*\[[\d,\s]+\]\s*([.,!?;:])/g, '$1');
      res = res.replace(/(?<![a-zA-Z0-9_-])\[[\d,\s]+\]/g, '');
      return res;
    })
    .join('\n');
};

const normalizeCitationsForMarkdown = (markdown: string): string => {
  if (!markdown) return '';
  return markdown.replace(
    /<citation\b([^>]*)>([\s\S]*?)<\/citation>/gi,
    (_, rawAttrs, content) => {
      const num = content.trim();
      const hrefMatch = rawAttrs.match(/href="([^"]*)"/i);
      const href = hrefMatch ? hrefMatch[1].trim() : '';
      return href && href.startsWith('http') ? `[${num}](${href})` : `[${num}]`;
    },
  );
};

const ScratchpadExportDialog: React.FC<ScratchpadExportDialogProps> = ({
  isOpen,
  onClose,
  title,
  content,
  sources = [],
  isPresentation = false,
  theme = 'dark-modern',
}) => {
  const { t, locale } = useTranslation();
  const [includeSources, setIncludeSources] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [batchRange, setBatchRange] = useState<string>('all');

  // Detect separate query/note sections for bulk batch documents
  const documentSections = useMemo(() => {
    if (!content) return [];
    const parts = content.split(/\n\s*---\s*\n/).filter((p) => p.trim());
    return parts;
  }, [content]);

  const hasManySections = documentSections.length > 25;

  const getSelectedContent = (): string => {
    if (!hasManySections || batchRange === 'all') {
      return content;
    }
    const [startStr, endStr] = batchRange.split('-');
    const start = Math.max(0, parseInt(startStr, 10) - 1);
    const end = Math.min(documentSections.length, parseInt(endStr, 10));
    return documentSections.slice(start, end).join('\n\n---\n\n');
  };

  const handleCopyMarkdown = async () => {
    setIsExporting(true);
    setActiveAction('copy');
    try {
      const targetContent = getSelectedContent();
      let finalContent = includeSources
        ? normalizeCitationsForMarkdown(targetContent)
        : stripCitations(targetContent);

      if (includeSources && sources && sources.length > 0) {
        finalContent +=
          `\n\n---\n\n## ${t('scratchpad.sourcesHeading') || 'Sources and References'}\n\n` +
          sources
            .map((s, i) => {
              const url = s?.metadata?.url || '';
              const sourceTitle =
                s?.metadata?.title || s?.metadata?.fileName || `Source [${i + 1}]`;
              const snippet = s?.pageContent || s?.metadata?.snippet || '';
              let line = `[${i + 1}] [${sourceTitle}](${url || '#'})`;
              if (snippet) line += `\n> ${snippet.slice(0, 200).replace(/\n/g, ' ')}`;
              return line;
            })
            .join('\n\n');
      }
      await navigator.clipboard.writeText(finalContent);
      toast.success(t('scratchpad.copiedSuccess') || 'Copied content to clipboard!');
      onClose();
    } catch {
      toast.error(t('scratchpad.copyError') || 'Failed to copy to clipboard.');
    } finally {
      setIsExporting(false);
      setActiveAction(null);
    }
  };

  const handleDownloadMarkdown = () => {
    setIsExporting(true);
    setActiveAction('md');
    try {
      const targetContent = getSelectedContent();
      let finalContent = includeSources
        ? normalizeCitationsForMarkdown(targetContent)
        : stripCitations(targetContent);

      if (includeSources && sources && sources.length > 0) {
        finalContent +=
          `\n\n---\n\n## ${t('scratchpad.sourcesHeading') || 'Sources and References'}\n\n` +
          sources
            .map((s, i) => {
              const url = s?.metadata?.url || '';
              const sourceTitle =
                s?.metadata?.title || s?.metadata?.fileName || `Source [${i + 1}]`;
              const snippet = s?.pageContent || s?.metadata?.snippet || '';
              let line = `[${i + 1}] [${sourceTitle}](${url || '#'})`;
              if (snippet) line += `\n> ${snippet.slice(0, 200).replace(/\n/g, ' ')}`;
              return line;
            })
            .join('\n\n');
      }
      const rangeSuffix = batchRange !== 'all' ? `_part_${batchRange}` : '';
      const filename = `${(title || 'note').toLowerCase().replace(/[^a-z0-9а-яążśźęćńółüöä-]/gi, '_')}${rangeSuffix}.md`;
      const blob = new Blob([finalContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('scratchpad.downloadMarkdownSuccess') || 'Markdown file downloaded.');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download Markdown file.');
    } finally {
      setIsExporting(false);
      setActiveAction(null);
    }
  };

  const handleDownloadTxt = () => {
    setIsExporting(true);
    setActiveAction('txt');
    try {
      const targetContent = getSelectedContent();
      let textToClean = includeSources
        ? normalizeCitationsForMarkdown(targetContent)
        : stripCitations(targetContent);
      let cleanText = textToClean
        .replace(/[#*`_~]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

      if (includeSources && sources && sources.length > 0) {
        cleanText +=
          `\n\n===============================\n${t('scratchpad.sourcesHeading') || 'Sources and References'}\n===============================\n\n` +
          sources
            .map((s, i) => {
              const url = s?.metadata?.url || '';
              const sourceTitle =
                s?.metadata?.title || s?.metadata?.fileName || `Source [${i + 1}]`;
              return `[${i + 1}] ${sourceTitle} ${url ? `(${url})` : ''}`;
            })
            .join('\n');
      }
      const rangeSuffix = batchRange !== 'all' ? `_part_${batchRange}` : '';
      const filename = `${(title || 'note').toLowerCase().replace(/[^a-z0-9а-яążśźęćńółüöä-]/gi, '_')}${rangeSuffix}.txt`;
      const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('scratchpad.downloadTxtSuccess') || 'Text file downloaded.');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download text file.');
    } finally {
      setIsExporting(false);
      setActiveAction(null);
    }
  };

  const handleDownloadHtml = async () => {
    setIsExporting(true);
    setActiveAction('html');
    try {
      const targetContent = getSelectedContent();
      const rangeSuffix = batchRange !== 'all' ? ` (Part ${batchRange})` : '';
      const fullHtml = await buildNotePrintDocumentHtml({
        title: (title || t('scratchpad.untitled') || 'Untitled Note') + rangeSuffix,
        content: targetContent,
        sources,
        includeSources,
        locale,
        sourcesHeading: t('scratchpad.sourcesHeading') || 'Sources and References',
        untitledText: t('scratchpad.untitled') || 'Untitled Note',
        metaSubtitle: `Vane Scratchpad • ${title || t('scratchpad.untitled') || 'Untitled Note'}`,
      });

      const fileRangeSuffix = batchRange !== 'all' ? `_part_${batchRange}` : '';
      const filename = `${(title || 'note').toLowerCase().replace(/[^a-z0-9а-яążśźęćńółüöä-]/gi, '_')}${fileRangeSuffix}.html`;
      downloadPrintDocumentHtml(fullHtml, filename);
      toast.success(t('scratchpad.downloadHtmlSuccess') || 'HTML report downloaded successfully.');
      onClose();
    } catch (err: any) {
      console.error('Failed to prepare HTML report:', err);
      toast.error(t('scratchpad.htmlExportError') || 'Failed to generate HTML report.');
    } finally {
      setIsExporting(false);
      setActiveAction(null);
    }
  };

  const handlePrint = async () => {
    setIsExporting(true);
    setActiveAction('print');

    try {
      const targetContent = getSelectedContent();
      const rangeSuffix = batchRange !== 'all' ? ` (Part ${batchRange})` : '';
      const fullHtml = await buildNotePrintDocumentHtml({
        title: (title || t('scratchpad.untitled') || 'Untitled Note') + rangeSuffix,
        content: targetContent,
        sources,
        includeSources,
        locale,
        sourcesHeading: t('scratchpad.sourcesHeading') || 'Sources and References',
        untitledText: t('scratchpad.untitled') || 'Untitled Note',
        metaSubtitle: `Vane Scratchpad • ${title || t('scratchpad.untitled') || 'Untitled Note'}`,
      });

      const initiated = await executeIframePrint(fullHtml);
      if (initiated) {
        toast.success(t('scratchpad.printInitiated') || 'Print dialog opened.');
        onClose();
      } else {
        toast.error(t('scratchpad.printError') || 'Failed to prepare the document for printing.');
      }
    } catch (err) {
      console.error('Failed to prepare document for printing:', err);
      toast.error(t('scratchpad.printError') || 'Failed to prepare the document for printing.');
    } finally {
      setIsExporting(false);
      setActiveAction(null);
    }
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={isExporting ? () => {} : onClose}>
        <TransitionChild
          as={React.Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 flex items-center justify-center">
          <TransitionChild
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#2a241d] text-left shadow-2xl transition-all w-full max-w-md p-6">
              <div className="flex items-center justify-between pb-4 border-b border-light-200 dark:border-[#221c16]">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-[#b8864d]/10 text-[#b8864d]">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle as="h3" className="text-base font-semibold text-stone-900 dark:text-stone-100">
                      {t('scratchpad.exportNote') || 'Export note'}
                    </DialogTitle>
                    <p className="text-xs text-stone-500 truncate max-w-[240px]">
                      {title || t('scratchpad.untitled') || 'Untitled'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg transition disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Large Document Batch Range Selector */}
              {hasManySections && (
                <div className="mt-4 p-3 rounded-xl border border-[#b8864d]/30 bg-[#b8864d]/10 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-stone-900 dark:text-stone-100">
                    <Layers className="w-4 h-4 text-[#b8864d]" />
                    <span>
                      {t('scratchpad.largeDocNotice') || 'Large Research Document'} ({documentSections.length} {t('scratchpad.sectionsCount') || 'sections'})
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-400">
                    {t('scratchpad.largeDocNoticeDesc') || 'To prevent browser print dialog lag on large datasets, you can export all or select specific section ranges:'}
                  </p>
                  <select
                    value={batchRange}
                    onChange={(e) => setBatchRange(e.target.value)}
                    disabled={isExporting}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-light-primary dark:bg-[#1a1511] border border-light-300 dark:border-[#382b20] text-xs font-medium text-stone-800 dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                  >
                    <option value="all">
                      {t('scratchpad.exportAllSections') || 'All Sections'} ({documentSections.length} {t('scratchpad.itemsCount') || 'items'})
                    </option>
                    <option value="1-50">
                      {t('scratchpad.exportRangePart1') || 'Part 1: Sections 1 - 50'}
                    </option>
                    {documentSections.length > 50 && (
                      <option value="51-100">
                        {t('scratchpad.exportRangePart2') || 'Part 2: Sections 51 - 100'}
                      </option>
                    )}
                    {documentSections.length > 100 && (
                      <option value={`101-${documentSections.length}`}>
                        {t('scratchpad.exportRangePart3') || `Part 3: Sections 101 - ${documentSections.length}`}
                      </option>
                    )}
                  </select>
                </div>
              )}

              {/* Sources & Citations Toggle Option */}
              <div className="mt-4 p-3 rounded-xl border border-light-200 dark:border-[#26201a] bg-light-secondary/60 dark:bg-[#181411]/60 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 pr-2">
                  <BookOpen className="w-4 h-4 text-[#b8864d] shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                      {t('scratchpad.includeSourcesOption') || 'Include sources and citations'}
                    </span>
                    <span className="text-[11px] text-stone-500 block leading-tight">
                      {includeSources
                        ? (t('scratchpad.includeSourcesOptionDesc') || 'Numeric citations in text and references section at the end')
                        : (t('scratchpad.excludeSourcesOptionDesc') || 'Clean text without [number] tags and without sources list')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => setIncludeSources(!includeSources)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                    includeSources ? 'bg-[#b8864d]' : 'bg-stone-300 dark:bg-stone-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      includeSources ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Export Buttons List */}
              <div className="grid grid-cols-1 gap-2.5 pt-4">
                {/* Print / Save as PDF */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handlePrint}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left disabled:opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {isExporting && activeAction === 'print' ? (
                      <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 text-emerald-500" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                        {t('scratchpad.printPdf') || 'Print / Save as PDF'}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {isExporting && activeAction === 'print'
                          ? (t('scratchpad.preparingPrint') || 'Preparing document for printing...')
                          : (t('scratchpad.printPdfDesc') || 'Open browser print window')}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Download Standalone HTML */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownloadHtml}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left disabled:opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {isExporting && activeAction === 'html' ? (
                      <Loader2 className="w-4 h-4 text-[#b8864d] animate-spin" />
                    ) : (
                      <Globe className="w-4 h-4 text-[#b8864d]" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                        {t('scratchpad.downloadHtml') || 'Download HTML Report (.html)'}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {isExporting && activeAction === 'html'
                          ? (t('scratchpad.generatingReport') || 'Generating formatted report...')
                          : (t('scratchpad.downloadHtmlDesc') || 'Standalone styled HTML file, ideal for large reports')}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Download Markdown (.md) */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownloadMarkdown}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left disabled:opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {isExporting && activeAction === 'md' ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    ) : (
                      <FileCode className="w-4 h-4 text-blue-500" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                        {t('scratchpad.exportMarkdown') || 'Download Markdown (.md)'}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {t('scratchpad.exportMarkdownDesc') || 'Raw Markdown file with formatting'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Download Text (.txt) */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleDownloadTxt}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left disabled:opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {isExporting && activeAction === 'txt' ? (
                      <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 text-stone-400" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                        {t('scratchpad.exportTxt') || 'Download Text (.txt)'}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {t('scratchpad.exportTxtDesc') || 'Plain text without Markdown syntax'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Copy Markdown */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleCopyMarkdown}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left disabled:opacity-60"
                >
                  <div className="flex items-center space-x-3">
                    {isExporting && activeAction === 'copy' ? (
                      <Loader2 className="w-4 h-4 text-[#b8864d] animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4 text-[#b8864d]" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                        {t('scratchpad.copyMarkdown') || 'Copy Markdown'}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {t('scratchpad.copyMarkdownDesc') || 'Copy full Markdown content to clipboard'}
                      </span>
                    </div>
                  </div>
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ScratchpadExportDialog;

