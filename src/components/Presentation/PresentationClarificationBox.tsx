'use client';

import React, { useState } from 'react';
import {
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  FastForward,
  Sparkles,
  Send,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface PresentationClarificationData {
  id: string;
  question: string;
  options: string[];
  round: number;
  maxRounds: number;
  status: 'pending' | 'resolved' | 'skipped';
  selectedOption?: string;
  customText?: string;
}

interface PresentationClarificationBoxProps {
  data: PresentationClarificationData;
  onAnswer: (response: {
    question: string;
    selectedOption?: string;
    customText?: string;
  }) => void;
  onSkipToPlan: () => void;
  disabled?: boolean;
}

export const PresentationClarificationBox: React.FC<PresentationClarificationBoxProps> = ({
  data,
  onAnswer,
  onSkipToPlan,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');

  const isResolved = data.status === 'resolved' || data.status === 'skipped';

  if (isResolved) {
    return (
      <div className="my-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-stone-700 dark:text-stone-300">
        <div className="flex items-center space-x-2 text-amber-500 font-bold mb-1">
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {t('presentation.clarificationRoundHeader', {
              round: data.round,
              max: data.maxRounds,
            }) || `Clarifying Requirements (Round ${data.round} of ${data.maxRounds})`}
          </span>
        </div>
        <p className="text-stone-600 dark:text-stone-400 mb-2 font-medium">{data.question}</p>
        <div className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 font-semibold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
          <span>{t('presentation.clarificationSelectedLabel') || 'Selected:'}</span>
          <span className="text-amber-500">
            {data.selectedOption || data.customText || t('presentation.clarificationSkippedValue') || 'Skipped'}
          </span>
        </div>
      </div>
    );
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedOption && !customText.trim()) return;

    onAnswer({
      question: data.question,
      selectedOption: selectedOption || undefined,
      customText: customText.trim() || undefined,
    });
  };

  return (
    <div className="my-4 p-5 rounded-3xl bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 shadow-xl text-stone-900 dark:text-stone-100 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-500">
            <HelpCircle className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-500">
            {t('presentation.clarificationRoundHeader', {
              round: data.round,
              max: data.maxRounds,
            }) || `Clarifying Requirements (Round ${data.round} of ${data.maxRounds})`}
          </span>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={onSkipToPlan}
          className="flex items-center space-x-1.5 text-[11px] font-semibold text-stone-400 hover:text-amber-500 dark:hover:text-amber-400 transition"
        >
          <span>{t('presentation.skipToPlanBtn') || 'Skip Directly to Planning'}</span>
          <FastForward className="w-3 h-3" />
        </button>
      </div>

      {/* Clarifying Question */}
      <h4 className="text-sm font-bold text-stone-900 dark:text-white mb-4 leading-snug">
        {data.question}
      </h4>

      {/* Option Chips */}
      <div className="space-y-2 mb-4">
        {data.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => setSelectedOption(isSelected ? null : option)}
              className={`w-full text-left p-3 rounded-2xl border text-xs transition-all flex items-center justify-between ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/15 text-stone-900 dark:text-white font-bold ring-1 ring-amber-500 shadow-sm'
                  : 'border-light-200 dark:border-[#2b241d] bg-light-secondary dark:bg-[#181410] text-stone-700 dark:text-stone-300 hover:border-amber-500/50'
              }`}
            >
              <span className="leading-relaxed">{option}</span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ml-2 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500 text-stone-950'
                    : 'border-stone-400 dark:border-stone-600'
                }`}
              >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-stone-950" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Specification Input */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          disabled={disabled}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder={
            t('presentation.clarificationCustomPlaceholder') ||
            'Type your own variant or additional notes...'
          }
          className="w-full px-4 py-2.5 rounded-xl border border-light-200 dark:border-[#2b241d] bg-light-secondary dark:bg-[#181410] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 transition"
        />

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-stone-400">
            {t('presentation.clarificationHelperText') ||
              'Choose an option or add your own guidance'}
          </span>

          <button
            type="button"
            disabled={disabled || (!selectedOption && !customText.trim())}
            onClick={() => handleSubmit()}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold text-xs hover:brightness-110 active:scale-95 transition shadow-md shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{t('presentation.clarificationSubmitBtn') || 'Confirm'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default PresentationClarificationBox;
