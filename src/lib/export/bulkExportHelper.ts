import JSZip from 'jszip';
import { generateDocxBlob, DocxSectionItem } from './exportDocx';
import {
  buildChatPrintDocumentHtml,
  buildNotePrintDocumentHtml,
  executeIframePrint,
  downloadPrintDocumentHtml,
  PdfExportStyle,
  PrintSourceItem,
} from '@/lib/utils/printExport';
import { getPdfExportStyle, getPdfShowBranding } from '@/lib/config/clientRegistry';

export interface BulkExportItem {
  id: string;
  title: string;
  date?: string;
  subtitle?: string;
  content: string;
  sources?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
  }>;
  raw?: any;
}

export type ExportFormat = 'docx' | 'pdf' | 'md' | 'txt' | 'html' | 'json';

export interface BulkExportOptions {
  documentTitle: string;
  items: BulkExportItem[];
  format: ExportFormat;
  includeSources: boolean;
  includeMetadata: boolean;
  separateFiles?: boolean; // When true and items > 1, packages individual files into a ZIP archive
  pdfStyle?: PdfExportStyle;
  locale?: string;
}

/**
 * Sanitizes file names to prevent directory traversal and remove unsupported filesystem characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'vane_export';
  const clean = filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '_')
    .trim()
    .slice(0, 120);
  return clean || 'vane_export';
}

/**
 * Initiates an automatic browser download for a Blob and revokes object URL safely.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(filename);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Strips model thinking/reasoning tags from content.
 */
export function cleanExportText(text: string): string {
  if (!text) return '';
  return text.replace(/<(think|thought|thinking)>[\s\S]*?<\/\1>/gi, '').trim();
}

/**
 * Strips or formats citation tags.
 */
export function processCitations(text: string, includeSources: boolean): string {
  if (!text) return '';
  if (!includeSources) {
    return text.replace(/<citation\b[^>]*>([\s\S]*?)<\/citation>/gi, '').trim();
  }
  return text.replace(
    /<citation\b([^>]*)>([\s\S]*?)<\/citation>/gi,
    (_, rawAttrs, content) => {
      const num = content.trim();
      const hrefMatch = rawAttrs.match(/href="([^"]*)"/i);
      const href = hrefMatch ? hrefMatch[1].trim() : '';
      return href && href.startsWith('http') ? `[${num}](${href})` : `[${num}]`;
    },
  );
}

/**
 * Maps arbitrary source objects to the PrintSourceItem structure expected by the print engine.
 */
function toPrintSourceItems(
  sources?: Array<{ title?: string; url?: string; snippet?: string }>,
): PrintSourceItem[] {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.map((s, idx) => ({
    id: idx + 1,
    metadata: {
      title: s.title || s.url || `Source [${idx + 1}]`,
      url: s.url || '',
      snippet: s.snippet || '',
    },
    pageContent: s.snippet || '',
  }));
}

/**
 * Fetches full chat conversation history for multiple chat IDs.
 */
