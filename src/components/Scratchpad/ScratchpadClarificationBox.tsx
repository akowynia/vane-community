'use client';

import React, { useState } from 'react';
import { HelpCircle, Check, ArrowRight, Sparkles, CheckCircle2, CornerDownRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface ClarificationData {
  id: string;
  question: string;
  options: string[];
  selectedOption?: string | null;
  customText?: string | null;
  status: 'pending' | 'answered' | 'skipped';
}

interface ScratchpadClarificationBoxProps {
  clarification: ClarificationData;
  onConfirm: (selectedOption?: string, customText?: string) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export const ScratchpadClarificationBox: React.FC<ScratchpadClarificationBoxProps> = ({
  clarification,
  onConfirm,
  onSkip,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState<string>(
    clarification.selectedOption || (clarification.options.length > 0 ? clarification.options[0] : ''),
  );
  const [customText, setCustomText] = useState<string>(clarification.customText || '');

  const isResolved = clarification.status === 'answered' || clarification.status === 'skipped';

  if (isResolved) {
    let resolvedSummary = '';
    if (clarification.status === 'skipped') {
      resolvedSummary = t('scratchpad.clarificationResolvedSkipped') || 'Clarification skipped (general note)';
    } else if (clarification.selectedOption) {
      resolvedSummary = `${t('scratchpad.clarificationResolvedSelected')?.replace('{option}', '') || 'Wybrano: '} ${clarification.selectedOption}`;
      if (clarification.customText) {
        resolvedSummary += ` (${clarification.customText})`;
      }
    } else if (clarification.customText) {
      resolvedSummary = `${t('scratchpad.clarificationResolvedCustom')?.replace('{text}', '') || 'Custom instructions: '} ${clarification.customText}`;
    }

    return (
      <div className="w-full px-3.5 py-2.5 rounded-xl bg-[#b8864d]/10 border border-[#b8864d]/20 text-xs text-stone-700 dark:text-stone-300 flex items-center justify-between gap-2 animate-fadeIn">
        <div className="flex items-center space-x-2 truncate">
          <CheckCircle2 className="w-4 h-4 text-[#b8864d] shrink-0" />
          <span className="font-semibold text-[#b8864d] shrink-0">
            {t('scratchpad.clarificationTitle') || 'Doprecyzowanie'}:
          </span>
          <span className="truncate italic text-stone-800 dark:text-stone-200">
            {resolvedSummary}
          </span>
        </div>
      </div>
    );
  }

  const handleOptionClick = (option: string) => {
    if (disabled) return;
    setSelectedOption(option);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!selectedOption && !customText.trim()) return;
    onConfirm(selectedOption || undefined, customText.trim() || undefined);
  };

  return (
    <div className="w-full p-3.5 rounded-2xl bg-[#b8864d]/10 dark:bg-[#b8864d]/[0.08] border border-[#b8864d]/30 dark:border-[#b8864d]/25 shadow-sm space-y-3 animate-fadeIn">
      {/* Box Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-[#b8864d]/20 text-[#b8864d]">
            <HelpCircle className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
            {t('scratchpad.clarificationTitle') || 'Doprecyzowanie tematu'}
          </h4>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#b8864d]/20 text-[#b8864d] font-semibold">
          {t('scratchpad.clarificationBadge') || 'Pytanie asystenta'}
        </span>
      </div>

      {/* Question */}
      <p className="text-xs text-stone-800 dark:text-stone-200 font-medium leading-relaxed">
        {clarification.question}
      </p>

      {/* Options List */}
      <div className="space-y-1.5">
        {clarification.options.map((option, idx) => {
          const isSelected = selectedOption === option;
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => handleOptionClick(option)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition flex items-start space-x-2.5 ${
                isSelected
                  ? 'border-[#b8864d] bg-[#b8864d]/20 text-stone-950 dark:text-stone-50 font-medium shadow-xs'
                  : 'border-light-200 dark:border-[#2a241d] bg-light-primary/80 dark:bg-[#15110e]/80 text-stone-700 dark:text-stone-300 hover:border-[#b8864d]/50 hover:bg-[#b8864d]/5'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition ${
                  isSelected
                    ? 'border-[#b8864d] bg-[#b8864d] text-stone-950'
                    : 'border-stone-400 dark:border-stone-600'
                }`}
              >
                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
              <span className="leading-snug">{option}</span>
            </button>
          );
        })}
      </div>

      {/* Custom write-in text field */}
      <div className="pt-0.5">
        <input
          type="text"
          disabled={disabled}
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleFormSubmit(e);
            }
          }}
          placeholder={
            t('scratchpad.clarificationCustomPlaceholder') ||
            'Type your own angle or custom instructions...'
          }
          className="w-full px-3 py-1.5 text-xs rounded-xl border border-light-200 dark:border-[#2a241d] bg-light-primary dark:bg-[#120f0d] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#b8864d] transition"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onSkip}
          className="px-2.5 py-1.5 text-[11px] font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center space-x-1"
        >
          <span>{t('scratchpad.clarificationSkipBtn') || 'Skip (General Note)'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>

        <button
          type="button"
          disabled={disabled || (!selectedOption && !customText.trim())}
          onClick={handleFormSubmit}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#b8864d] text-stone-950 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition flex items-center space-x-1.5 shadow-sm"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{t('scratchpad.clarificationConfirmBtn') || 'Confirm & Draft Note'}</span>
        </button>
      </div>
    </div>
  );
};

export default ScratchpadClarificationBox;
