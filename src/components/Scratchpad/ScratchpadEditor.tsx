'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table as TableIcon,
  Minus,
  Sparkles,
  Eye,
  Edit3,
  Columns,
  Maximize2,
  Minimize2,
  Save,
  Check,
  Layers,
  Info,
  X,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import CodeBlock from '../MessageRenderer/CodeBlock';
import { useTranslation } from '@/lib/i18n';

interface ScratchpadEditorProps {
  content: string;
  onChange: (newContent: string) => void;
  onSelectText?: (selectedText: string | null) => void;
  onAskAiAboutSelection?: (selectedText: string) => void;
  selectedText?: string | null;
  readOnly?: boolean;
  isGenerating?: boolean;
  hoveredSourceIndex?: number | null;
  onHoverCitation?: (index: number | null) => void;
  templateInfo?: { id?: string; name?: string; icon?: string; isBuiltin?: boolean } | null;
}

const ScratchpadEditor: React.FC<ScratchpadEditorProps> = ({
  content,
  onChange,
  onSelectText,
  onAskAiAboutSelection,
  selectedText,
  readOnly = false,
  isGenerating = false,
  hoveredSourceIndex = null,
  onHoverCitation,
  templateInfo = null,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [isTemplateBannerDismissed, setIsTemplateBannerDismissed] = useState(false);

  // Check if template info is present or if content contains template placeholder structures
  const isTemplateActive = useMemo(() => {
    if (templateInfo) return true;
    if (!content) return false;
    const hasPlaceholders = /\[(?:Title|Topic|Article|Heading|Name)[^\]]*\]/i.test(content);
    const hasTemplateSections = /(?:##\s*Introduction|##\s*Main Aspects|##\s*Perspectives|##\s*1\.\s*Introduction)/i.test(content) && content.length < 2000;
    return hasPlaceholders || hasTemplateSections;
  }, [templateInfo, content]);

  const showTemplateBanner = isTemplateActive && !isTemplateBannerDismissed;

  const isLocked = Boolean(readOnly || isGenerating);

  // Process markdown text so that sentences with citations [1], [2] and user selection are wrapped with interactive hooks
  const processedPreviewContent = useMemo(() => {
    if (!content) return '';

    const lines = content.split('\n');
    let inCodeBlock = false;

    const processedLines = lines.map((line) => {
      // Toggle code block state - never alter text inside code blocks
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        return line;
      }
      if (inCodeBlock) return line;

      // Skip table delimiter rows (e.g., | :--- | :--- |)
      if (/^\s*\|?\s*[:\-]+(?:\s*\|\s*[:\-]+)+\s*\|?\s*$/.test(line)) {
        return line;
      }

      // Check if line is a table row (contains pipes)
      if (line.includes('|')) {
        const cells = line.split('|');
        const processedCells = cells.map((cell, idx) => {
          // Keep empty boundary parts of "| cell 1 | cell 2 |" untouched
          if ((idx === 0 || idx === cells.length - 1) && !cell.trim()) {
            return cell;
          }

          let cellText = cell;
          // Process citations within this cell boundary only without crossing pipe delimiters
          const cellCitationRegex = /([^.\n?!;:*#_`]*?)\s*\[([\d,\s]+)\]/g;
          cellText = cellText.replace(cellCitationRegex, (match, clause, numbersStr) => {
            const numbers = numbersStr.split(',').map((n: string) => n.trim()).filter(Boolean);
            const primaryNum = numbers[0];
            const trimmedClause = clause.trim();
            if (!trimmedClause) {
              return `<span className="citation-badge" data-source="${primaryNum}" data-sources="${numbers.join(',')}">${primaryNum}</span>`;
            }
            return `<span className="citation-wrapper" data-sources="${numbers.join(',')}">${clause} <span className="citation-badge" data-source="${primaryNum}">${primaryNum}</span></span>`;
          });
          return cellText;
        });
        return processedCells.join('|');
      }

      // Regular lines (prose, list items, headings)
      let processedLine = line;
      const lineCitationRegex = /([^.\n?!;:#>|]+?)\s*\[([\d,\s]+)\]/g;
      processedLine = processedLine.replace(lineCitationRegex, (match, sentence, numbersStr) => {
        const numbers = numbersStr.split(',').map((n: string) => n.trim()).filter(Boolean);
        const primaryNum = numbers[0];
        return `<span className="citation-wrapper" data-sources="${numbers.join(',')}">${sentence} <span className="citation-badge" data-source="${primaryNum}">${primaryNum}</span></span>`;
      });

      // Also handle isolated citation tags if any remain
      processedLine = processedLine.replace(/(?<![a-zA-Z0-9_-])\[([\d,\s]+)\]/g, (match, numbersStr) => {
        const numbers = numbersStr.split(',').map((n: string) => n.trim()).filter(Boolean);
        const primaryNum = numbers[0];
        return `<span className="citation-badge" data-source="${primaryNum}" data-sources="${numbers.join(',')}">${primaryNum}</span>`;
      });

      return processedLine;
    });

    let result = processedLines.join('\n');

    // Highlight user selected snippet if present in document without breaking table markup
    if (selectedText && selectedText.trim().length > 1) {
      const trimmed = selectedText.trim();
      if (!trimmed.includes('\n') && !trimmed.includes('|')) {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
          const selRegex = new RegExp(`(${escaped})`, 'gi');
          result = result.replace(selRegex, '<span data-selected="true">$1</span>');
        } catch {}
      }
    }

    return result;
  }, [content, selectedText]);

  const markdownOverrides: MarkdownToJSX.Options = {
    overrides: {
      table: {
        component: ({ children, ...props }: any) => (
          <div className="w-full my-4 overflow-x-auto rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-secondary/20 dark:bg-[#16120f]/40 shadow-sm">
            <table className="w-full min-w-full border-collapse text-left text-xs sm:text-sm" {...props}>
              {children}
            </table>
          </div>
        ),
      },
      thead: {
        component: ({ children, ...props }: any) => (
          <thead className="bg-light-secondary/80 dark:bg-[#1f1a15] text-stone-900 dark:text-stone-100 border-b border-light-200 dark:border-[#2a241d] font-semibold" {...props}>
            {children}
          </thead>
        ),
      },
      th: {
        component: ({ children, ...props }: any) => (
          <th className="px-3.5 py-2.5 font-semibold text-stone-900 dark:text-stone-100 border-r border-light-200/60 dark:border-[#2a241d]/60 last:border-r-0 whitespace-nowrap" {...props}>
            {children}
          </th>
        ),
      },
      tbody: {
        component: ({ children, ...props }: any) => (
          <tbody className="divide-y divide-light-200/60 dark:divide-[#2a241d]/60" {...props}>
            {children}
          </tbody>
        ),
      },
      tr: {
        component: ({ children, ...props }: any) => (
          <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors" {...props}>
            {children}
          </tr>
        ),
      },
      td: {
        component: ({ children, ...props }: any) => (
          <td className="px-3.5 py-2.5 text-stone-700 dark:text-stone-300 border-r border-light-200/40 dark:border-[#2a241d]/40 last:border-r-0 align-top break-words" {...props}>
            {children}
          </td>
        ),
      },
      span: {
        component: ({ className, 'data-sources': dataSources, 'data-source': dataSource, 'data-selected': dataSelected, children, ...props }: any) => {
          if (dataSelected) {
            return (
              <span
                {...props}
                className="bg-[#b8864d]/25 dark:bg-[#b8864d]/30 text-stone-900 dark:text-stone-100 ring-2 ring-[#b8864d]/60 rounded-md px-1.5 py-0.5 font-medium shadow-sm transition-all inline"
              >
                {children}
              </span>
            );
          }

          if (dataSources) {
            const sourcesList = String(dataSources).split(',').map((n) => parseInt(n.trim(), 10));
            const isHighlighted = hoveredSourceIndex !== null && hoveredSourceIndex !== undefined && sourcesList.includes(hoveredSourceIndex);

            return (
              <span
                {...props}
                className={`transition-all duration-200 inline ${
                  isHighlighted
                    ? 'bg-amber-300/60 dark:bg-amber-400/40 text-stone-950 dark:text-stone-50 ring-2 ring-amber-400/90 rounded-md px-1.5 py-0.5 font-semibold shadow-md animate-pulse'
                    : ''
                }`}
              >
                {children}
              </span>
            );
          }

          if (dataSource) {
            const sourceNum = parseInt(String(dataSource), 10);
            const isHighlighted = hoveredSourceIndex === sourceNum;

            return (
              <button
                type="button"
                onMouseEnter={() => onHoverCitation?.(sourceNum)}
                onMouseLeave={() => onHoverCitation?.(null)}
                onClick={() => onAskAiAboutSelection?.(`Regarding source [${sourceNum}]`)}
                title={`Source [${sourceNum}]`}
                className={`inline-flex items-center justify-center mx-1 px-1.5 py-0.2 text-[10px] font-bold rounded-md border align-super cursor-pointer transition-all ${
                  isHighlighted
                    ? 'bg-amber-400 text-stone-950 border-amber-500 scale-110 shadow-sm font-extrabold ring-1 ring-amber-500'
                    : 'text-[#b8864d] bg-[#b8864d]/10 hover:bg-[#b8864d]/25 border-[#b8864d]/30'
                }`}
              >
                [{sourceNum}]
              </button>
            );
          }

          return <span className={className} {...props}>{children}</span>;
        },
      },
    },
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return (
          <code key={state.key} className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs text-[#b8864d]">
            {node.text ?? ''}
          </code>
        );
      }
      if (node.type === RuleType.codeBlock) {
        return (
          <CodeBlock key={state.key} language={node.lang || ''}>
            {node.text ?? ''}
          </CodeBlock>
        );
      }
      return next();
    },
  };

  const handleTextSelect = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;

    if (start !== end) {
      const selected = content.slice(start, end);
      setSelectionRange({ start, end });
      onSelectText?.(selected);
    } else {
      setSelectionRange(null);
      onSelectText?.(null);
    }
  };

  const insertFormat = (before: string, after: string = '', defaultText: string = '') => {
    if (isLocked || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || defaultText;

    const newContent =
      content.slice(0, start) + before + selected + after + content.slice(end);

    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    }, 0);
  };

  const insertPrefix = (prefix: string) => {
    if (isLocked || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const lineStart = content.lastIndexOf('\n', start - 1) + 1;
    const newContent =
      content.slice(0, lineStart) + prefix + content.slice(lineStart);

    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length,
      );
    }, 0);
  };

  const wordsCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const charsCount = content ? content.length : 0;

  const btnClass = `p-1.5 rounded-lg transition ${
    isLocked
      ? 'text-stone-400 dark:text-stone-600 opacity-40 cursor-not-allowed'
      : 'text-stone-600 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'
  }`;

  return (
    <div className="flex flex-col h-full bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#221c16] rounded-2xl overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#181411]/60 gap-2">
        {/* Formatting Actions */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('**', '**', 'bold text')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarBold') || 'Bold (Ctrl+B)'}
            className={btnClass}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('*', '*', 'italic text')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarItalic') || 'Italic (Ctrl+I)'}
            className={btnClass}
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('~~', '~~', 'strikethrough text')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarStrikethrough') || 'Strikethrough'}
            className={btnClass}
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-stone-300 dark:bg-stone-700 mx-1" />

          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('# ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarHeading1') || 'Heading 1'}
            className={btnClass}
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('## ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarHeading2') || 'Heading 2'}
            className={btnClass}
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('### ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarHeading3') || 'Heading 3'}
            className={btnClass}
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-stone-300 dark:bg-stone-700 mx-1" />

          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('- ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarBulletList') || 'Bulleted list'}
            className={btnClass}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('1. ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarNumberedList') || 'Numbered list'}
            className={btnClass}
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('- [ ] ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarChecklist') || 'Checklist'}
            className={btnClass}
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-stone-300 dark:bg-stone-700 mx-1" />

          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('`', '`', 'code')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarInlineCode') || 'Inline code'}
            className={btnClass}
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('```typescript\n', '\n```', 'code()')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarCodeBlock') || 'Code block'}
            className={`${btnClass} text-xs font-mono`}
          >
            {'</>'}
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertPrefix('> ')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarQuote') || 'Quote'}
            className={btnClass}
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |\n\n')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarTable') || 'Table'}
            className={btnClass}
          >
            <TableIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={() => insertFormat('\n\n---\n\n')}
            title={isLocked ? t('scratchpad.aiEditingLocked') || 'AI is generating... (editing locked)' : t('scratchpad.toolbarDivider') || 'Divider'}
            className={btnClass}
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* AI Generating Indicator in Toolbar & View Mode Controls */}
        <div className="flex items-center space-x-2">
          {isGenerating && (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs animate-pulse">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span className="font-medium hidden sm:inline">{t('scratchpad.aiGeneratingNote') || 'AI is editing note...'}</span>
            </div>
          )}

          {/* View Mode Controls */}
          <div className="flex items-center space-x-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                viewMode === 'edit'
                  ? 'bg-light-primary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{t('scratchpad.editMode') || 'Edit'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                viewMode === 'split'
                  ? 'bg-light-primary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{t('scratchpad.splitMode') || 'Split'}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-medium transition ${
                viewMode === 'preview'
                  ? 'bg-light-primary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t('scratchpad.previewMode') || 'Preview'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Template Guide Banner */}
      {showTemplateBanner && (
        <div className="bg-gradient-to-r from-amber-500/10 via-[#b8864d]/10 to-amber-500/5 border-b border-[#b8864d]/25 px-4 py-2.5 flex items-center justify-between text-xs animate-fadeIn transition-all">
          <div className="flex items-center space-x-2.5 text-stone-700 dark:text-stone-300 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#b8864d]/20 text-[#b8864d] shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {templateInfo?.name || t('scratchpad.templateBannerTitle') || 'Document Template'}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#b8864d]/20 text-[#b8864d] font-bold">
                  {t('scratchpad.templates') || 'Templates'}
                </span>
              </div>
              <p className="text-[11.5px] text-stone-600 dark:text-stone-400 leading-normal mt-0.5">
                {t('scratchpad.templateBannerDesc') || 'The template below defines what the document will look like and what it will consist of. Enter a prompt in the chat, and AI will populate its sections.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTemplateBannerDismissed(true)}
            className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition ml-3 shrink-0"
            title={t('scratchpad.templateBannerDismiss') || 'Dismiss'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Selection AI Quick Action */}
      {selectedText && (
        <div className="bg-[#b8864d]/10 border-b border-[#b8864d]/30 px-4 py-2 flex items-center justify-between animate-fadeIn text-xs">
          <div className="flex items-center space-x-2 text-stone-700 dark:text-stone-300 truncate">
            <Sparkles className="w-3.5 h-3.5 text-[#b8864d] shrink-0" />
            <span className="font-semibold text-[#b8864d]">{t('scratchpad.selectedCount') || 'Selected'} ({selectedText.length} {t('scratchpad.charsCount') || 'chars'}):</span>
            <span className="truncate italic text-stone-500 dark:text-stone-400">"{selectedText}"</span>
          </div>
          {onAskAiAboutSelection && (
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onAskAiAboutSelection(selectedText)}
              className={`px-3 py-1 bg-[#b8864d] text-stone-950 rounded-lg text-xs font-medium transition shrink-0 ml-3 ${
                isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
              }`}
            >
              {t('scratchpad.askAiAboutSelection') || 'Ask AI about selection'}
            </button>
          )}
        </div>
      )}

      {/* Editor & Preview Body */}
      <div className="flex-1 relative overflow-hidden flex flex-row">
        {/* Editor Area */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`h-full overflow-y-auto ${viewMode === 'split' ? 'w-1/2 border-r border-light-200 dark:border-[#221c16]' : 'w-full'}`}>
            <textarea
              ref={textareaRef}
              value={content}
              readOnly={isLocked}
              disabled={isLocked}
              onSelect={handleTextSelect}
              onKeyUp={handleTextSelect}
              onMouseUp={handleTextSelect}
              onChange={(e) => {
                if (!isLocked) {
                  onChange(e.target.value);
                }
              }}
              placeholder={
                isGenerating
                  ? (t('scratchpad.aiGeneratingNote') || 'AI is editing note...')
                  : (t('scratchpad.editorPlaceholder') || 'Write note content or ask AI to draft it in the chat...')
              }
              className={`w-full h-full p-6 bg-transparent text-sm leading-relaxed text-stone-900 dark:text-stone-100 font-sans resize-none focus:outline-none placeholder:text-stone-400 dark:placeholder:text-stone-600 ${
                isLocked ? 'cursor-not-allowed select-text opacity-90' : ''
              }`}
            />
          </div>
        )}

        {/* Preview Area */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`h-full overflow-y-auto p-6 ${viewMode === 'split' ? 'w-1/2' : 'w-full'} bg-light-primary dark:bg-[#120f0d]`}>
            {content.trim() ? (
              <div className="prose prose-stone dark:prose-invert max-w-none text-sm leading-relaxed">
                <Markdown options={markdownOverrides}>{processedPreviewContent || content}</Markdown>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-400 dark:text-stone-600 italic">
                {t('scratchpad.previewEmpty') || '(Preview will appear here once content is entered)'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#16120f]/40 text-[11px] text-stone-400 dark:text-stone-500">
        <div className="flex items-center space-x-3">
          <span>{wordsCount} {t('scratchpad.wordsCount') || 'words'}</span>
          <span>•</span>
          <span>{charsCount} {t('scratchpad.charsCount') || 'chars'}</span>
        </div>
        <div className="flex items-center space-x-2">
          {isGenerating ? (
            <span className="flex items-center space-x-1.5 text-amber-500 animate-pulse font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>{t('scratchpad.aiGeneratingNote') || 'AI is editing note...'}</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-emerald-500">
              <Check className="w-3 h-3" />
              <span>{t('scratchpad.saved') || 'Saved'}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScratchpadEditor;
