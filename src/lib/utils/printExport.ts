/**
 * Unified Markdown to Print HTML engine for PDF generation and browser printing.
 * Handles tables, GitHub-style callouts, Mermaid diagrams, citation tags, code blocks,
 * typography hierarchy, and professional @media print stylesheets.
 */

export interface PrintSourceItem {
  id?: string | number;
  metadata?: {
    url?: string;
    title?: string;
    fileName?: string;
    snippet?: string;
    publishedDate?: string;
  };
  pageContent?: string;
  content?: string;
}

export interface PrintDocumentTurn {
  userQuery: string;
  userDate?: string;
  assistantText: string;
  assistantDate?: string;
  sources?: PrintSourceItem[];
  metrics?: {
    modelKey?: string;
    durationMs?: number;
    totalTokens?: number;
  };
}

export interface PrintDocumentConfig {
  title: string;
  locale?: string;
  subtitle?: string;
  turns: PrintDocumentTurn[];
  labels?: {
    exportReport?: string;
    user?: string;
    assistant?: string;
    sourcesTitle?: (count: number) => string;
    generatedBy?: string;
    queriesCount?: (count: number) => string;
    queryNum?: (num: number) => string;
    model?: string;
    time?: string;
    tokens?: string;
    vaneAnswer?: string;
  };
}

export interface SingleNotePrintConfig {
  title: string;
  content: string;
  sources?: PrintSourceItem[];
  includeSources?: boolean;
  locale?: string;
  sourcesHeading?: string;
  untitledText?: string;
  metaSubtitle?: string;
}

const escapeHtml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatDomain = (url: string): string => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/.+\/\/|www\.|\..+/g, '');
  }
};

