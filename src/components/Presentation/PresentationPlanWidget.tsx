'use client';

import React, { useState } from 'react';
import {
  ListTree,
  Search,
  CheckCircle,
  Sparkles,
  BarChart2,
  Workflow,
  Layers,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { PlannedSlide, PresentationPlanResult } from '@/lib/agents/scratchpad/presentationPlanner';

interface PresentationPlanWidgetProps {
  plan: PresentationPlanResult;
  onAcceptPlan: (approvedPlan: PresentationPlanResult) => void;
  isAccepting?: boolean;
  disabled?: boolean;
}

const visualIconMap: Record<string, any> = {
  chart: BarChart2,
  mermaid: Workflow,
  infographic: Layers,
  table: TableIcon,
  cards: ListTree,
};

export const PresentationPlanWidget: React.FC<PresentationPlanWidgetProps> = ({
  plan,
  onAcceptPlan,
  isAccepting = false,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [expandedSlideIndex, setExpandedSlideIndex] = useState<number | null>(0);

  const slides = plan.slides || [];
  const queries = plan.researchQueries || [];

  return (
    <div className="my-4 p-5 rounded-3xl bg-light-secondary dark:bg-[#14100d] border border-amber-500/40 shadow-xl text-stone-900 dark:text-stone-100 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-light-200 dark:border-[#221c16]">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 text-amber-500 border border-amber-500/30">
            <ListTree className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-white">
              {t('presentation.slideOutlineTitle') || 'Presentation Outline (Slide Plan)'}
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {plan.summary || (t('presentation.planOutlineFallback') || 'Outline ({count} slides)').replace('{count}', String(slides.length))}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-xs font-bold font-mono">
          {(t('presentation.slidesCountBadge') || '{count} slides').replace('{count}', String(slides.length))}
        </span>
      </div>

      {/* Planned Slides List */}
      <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {slides.map((slide, idx) => {
          const isExpanded = expandedSlideIndex === idx;
          const VisualIcon = visualIconMap[slide.visualType] || Layers;

          return (
            <div
              key={idx}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isExpanded
                  ? 'border-amber-500/50 bg-amber-500/5 shadow-sm'
                  : 'border-light-200 dark:border-[#241e18] bg-light-primary dark:bg-[#181410] hover:border-amber-500/30'
              }`}
            >
              {/* Slide Item Header */}
              <button
                type="button"
                onClick={() => setExpandedSlideIndex(isExpanded ? null : idx)}
                className="w-full p-3.5 flex items-center justify-between text-left"
              >
                <div className="flex items-center space-x-3 truncate">
                  <span className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/5 border border-white/10 text-amber-500 text-xs font-mono font-bold flex items-center justify-center flex-shrink-0">
                    {slide.slideNumber || idx + 1}
                  </span>
                  <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {slide.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-white/5 text-[10px] text-stone-400">
                    <VisualIcon className="w-3 h-3 text-amber-400" />
                    <span className="capitalize">{slide.visualType}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  )}
                </div>
              </button>

              {/* Slide Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-black/5 dark:border-white/5 text-xs text-stone-600 dark:text-stone-300 space-y-2">
                  <div className="flex items-start space-x-1.5">
                    <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Cel:</span>
                    <span className="text-[11px] text-stone-400">{slide.goal}</span>
                  </div>

                  {slide.visualDescription && (
                    <div className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] text-stone-400 flex items-center space-x-1.5">
                      <VisualIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span>{slide.visualDescription}</span>
                    </div>
                  )}

                  {Array.isArray(slide.keyPoints) && slide.keyPoints.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-300">
                      {slide.keyPoints.map((pt, pIdx) => (
                        <li key={pIdx} className="line-clamp-2">
                          {pt}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deep Research Plan Queries */}
      {queries.length > 0 && (
        <div className="mt-4 p-4 rounded-2xl bg-black/5 dark:bg-[#181410] border border-light-200 dark:border-[#221c16]">
          <div className="flex items-center space-x-2 text-xs font-bold text-stone-800 dark:text-stone-200 mb-2">
            <Search className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('presentation.researchPlanTitle') || 'Research Query Plan (Deep Research)'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {queries.map((q, qIdx) => (
              <span
                key={qIdx}
                className="px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-[11px] text-stone-400 font-mono flex items-center space-x-1"
              >
                <span>🔍</span>
                <span>{q}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer Accept Action */}
      <div className="mt-5 pt-4 border-t border-light-200 dark:border-[#221c16] flex items-center justify-between">
        <span className="text-xs text-stone-400">
          {t('presentation.planReviseOrAcceptHint') || 'You can ask for revisions in chat or accept the plan'}
        </span>

        <button
          type="button"
          disabled={disabled || isAccepting}
          onClick={() => onAcceptPlan(plan)}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/25 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>
            {isAccepting
              ? t('presentation.acceptingPlan') || 'Launching Deep Research...'
              : t('presentation.acceptPlanAndGenerate') || 'Accept Plan & Generate Presentation'}
          </span>
          {!isAccepting && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};

export default PresentationPlanWidget;
