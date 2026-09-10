'use client';

import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import SyntaxHighlighter from 'react-syntax-highlighter';
import darkTheme from './CodeBlockDarkTheme';
import lightTheme from './CodeBlockLightTheme';

const SyntaxHighlighterComponent =
  SyntaxHighlighter as unknown as React.ComponentType<any>;

const CodeBlock = ({
  language,
  children,
}: {
  language: string;
  children: React.ReactNode;
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const syntaxTheme = useMemo(() => {
    if (!mounted) return lightTheme;
    return resolvedTheme === 'dark' ? darkTheme : lightTheme;
  }, [mounted, resolvedTheme]);

  const extractText = (node: any): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (!node) return '';
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (typeof node === 'object') {
      if (node.props && node.props.children) {
        return extractText(node.props.children);
      }
      if (node.text) return String(node.text);
    }
    return '';
  };

  const codeString = useMemo(() => {
    return extractText(children);
  }, [children]);

  return (
    <div className="relative">
      <button
        className="absolute top-2 right-2 p-1"
        onClick={() => {
          try {
            navigator.clipboard.writeText(codeString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch (err) {
            console.error('Failed to copy code block:', err);
          }
        }}
      >
        {copied ? (
          <CheckIcon
            size={16}
            className="absolute top-2 right-2 text-black/70 dark:text-white/70"
          />
        ) : (
          <CopyIcon
            size={16}
            className="absolute top-2 right-2 transition duration-200 text-black/70 dark:text-white/70 hover:text-gray-800/70 hover:dark:text-gray-300/70"
          />
        )}
      </button>
      <SyntaxHighlighterComponent
        language={language}
        style={syntaxTheme}
        showInlineLineNumbers
      >
        {codeString}
      </SyntaxHighlighterComponent>
    </div>
  );
};

export default CodeBlock;