const CALLOUT_ICONS: Record<string, string> = {
  note: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  tip: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`,
  warning: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
  important: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  caution: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
};

export const VANE_LOGO_SVG = `
  <svg width="26" height="26" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vaneGoldGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#f3d5ab" />
        <stop offset="45%" stop-color="#d4a373" />
        <stop offset="100%" stop-color="#9c6d3a" />
      </linearGradient>
      <linearGradient id="vaneDarkWing" x1="16" y1="12" x2="16" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#b8864d" />
        <stop offset="100%" stop-color="#7a542a" />
      </linearGradient>
    </defs>
    <path d="M6 7L13 26L16.5 26L14.5 13L10.5 7H6Z" fill="url(#vaneGoldGrad)" />
    <path d="M10.5 7L14.5 13L16.5 26L14 26L8.5 7H10.5Z" fill="url(#vaneDarkWing)" fill-opacity="0.4" />
    <path d="M16 26L26 8H21.5L14.5 22L16 26Z" fill="url(#vaneGoldGrad)" />
    <circle cx="26" cy="7" r="1.5" fill="#f3d5ab" fill-opacity="0.85" />
  </svg>
`;

/**
 * Parses inline markdown tokens (bold, italic, strikethrough, inline code, links, citations)
 */
export const formatInlineMarkdown = (
  text: string,
  includeSources: boolean = true,
): string => {
  if (!text) return '';

  let res = escapeHtml(text);

  // Bold & Italic
  res = res.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  res = res.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  res = res.replace(/__(.*?)__/g, '<strong>$1</strong>');
  res = res.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  res = res.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  res = res.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Inline Code
  res = res.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Standard Markdown links [title](url)
  res = res.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="doc-link">$1</a>',
  );

  // Numerical citations [1], [1, 2] if still remaining in markdown
  if (includeSources) {
    res = res.replace(
      /\[([\d,\s]+)\]/g,
      '<span class="citation-ref">[$1]</span>',
    );
  } else {
    res = res.replace(/\s*\[[\d,\s]+\]/g, '');
  }

  // Clean up any stray dangling asterisks from formatting edge cases
  res = res.replace(/([A-Za-z0-9żźćńółęąśŻŹĆĄŚĘŁÓŃ]):\*/g, '$1:');

  return res;
};

/**
 * Converts markdown text into semantic, print-ready HTML with support for
 * citations, callouts, tables, code blocks, mermaid charts, lists, and headings.
 */
export const convertMarkdownToPrintHtml = async (
  markdownText: string,
  options: {
    includeSources?: boolean;
    sources?: PrintSourceItem[];
    sourcesHeadingText?: string;
  } = {},
): Promise<string> => {
  if (!markdownText) return '';

  const { includeSources = true, sources, sourcesHeadingText } = options;

  // Step 1: Strip thinking tags <think>...</think>
  let text = markdownText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Step 2: Extract and placeholder all <citation ...>NUM</citation> tags
  // Attributes may appear in any order: href, title, source-index, snippet, date, etc.
  const citationMap: string[] = [];
  text = text.replace(
    /<citation\b([^>]*)>([\s\S]*?)<\/citation>/gi,
    (_, rawAttrs, content) => {
      const idx = citationMap.length;
      const num = content.trim();

      // Extract href attribute
      const hrefMatch = rawAttrs.match(/href="([^"]*)"/i);
      let cleanHref = hrefMatch ? hrefMatch[1].trim() : '';
      const urlMatch = cleanHref.match(/https?:\/\/[^\s)\]]+/);
      if (urlMatch) {
        cleanHref = urlMatch[0];
      }

      // Extract title attribute
      const titleMatch = rawAttrs.match(/title="([^"]*)"/i);
      const cleanTitle = titleMatch ? titleMatch[1].trim() : cleanHref;

      if (!includeSources) {
        return '';
      }

      const isLink =
        cleanHref.startsWith('http://') || cleanHref.startsWith('https://');

      const citationHtml = isLink
        ? `<a href="${cleanHref}" title="${escapeHtml(cleanTitle)}" class="citation-ref" target="_blank" rel="noopener noreferrer">[${escapeHtml(num)}]</a>`
        : `<span class="citation-ref" title="${escapeHtml(cleanTitle)}">[${escapeHtml(num)}]</span>`;

      citationMap.push(citationHtml);
      return `%%VANECITATION${idx}%%`;
    },
  );

  // Step 3: Extract and render code blocks & Mermaid diagrams
  const codeBlocks: string[] = [];
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let codeMatch: RegExpExecArray | null;
  const rawCodeReplacements: Array<{ placeholder: string; html: string }> = [];

  // Identify all code blocks first
  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    const lang = (codeMatch[1] || '').trim().toLowerCase();
    const code = codeMatch[2].trim();
    const idx = codeBlocks.length;
    const placeholder = `%%VANECODEBLOCK${idx}%%`;
    codeBlocks.push(code);

    let blockHtml = '';

    if (lang === 'mermaid') {
      let renderedSvg = '';
      if (typeof window !== 'undefined' && code) {
        try {
          const mermaidModule = await import('mermaid');
          const mermaid = mermaidModule.default;
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'inherit',
          });
          const renderId = `print-mermaid-${idx}-${Date.now()}`;
          const renderResult = await mermaid.render(renderId, code);
          renderedSvg = renderResult.svg;
        } catch {
          // Graceful fallback on mermaid syntax failure
          renderedSvg = '';
        }
      }

      if (renderedSvg) {
        blockHtml = `
          <div class="mermaid-diagram-box">
            <div class="diagram-header">Diagram</div>
            <div class="diagram-body">${renderedSvg}</div>
          </div>
        `;
      } else {
        blockHtml = `
          <div class="code-block">
            <div class="code-header">Diagram (Mermaid)</div>
            <pre><code>${escapeHtml(code)}</code></pre>
          </div>
        `;
      }
    } else {
      blockHtml = `
        <div class="code-block">
          <div class="code-header">${escapeHtml(lang || 'code')}</div>
          <pre><code>${escapeHtml(code)}</code></pre>
        </div>
      `;
    }

    rawCodeReplacements.push({ placeholder, html: blockHtml });
  }

  // Replace code blocks in text with placeholders
  text = text.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    () => rawCodeReplacements.shift()?.placeholder || '',
  );

  // Step 4: Parse lines and block structures
  const lines = text.split('\n');
  const htmlParts: string[] = [];

  let inList: 'ul' | 'ol' | null = null;
  let inTable = false;
  let tableRows: string[][] = [];
  let inBlockquote = false;
  let blockquoteLines: string[] = [];
  let blockquoteType: string | null = null;

  const closeList = () => {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  };

  const closeBlockquote = () => {
    if (inBlockquote) {
      const fullContent = blockquoteLines.join('\n').trim();
      if (blockquoteType && CALLOUT_ICONS[blockquoteType]) {
        const iconSvg = CALLOUT_ICONS[blockquoteType];
        const badgeLabel = blockquoteType.toUpperCase();
        htmlParts.push(`
          <div class="callout-block callout-${blockquoteType}">
            <div class="callout-header">
              <span class="callout-icon">${iconSvg}</span>
              <span class="callout-badge">${badgeLabel}</span>
            </div>
            <div class="callout-content">${formatInlineMarkdown(fullContent, includeSources)}</div>
          </div>
        `);
      } else {
        htmlParts.push(
          `<blockquote><p>${formatInlineMarkdown(fullContent, includeSources)}</p></blockquote>`,
        );
      }
      inBlockquote = false;
      blockquoteLines = [];
      blockquoteType = null;
    }
  };

  const closeTable = () => {
    if (inTable && tableRows.length > 0) {
      let tableHtml = '<table class="doc-table">';
      const isHeaderSeparator =
        tableRows.length > 1 &&
        tableRows[1].some((cell) => cell.includes('---'));

      if (isHeaderSeparator) {
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

    // Check if this line is a code block placeholder
    if (trimmed.startsWith('%%VANECODEBLOCK') && trimmed.endsWith('%%')) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push(trimmed);
      continue;
    }

    // Callout header or blockquote line
    const calloutMatch = trimmed.match(
      /^(?:&gt;|>)[ \t]*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i,
    );
    if (calloutMatch) {
      closeList();
      closeBlockquote();
      closeTable();
      inBlockquote = true;
      blockquoteType = calloutMatch[1].toLowerCase();
      if (calloutMatch[2].trim()) {
        blockquoteLines.push(calloutMatch[2].trim());
      }
      continue;
    }

    if (trimmed.startsWith('>') || trimmed.startsWith('&gt;')) {
      closeList();
      closeTable();
      const quoteText = trimmed.replace(/^(?:&gt;|>)[ \t]?/, '');
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteType = null;
      }
      blockquoteLines.push(quoteText);
      continue;
    } else if (inBlockquote) {
      closeBlockquote();
    }

    // Standalone Callout tag without > (e.g. LLM outputting [!NOTE] directly)
    const directCalloutMatch = trimmed.match(
      /^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(.*)$/i,
    );
    if (directCalloutMatch) {
      closeList();
      closeBlockquote();
      closeTable();
      inBlockquote = true;
      blockquoteType = directCalloutMatch[1].toLowerCase();
      if (directCalloutMatch[2].trim()) {
        blockquoteLines.push(directCalloutMatch[2].trim());
      }
      continue;
    }

    // Table rows
    if (
      trimmed.startsWith('|') &&
      trimmed.endsWith('|') &&
      trimmed.length >= 3
    ) {
      closeList();
      closeBlockquote();
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
      closeBlockquote();
      continue;
    }

    // Horizontal rules (---, ***, ___)
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      closeList();
      closeBlockquote();
      closeTable();
      htmlParts.push('<hr class="doc-divider" />');
      continue;
    }

    // Headings (H1 through H6)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      closeTable();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();
      htmlParts.push(
        `<h${level}>${formatInlineMarkdown(headingText, includeSources)}</h${level}>`,
      );
      continue;
    }

    // Task list items: - [ ] or - [x]
    const taskMatch = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      closeBlockquote();
      closeTable();
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        htmlParts.push('<ul class="task-list">');
      }
      const isChecked = taskMatch[1].toLowerCase() === 'x';
      htmlParts.push(
        `<li class="task-item"><input type="checkbox" ${isChecked ? 'checked' : ''} disabled /> <span>${formatInlineMarkdown(taskMatch[2], includeSources)}</span></li>`,
      );
      continue;
    }

    // Unordered list items: -, *, +
    const unordMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unordMatch) {
      closeBlockquote();
      closeTable();
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        htmlParts.push('<ul>');
      }
      htmlParts.push(
        `<li>${formatInlineMarkdown(unordMatch[1], includeSources)}</li>`,
      );
      continue;
    }

    // Ordered list items: 1. 2. 3.
    const ordMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (ordMatch) {
      closeBlockquote();
      closeTable();
      if (inList !== 'ol') {
        closeList();
        inList = 'ol';
        htmlParts.push('<ol>');
      }
      htmlParts.push(
        `<li>${formatInlineMarkdown(ordMatch[1], includeSources)}</li>`,
      );
      continue;
    }

    // Regular paragraph
    closeList();
    closeBlockquote();
    closeTable();
    htmlParts.push(
      `<p>${formatInlineMarkdown(trimmed, includeSources)}</p>`,
    );
  }

  closeList();
  closeBlockquote();
  closeTable();

  let finalHtml = htmlParts.join('\n');

  // Restore code blocks
  rawCodeReplacements.forEach(({ placeholder, html }) => {
    finalHtml = finalHtml.replace(placeholder, html);
  });

  // Restore citation tags
  citationMap.forEach((citHtml, idx) => {
    finalHtml = finalHtml.replace(`%%VANECITATION${idx}%%`, citHtml);
  });

  // Step 5: Append Sources / Bibliography if requested
  if (includeSources && sources && sources.length > 0) {
    let biblioHtml = `
      <div class="document-sources">
        <h3 class="sources-heading">${escapeHtml(sourcesHeadingText || 'Sources & References')} (${sources.length})</h3>
        <div class="sources-grid">
    `;

    sources.forEach((src, idx) => {
      const url = src?.metadata?.url || '';
      const title =
        src?.metadata?.title ||
        src?.metadata?.fileName ||
        url ||
        `Source [${idx + 1}]`;
      const domain = formatDomain(url);
      const snippet =
        src?.pageContent ||
        src?.content ||
        src?.metadata?.snippet ||
        '';
      const pubDate = src?.metadata?.publishedDate || '';

      biblioHtml += `
        <div class="source-card">
          <div class="source-card-top">
            <span class="source-num">[${idx + 1}]</span>
            <span class="source-title-wrap">
              ${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="source-main-link">${escapeHtml(title)}</a>` : `<span class="source-main-text">${escapeHtml(title)}</span>`}
            </span>
          </div>
          <div class="source-meta-row">
            ${domain ? `<span class="source-domain-chip">${escapeHtml(domain)}</span>` : ''}
            ${pubDate ? `<span class="source-date-chip">${escapeHtml(pubDate)}</span>` : ''}
          </div>
          ${snippet ? `<div class="source-snippet-box">${escapeHtml(snippet.slice(0, 240))}${snippet.length > 240 ? '...' : ''}</div>` : ''}
        </div>
      `;
    });

    biblioHtml += `
        </div>
      </div>
    `;

    finalHtml += biblioHtml;
  }

  return finalHtml;
};