export async function fetchFullChatsForExport(chatIds: string[]): Promise<BulkExportItem[]> {
  const items: BulkExportItem[] = [];

  const fetchSingleChat = async (id: string): Promise<BulkExportItem | null> => {
    try {
      const res = await fetch(`/api/chats/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const chat = data.chat || {};
      const messages: any[] = Array.isArray(data.messages) ? data.messages : [];

      let conversationContent = '';
      const aggregatedSources: Array<{ title?: string; url?: string; snippet?: string }> = [];

      messages.forEach((msg, idx) => {
        const query = (msg.query || '').trim();
        let responseText = '';

        if (Array.isArray(msg.responseBlocks)) {
          msg.responseBlocks.forEach((block: any) => {
            if (block.type === 'text' && typeof block.data === 'string') {
              responseText += block.data + '\n\n';
            } else if (block.type === 'source' && Array.isArray(block.data)) {
              block.data.forEach((s: any) => {
                const url = s?.metadata?.url || '';
                const title = s?.metadata?.title || s?.metadata?.fileName || url;
                const snippet = s?.pageContent || s?.metadata?.snippet || '';
                if (url || title) {
                  aggregatedSources.push({ title, url, snippet });
                }
              });
            }
          });
        }

        if (idx > 0) {
          conversationContent += '\n\n---\n\n';
        }
        if (query) {
          conversationContent += `**User**:\n${query}\n\n`;
        }
        if (responseText) {
          conversationContent += `**Assistant**:\n${cleanExportText(responseText)}\n`;
        }
      });

      // Deduplicate sources by URL
      const uniqueSources = aggregatedSources.filter(
        (src, sIdx, arr) => arr.findIndex((x) => x.url && x.url === src.url) === sIdx,
      );

      return {
        id: chat.id || id,
        title: chat.title || messages[0]?.query || 'Chat Conversation',
        date: chat.createdAt ? new Date(chat.createdAt).toLocaleString() : undefined,
        subtitle: `Model: ${chat.focusMode || 'General'} • Messages: ${messages.length}`,
        content: conversationContent || '*(No messages recorded)*',
        sources: uniqueSources,
        raw: data,
      };
    } catch (err) {
      console.warn(`Failed to fetch chat ${id} for export:`, err);
      return null;
    }
  };

  // Run in chunks of 5 parallel requests to prevent browser network saturation
  const chunkSize = 5;
  for (let i = 0; i < chatIds.length; i += chunkSize) {
    const chunk = chatIds.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((id) => fetchSingleChat(id)));
    for (const item of results) {
      if (item) items.push(item);
    }
  }

  return items;
}

/**
 * Fetches full scratchpad notes (content and sources) for multiple scratchpad IDs.
 */
export async function fetchFullScratchpadsForExport(scratchpadIds: string[]): Promise<BulkExportItem[]> {
  const items: BulkExportItem[] = [];

  const fetchSingleNote = async (id: string): Promise<BulkExportItem | null> => {
    try {
      const res = await fetch(`/api/scratchpad/${id}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const item = data.scratchpad || data.item || data;

      let parsedSources: any[] = [];
      try {
        parsedSources =
          typeof item.sources === 'string'
            ? JSON.parse(item.sources)
            : item.sources || [];
      } catch {
        parsedSources = [];
      }

      const sourcesList = (Array.isArray(parsedSources) ? parsedSources : []).map(
        (s: any, idx: number) => ({
          title: s?.metadata?.title || s?.metadata?.fileName || s?.title || `Source ${idx + 1}`,
          url: s?.metadata?.url || s?.url || '',
          snippet: s?.pageContent || s?.metadata?.snippet || s?.snippet || '',
        }),
      );

      return {
        id: item.id || id,
        title: item.title || 'Untitled Note',
        date: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : undefined,
        subtitle: `Type: ${item.type || 'note'}`,
        content: item.content || '',
        sources: sourcesList,
        raw: item,
      };
    } catch (err) {
      console.warn(`Failed to fetch scratchpad ${id} for export:`, err);
      return null;
    }
  };

  const chunkSize = 5;
  for (let i = 0; i < scratchpadIds.length; i += chunkSize) {
    const chunk = scratchpadIds.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map((id) => fetchSingleNote(id)));
    for (const item of results) {
      if (item) items.push(item);
    }
  }

  return items;
}

/**
 * Orchestrates bulk export across DOCX, PDF, Markdown, TXT, HTML, and JSON formats.
 */
