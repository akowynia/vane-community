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

interface ScratchpadExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  sources?: any[];
  isPresentation?: boolean;
  theme?: string;
}

const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatDomain = (url: string) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/.+\/\/|www.|\..+/g, '');
  }
};

const stripCitations = (markdown: string): string => {
  if (!markdown) return '';
  let res = markdown;
  // Clean citations followed by punctuation e.g. "tekst [10] ." -> "tekst." or "tekst [1, 2]," -> "tekst,"
  res = res.replace(/\s*\[[\d,\s]+\]\s*([.,!?;:])/g, '$1');
  // Clean isolated citations e.g. "tekst [10]" -> "tekst"
  res = res.replace(/\s*\[[\d,\s]+\]/g, '');
  return res;
};

const formatInlineMarkdown = (text: string, includeSources: boolean): string => {
  let clean = text;
  if (!includeSources) {
    clean = stripCitations(clean);
  }

  let res = escapeHtml(clean);

  // Bold & Italic
  res = res.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');
  res = res.replace(/\*(.*?)\*/g, '<em>$1</em>');
  res = res.replace(/_([^_]+)_/g, '<em>$1</em>');
  res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Inline Code
  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links
  res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Citations [1], [2] if enabled
  if (includeSources) {
    res = res.replace(/\s*\[([\d,\s]+)\]\s*([.,!?;:])/g, '<sup class="citation">[$1]</sup>$2');
    res = res.replace(/\[([\d,\s]+)\]/g, '<sup class="citation">[$1]</sup>');
  }

  return res;
};