/**
 * Global CSS styles specifically optimized for crisp, high-contrast printing and PDF export
 */
export const PRINT_STYLESHEET = `
  @page {
    size: A4 portrait;
    margin: 14mm 16mm;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background: #ffffff !important;
      color: #1c1917 !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .no-print {
      display: none !important;
    }
    .doc-container {
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
      max-width: 100% !important;
      border-radius: 0 !important;
    }
    .turn-block,
    .assistant-message,
    .doc-content,
    .content {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    .user-message,
    .callout-block,
    table.doc-table,
    .code-block,
    .mermaid-diagram-box,
    .source-card,
    .telemetry-row {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    h1, h2, h3, h4, h5, h6,
    .user-message-header,
    .assistant-header {
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    p, li {
      orphans: 3;
      widows: 3;
    }
  }

  *, *:before, *:after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    line-height: 1.6;
    color: #1c1917;
    background: #faf8f5;
    margin: 0;
    padding: clamp(16px, 3vw, 36px);
    display: flex;
    justify-content: center;
    -webkit-font-smoothing: antialiased;
  }

  .doc-container {
    width: 100%;
    max-width: 840px;
    background: #ffffff;
    border: 1px solid #ede5dc;
    border-radius: 12px;
    padding: clamp(20px, 4vw, 36px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  }

  /* Brand Header */
  .brand-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid #b8864d;
    padding-bottom: 14px;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
  }

  .brand-logo-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-name {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #1c1917;
    line-height: 1.1;
  }

  .brand-sub {
    font-size: 9.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #b8864d;
  }

  .doc-meta {
    font-size: 11px;
    color: #78716c;
    text-align: right;
    line-height: 1.4;
  }

  /* Title Section */
  .doc-title-section {
    margin-bottom: 26px;
  }

  .doc-title {
    font-size: 22px;
    font-weight: 700;
    color: #111827;
    letter-spacing: -0.02em;
    line-height: 1.3;
    margin: 0 0 8px 0;
    word-break: break-word;
  }

  .doc-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 9999px;
    background: #fdfaf6;
    border: 1px solid #e8ded3;
    color: #8c5b28;
    font-size: 11px;
    font-weight: 600;
  }

  /* Multi-turn Block */
  .turn-block {
    margin-bottom: 28px;
  }

  /* User Message Box */
  .user-message {
    background: #fbf8f4;
    border: 1px solid #ede3d7;
    border-left: 4px solid #b8864d;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 18px;
  }

  .user-message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #8c5b28;
  }

  .user-message-content {
    font-size: 14.5px;
    font-weight: 500;
    color: #292524;
    line-height: 1.5;
    word-break: break-word;
  }

  /* Assistant Message Box */
  .assistant-message {
    padding: 0 0 16px 0;
  }

  .assistant-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid #f2ece4;
  }

  .assistant-sender {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #1c1917;
  }

  .assistant-badge {
    font-size: 9.5px;
    background: #f5ede4;
    color: #9c6d3a;
    padding: 1px 7px;
    border-radius: 4px;
    font-weight: 600;
    text-transform: uppercase;
  }

  /* Typography */
  .content {
    font-size: 13.5px;
    color: #1f1a16;
    line-height: 1.65;
    word-break: break-word;
  }

  .content p {
    margin: 0 0 12px 0;
  }

  h1 { font-size: 18px; font-weight: 700; color: #111827; margin: 22px 0 10px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h2 { font-size: 15.5px; font-weight: 700; color: #1f2937; margin: 18px 0 8px 0; border-bottom: 1px solid #f3f4f6; padding-bottom: 3px; }
  h3 { font-size: 14px; font-weight: 600; color: #374151; margin: 15px 0 6px 0; }
  h4 { font-size: 13px; font-weight: 600; color: #4b5563; margin: 13px 0 5px 0; }
  h5, h6 { font-size: 12px; font-weight: 600; color: #6b7280; margin: 11px 0 4px 0; }

  ul, ol {
    margin: 0 0 12px 0;
    padding-left: 22px;
  }

  li {
    margin-bottom: 4px;
  }

  .task-list {
    list-style: none;
    padding-left: 2px;
  }

  .task-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  blockquote {
    margin: 12px 0;
    padding: 8px 14px;
    border-left: 3px solid #d4a373;
    background: #fdfaf7;
    color: #57534e;
    font-style: italic;
    border-radius: 0 6px 6px 0;
  }

  .inline-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    background: #f5ede4;
    color: #8c5b28;
    padding: 2px 5px;
    border-radius: 4px;
  }

  /* Links & Citations */
  a.doc-link {
    color: #b8864d;
    text-decoration: underline;
  }

  .citation-ref {
    display: inline-block;
    font-size: 9px;
    font-weight: 600;
    color: #b8864d;
    background: #fdfaf6;
    border: 1px solid #eedecf;
    border-radius: 4px;
    padding: 0 4px;
    margin: 0 1.5px;
    vertical-align: super;
    line-height: 1.1;
    text-decoration: none;
  }

  /* Callout Alert Blocks */
  .callout-block {
    margin: 14px 0;
    padding: 10px 14px;
    border-radius: 8px;
    border-left: 4px solid;
    font-size: 12.5px;
  }

  .callout-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-weight: 700;
    font-size: 10.5px;
    letter-spacing: 0.05em;
  }

  .callout-note {
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-left: 4px solid #3b82f6;
  }
  .callout-note .callout-badge { color: #1d4ed8; }

  .callout-tip {
    background: #ecfdf5;
    border: 1px solid #d1fae5;
    border-left: 4px solid #10b981;
  }
  .callout-tip .callout-badge { color: #047857; }

  .callout-warning {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-left: 4px solid #f59e0b;
  }
  .callout-warning .callout-badge { color: #b45309; }

  .callout-important {
    background: #faf5ff;
    border: 1px solid #f3e8ff;
    border-left: 4px solid #a855f7;
  }
  .callout-important .callout-badge { color: #7e22ce; }

  .callout-caution {
    background: #fff1f2;
    border: 1px solid #ffe4e6;
    border-left: 4px solid #f43f5e;
  }
  .callout-caution .callout-badge { color: #be123c; }

  .callout-content {
    color: #1f2937;
    line-height: 1.5;
  }

  /* Tables */
  table.doc-table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 12px;
  }

  table.doc-table th, table.doc-table td {
    border: 1px solid #e2d9cf;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }

  table.doc-table th {
    background-color: #f7f3ed;
    color: #1c1917;
    font-weight: 600;
  }

  table.doc-table tbody tr:nth-child(even) {
    background-color: #faf7f3;
  }

  /* Code Blocks */
  .code-block {
    margin: 14px 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .code-header {
    background: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 600;
    font-family: monospace;
    padding: 4px 10px;
    border-bottom: 1px solid #e2e8f0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .code-block pre {
    margin: 0;
    padding: 10px 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11.5px;
    line-height: 1.45;
    color: #0f172a;
    white-space: pre-wrap;
    word-break: break-all;
  }

  /* Mermaid Diagram */
  .mermaid-diagram-box {
    margin: 16px 0;
    background: #ffffff;
    border: 1px solid #ede5dc;
    border-radius: 8px;
    overflow: hidden;
    padding: 12px;
    text-align: center;
  }

  .mermaid-diagram-box .diagram-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #8c5b28;
    margin-bottom: 8px;
    text-align: left;
  }

  .mermaid-diagram-box svg {
    max-width: 100%;
    height: auto;
    margin: 0 auto;
  }

  /* Sources & References */
  .document-sources {
    margin-top: 28px;
    padding-top: 18px;
    border-top: 2px solid #b8864d;
  }

  .sources-heading {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .sources-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .source-card {
    padding: 8px 12px;
    border: 1px solid #e8dfd5;
    border-radius: 6px;
    background: #fdfbf8;
    font-size: 11px;
  }

  .source-card-top {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin-bottom: 2px;
  }

  .source-num {
    color: #b8864d;
    font-weight: 700;
    font-size: 11.5px;
  }

  .source-main-link {
    color: #8c5b28;
    font-weight: 600;
    text-decoration: underline;
  }

  .source-main-text {
    color: #1c1917;
    font-weight: 600;
  }

  .source-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 0 4px 0;
    font-size: 9.5px;
  }

  .source-domain-chip {
    color: #78716c;
    background: #f5ece1;
    padding: 1px 6px;
    border-radius: 3px;
    font-weight: 500;
  }

  .source-date-chip {
    color: #a8a29e;
  }

  .source-snippet-box {
    color: #57534e;
    font-size: 10px;
    font-style: italic;
    line-height: 1.4;
  }

  /* Telemetry Metadata */
  .telemetry-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px dashed #e8dfd5;
    font-size: 10px;
    color: #78716c;
    font-family: ui-monospace, monospace;
  }

  .telemetry-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #fcf9f5;
    border: 1px solid #e8ded3;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .telemetry-tag.model {
    color: #8c5b28;
    font-weight: 600;
  }

  .doc-divider {
    border: 0;
    height: 1px;
    background-color: #ede5dc;
    margin: 20px 0;
  }

  /* Document Footer */
  .doc-footer {
    border-top: 1px solid #f0e6dc;
    margin-top: 32px;
    padding-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
    color: #a8a29e;
    flex-wrap: wrap;
    gap: 8px;
  }
`;

