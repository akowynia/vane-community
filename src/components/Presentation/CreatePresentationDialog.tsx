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
  Presentation,
  Sparkles,
  X,
  Sliders,
  Layers,
  Palette,
  Users,
  Search,
  Zap,
  BookOpen,
  Check,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface CreatePresentationConfig {
  title: string;
  topic: string;
  slideCount: number;
  theme: string;
  targetAudience: string;
  maxClarificationRounds: number;
  tokenBudgetCap: number;
  researchIntensity: 'speed' | 'balanced' | 'quality';
  includeSpeakerNotes: boolean;
  includeCitations: boolean;
}

interface CreatePresentationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: CreatePresentationConfig) => Promise<void>;
}

const THEMES = [
  { id: 'dark-modern', nameKey: 'themeDark', defaultName: 'Dark Modern', bg: '#0f172a', accent: '#38bdf8', text: '#f8fafc' },
  { id: 'minimal-light', nameKey: 'themeLight', defaultName: 'Minimal Light', bg: '#ffffff', accent: '#2563eb', text: '#0f172a' },
  { id: 'cyber-tech', nameKey: 'themeCyber', defaultName: 'Cyber Tech', bg: '#090d16', accent: '#06b6d4', text: '#ecfeff' },
  { id: 'business-emerald', nameKey: 'themeEmerald', defaultName: 'Business Emerald', bg: '#064e3b', accent: '#34d399', text: '#ecfdf5' },
  { id: 'warm-gold', nameKey: 'themeGold', defaultName: 'Warm Gold', bg: '#1c1917', accent: '#d97706', text: '#fef3c7' },
];

const AUDIENCES = [
  { id: 'general', nameKey: 'audienceGeneral', defaultName: 'General / Accessible' },
  { id: 'business', nameKey: 'audienceBusiness', defaultName: 'Business / Executive (Decision)' },
  { id: 'technical', nameKey: 'audienceTechnical', defaultName: 'Technical / Engineers' },
  { id: 'education', nameKey: 'audienceEducation', defaultName: 'Educational / Lecture' },
  { id: 'pitch', nameKey: 'audiencePitch', defaultName: 'Pitch Deck / Investors' },
];