const convertMarkdownToPrintHtml = (
  markdown: string,
  includeSources: boolean,
  sources?: any[],
  sourcesHeadingText?: string,
): string => {
  const textToRender = includeSources ? markdown : stripCitations(markdown);
  const lines = textToRender.split('\n');
  const htmlParts: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';
  let inList: 'ul' | 'ol' | null = null;
  let inTable = false;
  let tableRows: string[][] = [];

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  const closeTable = () => {
    if (inTable && tableRows.length > 0) {
      let tableHtml = '<table>';
      const hasHeader = tableRows.length > 1 && tableRows[1].some((cell) => cell.includes('---'));
      if (hasHeader) {
        tableHtml += '<thead><tr>';
        tableRows[0].forEach((cell) => {
          tableHtml += `<th>${formatInlineMarkdown(cell, includeSources)}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
        for (let i = 2; i < tableRows.length; i++) {
          tableHtml += '<tr>';
          tableRows[i].forEach((cell) => {
            tableHtml += `<td>${formatInlineMarkdown(cell, includeSources)}</td>`;
          });
          tableHtml += '</tr>';
        }
        tableHtml += '</tbody>';
      } else {
        tableHtml += '<tbody>';
        tableRows.forEach((row) => {
          tableHtml += '<tr>';
          row.forEach((cell) => {
            tableHtml += `<td>${formatInlineMarkdown(cell, includeSources)}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody>';
      }
      tableHtml += '</table>';
      htmlParts.push(tableHtml);
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        closeList();
        closeTable();
        htmlParts.push(`<pre><code class="language-${codeBlockLang}">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
        inCodeBlock = false;
        codeBlockContent = [];
        codeBlockLang = '';
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      closeTable();
    }

    // Empty line
    if (!trimmed) {
      closeList();
      continue;
    }

    // Headings
    if (trimmed.startsWith('#')) {
      closeList();
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        htmlParts.push(`<h${level}>${formatInlineMarkdown(text, includeSources)}</h${level}>`);
        continue;
      }
    }

    // Horizontal rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      closeList();
      htmlParts.push('<hr />');
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      closeList();
      const quoteText = trimmed.replace(/^>\s*/, '');
      htmlParts.push(`<blockquote><p>${formatInlineMarkdown(quoteText, includeSources)}</p></blockquote>`);
      continue;
    }

    // Task lists
    if (/^-\s+\[([ xX])\]\s+(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^-\s+\[([ xX])\]\s+(.*)$/);
      if (match) {
        if (inList !== 'ul') {
          closeList();
          inList = 'ul';
          htmlParts.push('<ul class="task-list">');
        }
        const checked = match[1].toLowerCase() === 'x';
        htmlParts.push(
          `<li class="task-list-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled /> ${formatInlineMarkdown(match[2], includeSources)}</li>`
        );
        continue;
      }
    }

    // Unordered List (- or *)
    if (/^[-*+]\s+(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^[-*+]\s+(.*)$/);
      if (match) {
        if (inList !== 'ul') {
          closeList();
          inList = 'ul';
          htmlParts.push('<ul>');
        }
        htmlParts.push(`<li>${formatInlineMarkdown(match[1], includeSources)}</li>`);
        continue;
      }
    }

    // Ordered List (1. ...)
    if (/^\d+\.\s+(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s+(.*)$/);
      if (match) {
        if (inList !== 'ol') {
          closeList();
          inList = 'ol';
          htmlParts.push('<ol>');
        }
        htmlParts.push(`<li>${formatInlineMarkdown(match[1], includeSources)}</li>`);
        continue;
      }
    }

    closeList();

    // Regular paragraph
    htmlParts.push(`<p>${formatInlineMarkdown(trimmed, includeSources)}</p>`);
  }

  closeList();
  closeTable();

  // If includeSources is true and sources exist, append Bibliography section
  if (includeSources && sources && sources.length > 0) {
    let biblioHtml = `
      <div class="document-sources">
        <hr class="sources-divider" />
        <h2 class="sources-title">${escapeHtml(sourcesHeadingText || 'Sources and References')}</h2>
        <div class="sources-list">
    `;

    sources.forEach((s, idx) => {
      const url = s?.metadata?.url || '';
      const title = s?.metadata?.title || s?.metadata?.fileName || `Source [${idx + 1}]`;
      const domain = formatDomain(url);
      const snippet = s?.pageContent || s?.metadata?.snippet || '';

      biblioHtml += `
        <div class="source-item">
          <div class="source-item-header">
            <span class="source-badge">[${idx + 1}]</span>
            <span class="source-name">${escapeHtml(title)}</span>
            ${domain ? `<span class="source-domain">(${escapeHtml(domain)})</span>` : ''}
          </div>
          ${url ? `<div class="source-url"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></div>` : ''}
          ${snippet ? `<div class="source-snippet">${escapeHtml(snippet.slice(0, 220))}${snippet.length > 220 ? '...' : ''}</div>` : ''}
        </div>
      `;
    });

    biblioHtml += `
        </div>
      </div>
    `;

    htmlParts.push(biblioHtml);
  }

  return htmlParts.join('\n');
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
  const { t } = useTranslation();
  const [includeSources, setIncludeSources] = useState(true);

  const handleCopyMarkdown = async () => {
    try {
      let finalContent = includeSources ? content : stripCitations(content);
      if (includeSources && sources && sources.length > 0) {
        finalContent += `\n\n---\n\n## ${t('scratchpad.sourcesHeading') || 'Sources and References'}\n\n` +
          sources.map((s, i) => {
            const url = s?.metadata?.url || '';
            const title = s?.metadata?.title || s?.metadata?.fileName || `Source [${i + 1}]`;
            const snippet = s?.pageContent || s?.metadata?.snippet || '';
            let line = `[${i + 1}] [${title}](${url || '#'})`;
            if (snippet) line += `\n> ${snippet.slice(0, 200).replace(/\n/g, ' ')}`;
            return line;
          }).join('\n\n');
      }
      await navigator.clipboard.writeText(finalContent);
      toast.success(t('scratchpad.copiedSuccess') || 'Copied content to clipboard!');
      onClose();
    } catch {
      toast.error(t('scratchpad.copyError') || 'Failed to copy to clipboard.');
    }
  };

  const handleDownloadMarkdown = () => {
    let finalContent = includeSources ? content : stripCitations(content);
    if (includeSources && sources && sources.length > 0) {
      finalContent += `\n\n---\n\n## ${t('scratchpad.sourcesHeading') || 'Sources and References'}\n\n` +
        sources.map((s, i) => {
          const url = s?.metadata?.url || '';
          const title = s?.metadata?.title || s?.metadata?.fileName || `Source [${i + 1}]`;
          const snippet = s?.pageContent || s?.metadata?.snippet || '';
          let line = `[${i + 1}] [${title}](${url || '#'})`;
          if (snippet) line += `\n> ${snippet.slice(0, 200).replace(/\n/g, ' ')}`;
          return line;
        }).join('\n\n');
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
    let textToClean = includeSources ? content : stripCitations(content);
    let cleanText = textToClean
      .replace(/[#*`_~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    if (includeSources && sources && sources.length > 0) {
      cleanText += `\n\n===============================\n${t('scratchpad.sourcesHeading') || 'Sources and References'}\n===============================\n\n` +
        sources.map((s, i) => {
          const url = s?.metadata?.url || '';
          const title = s?.metadata?.title || s?.metadata?.fileName || `Source [${i + 1}]`;
          return `[${i + 1}] ${title} ${url ? `(${url})` : ''}`;
        }).join('\n');
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

  const handlePrint = () => {
    onClose();

    // Create hidden iframe for isolated print rendering
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error('Failed to prepare the document for printing.');
      return;
    }

    const htmlBody = convertMarkdownToPrintHtml(
      content,
      includeSources,
      sources,
      t('scratchpad.sourcesHeading') || 'Sources and References',
    );
    const docTitle = title || t('scratchpad.untitled') || 'Untitled Note';

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 16mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1a1a1a;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .document-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .document-header {
      margin-bottom: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid #b8864d;
    }
    .document-title {
      font-size: 22pt;
      font-weight: 700;
      color: #111827;
      margin: 0 0 6px 0;
      line-height: 1.25;
    }
    .document-meta {
      font-size: 9.5pt;
      color: #64748b;
      margin: 0;
    }
    h1 {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
      margin: 24px 0 10px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
      page-break-after: avoid;
    }
    h2 {
      font-size: 13.5pt;
      font-weight: 600;
      color: #1e293b;
      margin: 20px 0 8px 0;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      font-weight: 600;
      color: #334155;
      margin: 16px 0 6px 0;
      page-break-after: avoid;
    }
    h4, h5, h6 {
      font-size: 11pt;
      font-weight: 600;
      color: #475569;
      margin: 14px 0 4px 0;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 12px 0;
    }
    ul, ol {
      margin: 0 0 12px 0;
      padding-left: 24px;
    }
    li {
      margin-bottom: 4px;
    }
    .task-list {
      list-style: none;
      padding-left: 4px;
    }
    .task-list-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    blockquote {
      margin: 14px 0;
      padding: 8px 16px;
      border-left: 4px solid #b8864d;
      background-color: #fcfaf7;
      color: #475569;
      font-style: italic;
      page-break-inside: avoid;
    }
    pre {
      margin: 14px 0;
      padding: 12px 14px;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 9pt;
      line-height: 1.45;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      page-break-inside: avoid;
    }
    code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 9.5pt;
      background-color: #f1f5f9;
      padding: 2px 5px;
      border-radius: 4px;
      color: #b8864d;
    }
    pre code {
      background: none;
      padding: 0;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: #f8fafc;
      font-weight: 600;
      color: #1e293b;
    }
    hr {
      border: 0;
      height: 1px;
      background-color: #e2e8f0;
      margin: 20px 0;
    }
    a {
      color: #b8864d;
      text-decoration: underline;
    }
    .citation {
      font-size: 8pt;
      font-weight: 600;
      color: #b8864d;
      vertical-align: super;
      line-height: 0;
      padding: 0 1px;
    }
    .document-sources {
      margin-top: 32px;
      page-break-before: auto;
      page-break-inside: avoid;
    }
    .sources-divider {
      border: 0;
      height: 2px;
      background-color: #b8864d;
      margin: 28px 0 16px 0;
      opacity: 0.7;
    }
    .sources-title {
      font-size: 14pt;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px 0;
    }
    .sources-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .source-item {
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background-color: #fafaf9;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    .source-item-header {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .source-badge {
      color: #b8864d;
      font-weight: 700;
      margin-right: 6px;
    }
    .source-domain {
      font-size: 8.5pt;
      color: #64748b;
      font-weight: normal;
      margin-left: 6px;
    }
    .source-url {
      font-size: 8.5pt;
      color: #b8864d;
      word-break: break-all;
      margin-bottom: 3px;
    }
    .source-snippet {
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.4;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="document-container">
    <div class="document-header">
      <h1 class="document-title">${escapeHtml(docTitle)}</h1>
      <p class="document-meta">Vane Scratchpad • ${new Date().toLocaleDateString('en-US')}</p>
    </div>
    <div class="document-content">
      ${htmlBody}
    </div>
  </div>
</body>
</html>`;

    doc.open();
    doc.write(fullHtml);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 3000);
    }, 250);
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