export async function executeBulkExport(options: BulkExportOptions): Promise<boolean> {
  const {
    documentTitle,
    items,
    format,
    includeSources,
    includeMetadata,
    separateFiles = false,
    pdfStyle = getPdfExportStyle(),
    locale = 'en',
  } = options;

  if (!items || items.length === 0) {
    return false;
  }

  const baseTitle = sanitizeFilename(documentTitle || 'export');

  // Case 1: Separate files packaged into a ZIP archive
  if (separateFiles && items.length > 1 && format !== 'pdf') {
    const zip = new JSZip();

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const itemPrefix = String(idx + 1).padStart(2, '0');
      const itemBaseName = sanitizeFilename(`${itemPrefix}_${item.title || 'item'}`);

      if (format === 'docx') {
        const docxBlob = await generateDocxBlob({
          documentTitle: item.title,
          sections: [
            {
              title: item.title,
              subtitle: item.subtitle,
              date: item.date,
              content: processCitations(item.content, includeSources),
              sources: includeSources ? item.sources : undefined,
            },
          ],
          includeSources,
          includeMetadata,
        });
        zip.file(`${itemBaseName}.docx`, docxBlob);
      } else if (format === 'md') {
        let md = `# ${item.title}\n\n`;
        if (includeMetadata && (item.date || item.subtitle)) {
          md += `*${[item.date, item.subtitle].filter(Boolean).join(' • ')}*\n\n---\n\n`;
        }
        md += processCitations(item.content, includeSources);
        if (includeSources && item.sources && item.sources.length > 0) {
          md += `\n\n---\n\n## Sources & References\n\n`;
          item.sources.forEach((s, sIdx) => {
            md += `[${sIdx + 1}] [${s.title || s.url}](${s.url || '#'})\n`;
          });
        }
        zip.file(`${itemBaseName}.md`, md);
      } else if (format === 'txt') {
        let txt = `${item.title.toUpperCase()}\n`;
        if (includeMetadata && (item.date || item.subtitle)) {
          txt += `${[item.date, item.subtitle].filter(Boolean).join(' • ')}\n`;
        }
        txt += `========================================\n\n`;
        txt += processCitations(item.content, false)
          .replace(/[#*`_~]/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        if (includeSources && item.sources && item.sources.length > 0) {
          txt += `\n\n========================================\nSOURCES & REFERENCES\n========================================\n`;
          item.sources.forEach((s, sIdx) => {
            txt += `[${sIdx + 1}] ${s.title || s.url} (${s.url || ''})\n`;
          });
        }
        zip.file(`${itemBaseName}.txt`, txt);
      } else if (format === 'html') {
        const html = await buildNotePrintDocumentHtml({
          title: item.title,
          content: processCitations(item.content, includeSources),
          sources: includeSources ? toPrintSourceItems(item.sources) : undefined,
          includeSources,
          locale,
          sourcesHeading: 'Sources and References',
          untitledText: 'Untitled',
          metaSubtitle: [item.date, item.subtitle].filter(Boolean).join(' • '),
          pdfStyle,
          pdfShowBranding: getPdfShowBranding(),
        });
        zip.file(`${itemBaseName}.html`, html);
      } else if (format === 'json') {
        const jsonObj = {
          title: item.title,
          date: item.date,
          subtitle: item.subtitle,
          content: item.content,
          sources: includeSources ? item.sources : [],
        };
        zip.file(`${itemBaseName}.json`, JSON.stringify(jsonObj, null, 2));
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${baseTitle}_archive.zip`);
    return true;
  }

  // Case 2: Consolidated DOCX document
  if (format === 'docx') {
    const sections: DocxSectionItem[] = items.map((item) => ({
      title: item.title,
      subtitle: item.subtitle,
      date: item.date,
      content: processCitations(item.content, includeSources),
      sources: includeSources ? item.sources : undefined,
    }));

    const blob = await generateDocxBlob({
      documentTitle,
      sections,
      includeSources,
      includeMetadata,
    });

    downloadBlob(blob, `${baseTitle}.docx`);
    return true;
  }

  // Case 3: Print / Save to PDF (High-fidelity browser print engine)
  if (format === 'pdf') {
    // Compile consolidated multi-turn or multi-note document
    const combinedMarkdown = items
      .map((item, idx) => {
        let sec = `# [${idx + 1}] ${item.title}\n`;
        if (includeMetadata && (item.date || item.subtitle)) {
          sec += `*${[item.date, item.subtitle].filter(Boolean).join(' • ')}*\n\n`;
        }
        sec += processCitations(item.content, includeSources);
        return sec;
      })
      .join('\n\n<div style="page-break-before: always; break-before: page;"></div>\n\n');

    // Aggregate sources for the print document
    const allSources = includeSources
      ? toPrintSourceItems(items.flatMap((i) => i.sources || []))
      : [];

    const html = await buildNotePrintDocumentHtml({
      title: documentTitle,
      content: combinedMarkdown,
      sources: allSources,
      includeSources,
      locale,
      sourcesHeading: 'Sources and References',
      untitledText: 'Untitled',
      metaSubtitle: `Vane • Consolidated Export • ${items.length} items`,
      pdfStyle,
      pdfShowBranding: getPdfShowBranding(),
    });

    return await executeIframePrint(html);
  }

  // Case 4: Consolidated Markdown
  if (format === 'md') {
    let md = `# 📚 ${documentTitle}\n\n`;
    if (includeMetadata) {
      md += `*Generated by Vane - Community • ${new Date().toLocaleString(locale)} • Items: ${items.length}*\n\n---\n\n`;
    }

    items.forEach((item, idx) => {
      md += `## [${idx + 1}] ${item.title}\n\n`;
      if (includeMetadata && (item.date || item.subtitle)) {
        md += `*${[item.date, item.subtitle].filter(Boolean).join(' • ')}*\n\n`;
      }
      md += processCitations(item.content, includeSources) + '\n\n';

      if (includeSources && item.sources && item.sources.length > 0) {
        md += `### Sources & References:\n`;
        item.sources.forEach((s, sIdx) => {
          md += `- [${sIdx + 1}] [${s.title || s.url}](${s.url || '#'})\n`;
        });
        md += '\n';
      }

      if (idx < items.length - 1) {
        md += '---\n\n';
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `${baseTitle}.md`);
    return true;
  }

  // Case 5: Consolidated TXT
  if (format === 'txt') {
    let txt = `================================================================================\n`;
    txt += `  ${documentTitle.toUpperCase()}\n`;
    txt += `  Vane - Community • ${new Date().toLocaleString(locale)} • Items: ${items.length}\n`;
    txt += `================================================================================\n\n`;

    items.forEach((item, idx) => {
      txt += `[${idx + 1}] ${item.title.toUpperCase()}\n`;
      if (includeMetadata && (item.date || item.subtitle)) {
        txt += `${[item.date, item.subtitle].filter(Boolean).join(' • ')}\n`;
      }
      txt += `--------------------------------------------------------------------------------\n\n`;
      txt +=
        processCitations(item.content, false)
          .replace(/[#*`_~]/g, '')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') + '\n\n';

      if (includeSources && item.sources && item.sources.length > 0) {
        txt += `SOURCES & REFERENCES:\n`;
        item.sources.forEach((s, sIdx) => {
          txt += `  [${sIdx + 1}] ${s.title || s.url} ${s.url ? `(${s.url})` : ''}\n`;
        });
        txt += '\n';
      }

      if (idx < items.length - 1) {
        txt += `\n================================================================================\n\n`;
      }
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${baseTitle}.txt`);
    return true;
  }

  // Case 6: Standalone HTML report
  if (format === 'html') {
    const combinedMarkdown = items
      .map((item, idx) => {
        let sec = `# [${idx + 1}] ${item.title}\n`;
        if (includeMetadata && (item.date || item.subtitle)) {
          sec += `*${[item.date, item.subtitle].filter(Boolean).join(' • ')}*\n\n`;
        }
        sec += processCitations(item.content, includeSources);
        return sec;
      })
      .join('\n\n<hr style="margin: 3rem 0; border: none; border-top: 1px solid #e0d9d0;" />\n\n');

    const allSources = includeSources
      ? toPrintSourceItems(items.flatMap((i) => i.sources || []))
      : [];

    const html = await buildNotePrintDocumentHtml({
      title: documentTitle,
      content: combinedMarkdown,
      sources: allSources,
      includeSources,
      locale,
      sourcesHeading: 'Sources and References',
      untitledText: 'Untitled',
      metaSubtitle: `Vane • Consolidated Export • ${items.length} items`,
      pdfStyle,
      pdfShowBranding: getPdfShowBranding(),
    });

    downloadPrintDocumentHtml(html, `${baseTitle}.html`);
    return true;
  }

  // Case 7: JSON
  if (format === 'json') {
    const payload = {
      title: documentTitle,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        date: i.date,
        subtitle: i.subtitle,
        content: i.content,
        sources: includeSources ? i.sources : [],
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    downloadBlob(blob, `${baseTitle}.json`);
    return true;
  }

  return false;
}
