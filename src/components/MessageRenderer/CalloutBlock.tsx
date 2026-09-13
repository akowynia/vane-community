'use client';

import React from 'react';
import {
  Info,
  Lightbulb,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  LucideIcon,
} from 'lucide-react';

type CalloutType = 'note' | 'tip' | 'warning' | 'important' | 'caution';

interface CalloutConfig {
  icon: LucideIcon;
  defaultTitle: string;
  containerClass: string;
  badgeClass: string;
  iconClass: string;
  titleClass: string;
}

const CALLOUT_CONFIGS: Record<CalloutType, CalloutConfig> = {
  note: {
    icon: Info,
    defaultTitle: 'Note',
    containerClass:
      'bg-blue-50/70 dark:bg-blue-950/25 border-blue-200 dark:border-blue-800/60 border-l-blue-500 dark:border-l-blue-400',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    iconClass: 'text-blue-500 dark:text-blue-400',
    titleClass: 'text-blue-900 dark:text-blue-200',
  },
  tip: {
    icon: Lightbulb,
    defaultTitle: 'Tip',
    containerClass:
      'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/60 border-l-emerald-500 dark:border-l-emerald-400',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
    iconClass: 'text-emerald-500 dark:text-emerald-400',
    titleClass: 'text-emerald-900 dark:text-emerald-200',
  },
  warning: {
    icon: AlertTriangle,
    defaultTitle: 'Warning',
    containerClass:
      'bg-amber-50/80 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/60 border-l-amber-500 dark:border-l-amber-400',
    badgeClass: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
    iconClass: 'text-amber-600 dark:text-amber-400',
    titleClass: 'text-amber-950 dark:text-amber-200',
  },
  important: {
    icon: AlertCircle,
    defaultTitle: 'Important',
    containerClass:
      'bg-purple-50/70 dark:bg-purple-950/25 border-purple-200 dark:border-purple-800/60 border-l-purple-500 dark:border-l-purple-400',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/50',
    iconClass: 'text-purple-500 dark:text-purple-400',
    titleClass: 'text-purple-900 dark:text-purple-200',
  },
  caution: {
    icon: ShieldAlert,
    defaultTitle: 'Caution',
    containerClass:
      'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/60 border-l-rose-500 dark:border-l-rose-400',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
    iconClass: 'text-rose-500 dark:text-rose-400',
    titleClass: 'text-rose-900 dark:text-rose-200',
  },
};

const CALLOUT_REGEX = /^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*([\s\S]*)$/i;

/**
 * Recursively inspect and strip the leading [!TYPE] marker from the react node tree
 */
const extractCalloutData = (
  nodes: React.ReactNode,
): { type: CalloutType | null; cleanContent: React.ReactNode } => {
  if (!nodes) {
    return { type: null, cleanContent: nodes };
  }

  if (typeof nodes === 'string') {
    const match = nodes.match(CALLOUT_REGEX);
    if (match) {
      const type = match[1].toLowerCase() as CalloutType;
      const rest = match[2];
      return { type, cleanContent: rest.trimStart() };
    }
    return { type: null, cleanContent: nodes };
  }

  if (Array.isArray(nodes)) {
    if (nodes.length === 0) return { type: null, cleanContent: nodes };

    const first = nodes[0];
    const extracted = extractCalloutData(first);

    if (extracted.type) {
      const remainingNodes = nodes.slice(1);
      const newFirst = extracted.cleanContent;
      const cleanList =
        newFirst !== '' && newFirst !== null && newFirst !== undefined
          ? [newFirst, ...remainingNodes]
          : remainingNodes;
      return {
        type: extracted.type,
        cleanContent: cleanList,
      };
    }
    return { type: null, cleanContent: nodes };
  }

  if (React.isValidElement(nodes)) {
    const props = (nodes as React.ReactElement<any>).props;
    if (props && props.children) {
      const extracted = extractCalloutData(props.children);
      if (extracted.type) {
        return {
          type: extracted.type,
          cleanContent: React.cloneElement(nodes, {
            ...props,
            children: extracted.cleanContent,
          }),
        };
      }
    }
  }

  return { type: null, cleanContent: nodes };
};

const CalloutBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { type, cleanContent } = extractCalloutData(children);

  if (!type) {
    return (
      <blockquote className="my-4 border-l-4 border-stone-300 dark:border-[#383027] pl-4 py-1 italic text-black/80 dark:text-white/80 bg-light-secondary/40 dark:bg-dark-secondary/40 rounded-r-lg">
        {children}
      </blockquote>
    );
  }

  const config = CALLOUT_CONFIGS[type] || CALLOUT_CONFIGS.note;
  const IconComponent = config.icon;

  return (
    <div
      className={`my-4 rounded-xl border border-l-4 p-3.5 sm:p-4 text-sm leading-relaxed transition-all shadow-sm ${config.containerClass}`}
      role="region"
      aria-label={config.defaultTitle}
    >
      <div className="flex items-center gap-2 mb-2">
        <IconComponent size={17} className={`shrink-0 ${config.iconClass}`} />
        <span
          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${config.badgeClass} ${config.titleClass}`}
        >
          {config.defaultTitle}
        </span>
      </div>
      <div className="text-stone-800 dark:text-stone-200 prose prose-sm dark:prose-invert max-w-none [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {cleanContent}
      </div>
    </div>
  );
};

export default CalloutBlock;