/**
 * Builds a complete standalone HTML document for printing a multi-turn chat export
 */
export const buildChatPrintDocumentHtml = async (
  config: PrintDocumentConfig,
): Promise<string> => {
  const { title, locale = 'en', subtitle, turns, labels = {} } = config;
  const dateStr = new Date().toLocaleString(locale || undefined);

  let turnsHtml = '';
  for (let idx = 0; idx < turns.length; idx++) {
    const turn = turns[idx];
    const assistantRendered = await convertMarkdownToPrintHtml(
      turn.assistantText,
      {
        includeSources: true,
        sources: turn.sources,
        sourcesHeadingText: labels.sourcesTitle
          ? labels.sourcesTitle(turn.sources?.length || 0)
          : undefined,
      },
    );

    turnsHtml += `
      <div class="turn-block">
        <!-- User Query -->
        <div class="user-message">
          <div class="user-message-header">
            <span>${escapeHtml(labels.queryNum ? labels.queryNum(idx + 1) : `Query ${idx + 1}`)}</span>
            <span>${escapeHtml(turn.userDate || dateStr)}</span>
          </div>
          <div class="user-message-content">${escapeHtml(turn.userQuery)}</div>
        </div>

        <!-- Assistant Response -->
        <div class="assistant-message">
          <div class="assistant-header">
            <div class="assistant-sender">
              ${VANE_LOGO_SVG}
              <span>${escapeHtml(labels.vaneAnswer || 'Vane Assistant')}</span>
              <span class="assistant-badge">AI</span>
            </div>
            <span style="font-size: 11px; color: #78716c;">${escapeHtml(turn.assistantDate || turn.userDate || dateStr)}</span>
          </div>
          
          <div class="content">${assistantRendered}</div>

          ${
            turn.metrics
              ? `
            <div class="telemetry-row">
              ${turn.metrics.modelKey ? `<span class="telemetry-tag model">${escapeHtml(labels.model || 'Model')}: ${escapeHtml(turn.metrics.modelKey)}</span>` : ''}
              ${turn.metrics.durationMs ? `<span class="telemetry-tag">${escapeHtml(labels.time || 'Time')}: ${(turn.metrics.durationMs / 1000).toFixed(1)}s</span>` : ''}
              ${turn.metrics.totalTokens ? `<span class="telemetry-tag">${escapeHtml(labels.tokens || 'Tokens')}: ${turn.metrics.totalTokens}</span>` : ''}
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title || 'Vane Chat Export')}</title>
  <style>
    ${PRINT_STYLESHEET}
  </style>
