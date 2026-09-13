'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';

import {
  buildNotePrintDocumentHtml,
  executeIframePrint,
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
  let res = markdown;
  // Clean citation tags
  res = res.replace(/<citation\b[^>]*>([\s\S]*?)<\/citation>/gi, '');
  // Clean citations followed by punctuation e.g. "tekst [10] ." -> "tekst." or "tekst [1, 2]," -> "tekst,"
  res = res.replace(/\s*\[[\d,\s]+\]\s*([.,!?;:])/g, '$1');
  // Clean isolated citations e.g. "tekst [10]" -> "tekst"
  res = res.replace(/\s*\[[\d,\s]+\]/g, '');
  return res;
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

  const handleCopyMarkdown = async () => {
    try {
      let finalContent = includeSources
        ? normalizeCitationsForMarkdown(content)
        : stripCitations(content);

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
    }
  };

  const handleDownloadMarkdown = () => {
    let finalContent = includeSources
      ? normalizeCitationsForMarkdown(content)
      : stripCitations(content);

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
    const filename = `${(title || 'note').toLowerCase().replace(/[^a-z0-9а-яążśźęćńółüöä-]/gi, '_')}.md`;
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
  };

  const handleDownloadTxt = () => {
    let textToClean = includeSources
      ? normalizeCitationsForMarkdown(content)
      : stripCitations(content);
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
    const filename = `${(title || 'note').toLowerCase().replace(/[^a-z0-9а-яążśźęćńółüöä-]/gi, '_')}.txt`;
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
  };

  const handlePrint = async () => {
    onClose();

    try {
      const fullHtml = await buildNotePrintDocumentHtml({
        title: title || t('scratchpad.untitled') || 'Untitled Note',
        content,
        sources,
        includeSources,
        locale,
        sourcesHeading: t('scratchpad.sourcesHeading') || 'Sources and References',
        untitledText: t('scratchpad.untitled') || 'Untitled Note',
        metaSubtitle: `Vane Scratchpad • ${title || t('scratchpad.untitled') || 'Untitled Note'}`,
      });

      executeIframePrint(fullHtml);
    } catch (err) {
      console.error('Failed to prepare document for printing:', err);
      toast.error(t('scratchpad.printError') || 'Failed to prepare the document for printing.');
    }
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                    <p className="text-xs text-stone-500">{title || t('scratchpad.untitled') || 'Untitled'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                  onClick={() => setIncludeSources(!includeSources)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
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

              <div className="grid grid-cols-1 gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Copy className="w-4 h-4 text-[#b8864d]" />
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

                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left"
                >
                  <div className="flex items-center space-x-3">
                    <FileCode className="w-4 h-4 text-blue-500" />
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

                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-stone-400" />
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

                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-light-200 dark:border-[#26201a] hover:border-[#b8864d] bg-light-secondary dark:bg-[#1a1613] transition group text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Printer className="w-4 h-4 text-emerald-500" />
                    <div>
                      <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 block">
                        {t('scratchpad.printPdf') || 'Print / Save as PDF'}
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {t('scratchpad.printPdfDesc') || 'Open browser print window'}
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