const CreatePresentationDialog: React.FC<CreatePresentationDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [selectedTheme, setSelectedTheme] = useState('dark-modern');
  const [selectedAudience, setSelectedAudience] = useState('general');
  const [maxClarificationRounds, setMaxClarificationRounds] = useState(2);
  const [tokenBudgetCap, setTokenBudgetCap] = useState(35000);
  const [researchIntensity, setResearchIntensity] = useState<'speed' | 'balanced' | 'quality'>('balanced');
  const [includeSpeakerNotes, setIncludeSpeakerNotes] = useState(true);
  const [includeCitations, setIncludeCitations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: topic.trim().slice(0, 80),
        topic: topic.trim(),
        slideCount,
        theme: selectedTheme,
        targetAudience: selectedAudience,
        maxClarificationRounds,
        tokenBudgetCap,
        researchIntensity,
        includeSpeakerNotes,
        includeCitations,
      });
      onClose();
    } catch (err) {
      console.error('Failed to submit presentation:', err);
    } finally {
      setSubmitting(false);
    }
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
          <DialogBackdrop className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-10 flex items-center justify-center">
          <TransitionChild
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="relative transform overflow-hidden rounded-3xl bg-light-primary dark:bg-[#13100d] border border-light-200 dark:border-[#2a241d] p-6 sm:p-8 text-left shadow-2xl transition-all w-full max-w-2xl text-stone-900 dark:text-stone-100">
              {/* Header */}
              <div className="flex items-start justify-between pb-5 border-b border-light-200 dark:border-[#241e18]">
                <div className="flex items-center space-x-3.5">
                  <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-500 shadow-sm">
                    <Presentation className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle as="h3" className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                      <span>{t('presentation.createPresentationTitle') || 'Create New Presentation with AI'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-semibold tracking-wider uppercase">
                        AI DECK
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-semibold tracking-wider uppercase">
                        Beta
                      </span>
                    </DialogTitle>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      {t('presentation.createPresentationSubtitle') || 'The assistant will interview you, gather web research, and generate rich slides with charts and graphics.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                {/* Topic Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">
                    {t('presentation.topicLabel') || 'Presentation Topic'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t('presentation.topicPlaceholder') || 'Describe your presentation topic, e.g. Introduction to LLM Architectures in 2026...'}
                    className="w-full px-4 py-3 rounded-2xl border border-light-300 dark:border-[#2b241d] bg-light-secondary dark:bg-[#181410] text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition resize-none leading-relaxed"
                  />
                </div>

                {/* Slides Count & Target Audience */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Slide Count Slider */}
                  <div className="p-4 rounded-2xl bg-light-secondary/50 dark:bg-[#16120e] border border-light-200 dark:border-[#221c16] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('presentation.slideCountLabel') || 'Number of Slides'}</span>
                      </label>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-xs font-bold font-mono">
                        {slideCount} {t('presentation.slideCountSuffix') || 'slides'}
                      </span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                      {[5, 8, 10, 12, 16].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setSlideCount(count)}
                          className={`py-1 rounded-lg text-[11px] font-mono font-semibold transition text-center ${
                            slideCount === count
                              ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                              : 'bg-black/5 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-amber-500/10 hover:text-amber-500'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="range"
                        min={3}
                        max={20}
                        value={slideCount}
                        onChange={(e) => setSlideCount(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-stone-400 mt-1 font-mono">
                        <span>Min: 3</span>
                        <span>Max: 20</span>
                      </div>
                    </div>
                  </div>

                  {/* Target Audience */}
                  <div className="p-4 rounded-2xl bg-light-secondary/50 dark:bg-[#16120e] border border-light-200 dark:border-[#221c16]">
                    <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-2 flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('presentation.targetAudienceLabel') || 'Grupa docelowa'}</span>
                    </label>
                    <select
                      value={selectedAudience}
                      onChange={(e) => setSelectedAudience(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-light-300 dark:border-[#28221b] bg-light-primary dark:bg-[#1a1511] text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-500"
                    >
                      {AUDIENCES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {t(`presentation.${a.nameKey}`) || a.defaultName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2.5 flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('presentation.themeLabel') || 'Motyw wizualny'}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {THEMES.map((theme) => {
                      const isSelected = selectedTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setSelectedTheme(theme.id)}
                          className={`p-3 rounded-xl border text-left transition relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                              : 'border-light-200 dark:border-[#251f19] bg-light-secondary/40 dark:bg-[#16120e] hover:border-stone-400 dark:hover:border-stone-600'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5 mb-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: theme.bg }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: theme.accent }}
                            />
                          </div>
                          <span className="text-[11px] font-medium leading-tight text-stone-800 dark:text-stone-200 line-clamp-1">
                            {t(`presentation.${theme.nameKey}`) || theme.defaultName}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Advanced Configuration Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center space-x-2 text-xs font-semibold text-amber-500 hover:text-amber-400 transition"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>
                      {showAdvanced
                        ? t('presentation.hideAdvancedParams') || 'Ukryj zaawansowane parametry'
                        : t('presentation.showAdvancedParams') || 'Show advanced parameters (round and token limits)'}
                    </span>
                  </button>

                  {showAdvanced && (
                    <div className="mt-4 p-4 rounded-2xl bg-light-secondary/40 dark:bg-[#16120e] border border-light-200 dark:border-[#221c16] space-y-4 animate-fadeIn">
                      {/* Max Clarification Rounds */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            {t('presentation.maxClarificationRoundsLabel') || 'Maksymalna liczba rund dopytywania'}
                          </label>
                          <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[11px] font-mono font-bold text-amber-500">
                            {maxClarificationRounds === 0
                              ? t('presentation.clarificationRoundsOffBadge') || 'Off (straight to plan)'
                              : `${maxClarificationRounds} ${t('presentation.roundsSuffix') || 'rund'}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mb-2">
                          {t('presentation.maxClarificationRoundsDesc') || 'How many clarifying questions the AI can ask before drafting the plan (0 = jump directly to plan)'}
                        </p>
                        <div className="grid grid-cols-5 gap-1.5 mb-2">
                          {[
                            { val: 0, labelKey: 'clarificationRoundsOffPreset', fallback: '0 (Brak)' },
                            { val: 1, labelKey: 'clarificationRounds1', fallback: '1 runda' },
                            { val: 2, labelKey: 'clarificationRounds2', fallback: '2 rundy' },
                            { val: 3, labelKey: 'clarificationRounds3', fallback: '3 rundy' },
                            { val: 5, labelKey: 'clarificationRounds5', fallback: '5 rund' },
                          ].map((item) => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => setMaxClarificationRounds(item.val)}
                              className={`py-1 rounded-lg text-[11px] font-semibold transition text-center ${
                                maxClarificationRounds === item.val
                                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                                  : 'bg-black/5 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-amber-500/10 hover:text-amber-500'
                              }`}
                            >
                              {t(`presentation.${item.labelKey}`) || item.fallback}
                            </button>
                          ))}
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={5}
                          value={maxClarificationRounds}
                          onChange={(e) => setMaxClarificationRounds(Number(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-stone-400 mt-0.5 font-mono">
                          <span>0</span>
                          <span>5</span>
                        </div>
                      </div>

                      {/* Token Budget Cap */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                            {t('presentation.tokenBudgetLabel') || 'Token Budget / Quality Cap'}
                          </label>
                          <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 text-[11px] font-mono font-bold text-amber-500">
                            {tokenBudgetCap >= 1000 ? `${tokenBudgetCap / 1000}k tok.` : `${tokenBudgetCap} tok.`}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mb-2">
                          {t('presentation.tokenBudgetDesc') || 'Maximum token limit for multi-step research and slide synthesis'}
                        </p>
                        <select
                          value={tokenBudgetCap}
                          onChange={(e) => setTokenBudgetCap(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl border border-light-300 dark:border-[#28221b] bg-light-primary dark:bg-[#1a1511] text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-amber-500"
                        >
                          <option value={15000}>{t('presentation.tokenBudget15k') || '15k tokens (Quick draft)'}</option>
                          <option value={35000}>{t('presentation.tokenBudget35k') || '35k tokens (Balanced - recommended)'}</option>
                          <option value={75000}>{t('presentation.tokenBudget75k') || '75k tokens (Deep research)'}</option>
                          <option value={120000}>{t('presentation.tokenBudget120k') || '120k tokens (Maximum synthesis)'}</option>
                        </select>
                      </div>

                      {/* Checkboxes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <label className="flex items-center space-x-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeSpeakerNotes}
                            onChange={(e) => setIncludeSpeakerNotes(e.target.checked)}
                            className="rounded border-stone-400 text-amber-500 focus:ring-amber-500"
                          />
                          <span>{t('presentation.includeSpeakerNotes') || 'Generuj notatki prelegenta'}</span>
                        </label>
                        <label className="flex items-center space-x-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeCitations}
                            onChange={(e) => setIncludeCitations(e.target.checked)}
                            className="rounded border-stone-400 text-amber-500 focus:ring-amber-500"
                          />
                          <span>{t('presentation.includeCitations') || 'Include citations and source references on slides & charts'}</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-light-200 dark:border-[#241e18] flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition"
                  >
                    {t('common.cancel') || 'Anuluj'}
                  </button>
                  <button
                    type="submit"
                    disabled={!topic.trim() || submitting}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-bold text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {submitting
                        ? t('presentation.creating') || 'Tworzenie...'
                        : t('presentation.createAndStartBtn') || 'Rozpocznij tworzenie prezentacji'}
                    </span>
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreatePresentationDialog;