</head>
<body>
  <div class="doc-container">
    <!-- Brand Header -->
    <div class="brand-header">
      <div class="brand-logo-title">
        ${VANE_LOGO_SVG}
        <div class="brand-text">
          <span class="brand-name">Vane</span>
          <span class="brand-sub">Community</span>
        </div>
      </div>
      <div class="doc-meta">
        <div><strong>${escapeHtml(labels.exportReport || 'Report Export')}</strong></div>
        <div>${escapeHtml(dateStr)}</div>
      </div>
    </div>

    <!-- Title Section -->
    <div class="doc-title-section">
      <h1 class="doc-title">${escapeHtml(title)}</h1>
      ${subtitle ? `<p style="margin: 4px 0 8px 0; color: #78716c; font-size: 12px;">${escapeHtml(subtitle)}</p>` : ''}
      <span class="doc-badge">${escapeHtml(labels.queriesCount ? labels.queriesCount(turns.length) : `${turns.length} queries`)}</span>
    </div>

    <!-- Conversation Turns -->
    <div class="doc-content">
      ${turnsHtml}
    </div>

    <!-- Document Footer -->
    <div class="doc-footer">
      <span>${escapeHtml(labels.generatedBy || 'Generated by Vane Community')}</span>
      <span>${escapeHtml(dateStr)}</span>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Builds a complete standalone HTML document for printing a single note (e.g. Scratchpad)
 */
