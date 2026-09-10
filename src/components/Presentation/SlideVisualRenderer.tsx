'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  Layers,
  Cpu,
  Shield,
  Workflow,
  TrendingUp,
  Sparkles,
  GitBranch,
  Network,
  Database,
  Lock,
  Globe,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export interface VisualBlockData {
  type: 'vector_infographic' | 'process_flow' | 'metric_card' | 'public_domain_image' | 'cards';
  title: string;
  badge?: string;
  icon?: string;
  description?: string;
  steps?: Array<{ label: string; desc: string }>;
  cards?: Array<{ title: string; description?: string; impact?: string; icon?: string }>;
  licenseInfo?: {
    license: string;
    author?: string;
    sourceUrl?: string;
  };
}

interface SlideVisualRendererProps {
  data: VisualBlockData;
  accentColor?: string;
}

const iconMap: Record<string, any> = {
  Layers,
  Cpu,
  Shield,
  Workflow,
  TrendingUp,
  Sparkles,
  GitBranch,
  Network,
  Database,
  Lock,
  Globe,
};

export const SlideVisualRenderer: React.FC<SlideVisualRendererProps> = ({
  data,
  accentColor = '#38bdf8',
}) => {
  const { t } = useTranslation();
  const IconComponent = data.icon && iconMap[data.icon] ? iconMap[data.icon] : Sparkles;

  return (
    <div className="my-4 p-5 rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 shadow-lg text-stone-100 flex flex-col justify-between">
      {/* Visual Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div
            className="p-2 rounded-xl border border-white/20 shadow-sm text-white"
            style={{ backgroundColor: `${accentColor}25` }}
          >
            <IconComponent className="w-4 h-4" style={{ color: accentColor }} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide">{data.title}</h4>
            {data.description && (
              <p className="text-xs text-stone-300 mt-0.5 leading-relaxed">{data.description}</p>
            )}
          </div>
        </div>

        {data.badge && (
          <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-semibold text-stone-300">
            {data.badge}
          </span>
        )}
      </div>

      {/* Process Flow Steps if provided */}
      {Array.isArray(data.steps) && data.steps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
          {data.steps.map((step, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex items-center space-x-2 mb-1.5">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold font-mono flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="text-xs font-bold text-white line-clamp-1">{step.label}</span>
              </div>
              <p className="text-[11px] text-stone-400 leading-snug">{step.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Concept & Comparison Cards if provided */}
      {Array.isArray(data.cards) && data.cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
          {data.cards.map((card, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between hover:border-amber-500/30 transition shadow-sm"
            >
              <div>
                <h5 className="text-xs font-bold text-white mb-1 tracking-wide">{card.title}</h5>
                {card.description && (
                  <p className="text-[11px] text-stone-300 leading-relaxed">{card.description}</p>
                )}
              </div>
              {card.impact && (
                <div className="mt-2.5 pt-1.5 border-t border-white/10 flex items-center space-x-1">
                  <span className="text-[10px] font-mono font-semibold text-amber-400">{card.impact}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* License / Legal Attribution Footer */}
      {data.licenseInfo && (
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] text-stone-400">
          <span className="flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>
              {(t('presentation.licenseFreeLabel') || 'License: {license} (Royalty-free)').replace(
                '{license}',
                data.licenseInfo.license,
              )}
            </span>
          </span>
          {data.licenseInfo.sourceUrl && (
            <a
              href={data.licenseInfo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-amber-400 hover:underline"
            >
              <span>{t('presentation.sourceLinkLabel') || 'Source'}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
};

export default SlideVisualRenderer;