export const buildNotePrintDocumentHtml = async (
  config: SingleNotePrintConfig,
): Promise<string> => {
  const {
    title,
    content,
    sources = [],
    includeSources = true,
    locale = 'en',
    sourcesHeading,
    untitledText = 'Untitled Note',
    metaSubtitle = 'Vane Scratchpad',
  } = config;

  const docTitle = title || untitledText;
  const dateStr = new Date().toLocaleDateString(locale || 'en-US');

  const renderedContent = await convertMarkdownToPrintHtml(content, {
    includeSources,
    sources,
    sourcesHeadingText: sourcesHeading,
  });

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(docTitle)}</title>
  <style>
    ${PRINT_STYLESHEET}
  </style>
</head>
<body>
  <div class="doc-container">
    <!-- Brand Header -->
    <div class="brand-header">
      <div class="brand-logo-title">
        ${VANE_LOGO_SVG}
        <div class="brand-text">
          <span class="brand-name">Vane</span>
          <span class="brand-sub">Community</span>
        </div>
      </div>
      <div class="doc-meta">
        <div><strong>${escapeHtml(metaSubtitle)}</strong></div>
        <div>${escapeHtml(dateStr)}</div>
      </div>
    </div>

    <!-- Title Section -->
    <div class="doc-title-section">
      <h1 class="doc-title">${escapeHtml(docTitle)}</h1>
    </div>

    <!-- Document Content -->
    <div class="doc-content">
      ${renderedContent}
    </div>

    <!-- Document Footer -->
    <div class="doc-footer">
      <span>Generated by Vane Community</span>
      <span>${escapeHtml(dateStr)}</span>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Creates an isolated hidden iframe and triggers browser print
 */
export const executeIframePrint = (html: string): void => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2500);
  }, 300);
};
