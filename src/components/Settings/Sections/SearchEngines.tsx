'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Switch } from '@headlessui/react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  SlidersHorizontal,
  Loader2,
  Globe,
  GraduationCap,
  Users,
  BookOpen,
  Newspaper,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SearchEngineItem, SearchEnginesConfigResponse } from '@/lib/searxng/enginesManager';

export const SearchEngines = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [savingKeyFor, setSavingKeyFor] = useState<string | null>(null);
  const [savingEngine, setSavingEngine] = useState<string | null>(null);
  const [engines, setEngines] = useState<SearchEngineItem[]>([]);
  const [apiKeysInput, setApiKeysInput] = useState<Record<string, string>>({});
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [expandedApiKeyEngine, setExpandedApiKeyEngine] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config/search-engines');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SearchEnginesConfigResponse = await res.json();
      const list = data.engines || [];
      setEngines(list);

      const initialKeys: Record<string, string> = {};
      for (const eng of list) {
        if (eng.apiKeyMasked) {
          initialKeys[eng.name.toLowerCase()] = eng.apiKeyMasked;
        }
      }
      setApiKeysInput(initialKeys);
    } catch (err) {
      console.error('Failed to load search engines config:', err);
      toast.error(t('settings.loadError') || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSaveEngineApiKey = async (engineName: string) => {
    const lowerName = engineName.toLowerCase();
    const keyValue = apiKeysInput[lowerName] || '';

    try {
      setSavingKeyFor(lowerName);
      const res = await fetch('/api/config/search-engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKeys: {
            [lowerName]: keyValue,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save API key');
      }

      toast.success(
        keyValue.trim() === ''
          ? (t('settings.saveSuccess') || 'API key removed.')
          : (t('settings.saveSuccess') || 'API key saved successfully.')
      );

      await fetchConfig();
    } catch (err: any) {
      console.error(`Error saving API key for ${engineName}:`, err);
      toast.error(err.message || (t('settings.saveError') || 'Failed to save API key'));
    } finally {
      setSavingKeyFor(null);
    }
  };

  const handleToggleEngine = async (engineName: string, currentDisabled: boolean) => {
    const newEnabledState = currentDisabled; // if currently disabled=true, enable it
    setSavingEngine(engineName);

    // Optimistic UI update
    setEngines((prev) =>
      prev.map((eng) =>
        eng.name.toLowerCase() === engineName.toLowerCase()
          ? { ...eng, disabled: !newEnabledState }
          : eng
      )
    );

    try {
      const res = await fetch('/api/config/search-engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engines: {
            [engineName]: newEnabledState,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update engine state');
      }

      toast.success(
        t('settings.enginesSavedSuccess') || 'Search engine configuration updated.'
      );
    } catch (err: any) {
      console.error('Error updating engine:', err);
      toast.error(
        t('settings.enginesSaveError') || 'Failed to update search engine configuration.'
      );
      await fetchConfig();
    } finally {
      setSavingEngine(null);
    }
  };

  const handleBulkUpdate = async (mode: 'stable' | 'all' | 'none') => {
    setLoading(true);
    const engineMap: Record<string, boolean> = {};

    const updated = engines.map((eng) => {
      let isEnabled = false;
      if (mode === 'all') {
        isEnabled = true;
      } else if (mode === 'none') {
        isEnabled = false;
      } else if (mode === 'stable') {
        if (eng.supportsApiKey) {
          isEnabled = eng.hasApiKey || !eng.isProblematic;
        } else {
          isEnabled = !eng.isProblematic && eng.name.toLowerCase() !== 'google news';
        }
      }
      engineMap[eng.name] = isEnabled;
      return { ...eng, disabled: !isEnabled };
    });

    setEngines(updated);

    try {
      const res = await fetch('/api/config/search-engines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engines: engineMap }),
      });

      if (!res.ok) throw new Error('Bulk update failed');
      toast.success(
        t('settings.enginesSavedSuccess') || 'Search engines updated successfully.'
      );
    } catch (err) {
      console.error('Bulk update error:', err);
      toast.error(
        t('settings.enginesSaveError') || 'Failed to update search engines.'
      );
      await fetchConfig();
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: SearchEngineItem['category']) => {
    switch (category) {
      case 'academic':
        return <GraduationCap className="w-3 h-3" />;
      case 'social':
        return <Users className="w-3 h-3" />;
      case 'encyclopedia':
        return <BookOpen className="w-3 h-3" />;
      case 'news':
        return <Newspaper className="w-3 h-3" />;
      default:
        return <Globe className="w-3 h-3" />;
    }
  };

  const getCategoryLabel = (category: SearchEngineItem['category']) => {
    switch (category) {
      case 'academic':
        return t('settings.categoryAcademic') || 'Academic';
      case 'social':
        return t('settings.categorySocial') || 'Social & Code';
      case 'encyclopedia':
        return t('settings.categoryEncyclopedia') || 'Encyclopedia';
      case 'news':
        return t('settings.categoryNews') || 'News';
      default:
        return t('settings.categoryWeb') || 'General / Web';
    }
  };

  if (loading && engines.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-black/50 dark:text-white/50" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Engines List & API Keys Management */}
      <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-light-200 dark:border-dark-200">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-black dark:text-white" />
                <h4 className="text-sm font-semibold text-black dark:text-white">
                  {t('settings.searchEngines') || 'Search Engines'}
                </h4>
              </div>
              <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50 mt-0.5">
                {t('settings.searchEnginesDesc') ||
                  'Enable or disable individual engines in SearXNG and configure an official Brave Search API key.'}
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkUpdate('stable')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-light-secondary dark:bg-dark-secondary text-black/80 dark:text-white/80 hover:bg-light-200 dark:hover:bg-dark-200 border border-light-200 dark:border-dark-200 transition active:scale-95"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{t('settings.enableStableOnly') || 'Enable stable only'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdate('all')}
                className="px-2 py-1 rounded-lg text-[11px] font-medium text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition active:scale-95"
              >
                {t('settings.enableAll') || 'Enable all'}
              </button>
              <button
                type="button"
                onClick={() => handleBulkUpdate('none')}
                className="px-2 py-1 rounded-lg text-[11px] font-medium text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition active:scale-95"
              >
                {t('settings.disableAll') || 'Disable all'}
              </button>
            </div>
          </div>

          {/* Engine items list */}
          <div className="divide-y divide-light-200/60 dark:divide-dark-200/60">
            {engines.map((eng) => {
              const lowerName = eng.name.toLowerCase();
              const isEnabled = !eng.disabled;
              const isSavingThis = savingEngine === eng.name;
              const isExpanded = expandedApiKeyEngine === lowerName;
              const showProblematicWarning = eng.isProblematic && !eng.hasApiKey;
              const isPasswordVisible = Boolean(showPasswordMap[lowerName]);
              const currentInputKey = apiKeysInput[lowerName] ?? (eng.apiKeyMasked || '');

              return (
                <div key={eng.name} className="py-3 group space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold capitalize text-black dark:text-white">
                          {eng.name}
                        </span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-light-200 dark:bg-dark-200 text-black/60 dark:text-white/60 border border-light-200 dark:border-dark-200">
                          {getCategoryIcon(eng.category)}
                          <span>{getCategoryLabel(eng.category)}</span>
                        </span>
                      </div>

                      {/* API Key Status / Button */}
                      {eng.supportsApiKey && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedApiKeyEngine(isExpanded ? null : lowerName)
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition active:scale-95 ${
                            eng.hasApiKey
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-light-secondary dark:bg-dark-secondary text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 border-light-200 dark:border-dark-200'
                          }`}
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>
                            {eng.hasApiKey
                              ? (t('settings.apiKeyActive') || 'API Key Active')
                              : `+ ${t('settings.configureApiKey') || 'API Key'}`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-2.5 h-2.5 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                          )}
                        </button>
                      )}

                      {/* Problematic Warning badge */}
                      {showProblematicWarning && (
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 max-w-fit"
                          title={
                            t('settings.problematicEngineTooltip') ||
                            'This engine frequently blocks server requests (CAPTCHA/rate limit) — requires an official API key or residential IP to operate reliably.'
                          }
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500" />
                          <span className="hidden lg:inline">
                            {t('settings.problematicEngineTooltip') ||
                              'Prone to blocking (requires API key / residential IP)'}
                          </span>
                          <span className="lg:hidden">
                            {t('settings.problematicEngineBadge') || 'Prone to blocking'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={isEnabled}
                        onChange={() => handleToggleEngine(eng.name, eng.disabled)}
                        disabled={isSavingThis}
                        className="group relative flex h-5 w-10 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-0.5 duration-200 ease-in-out focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-5"
                        />
                      </Switch>
                    </div>
                  </div>

                  {/* Expandable API Key drawer */}
                  <AnimatePresence>
                    {isExpanded && eng.supportsApiKey && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="p-3 rounded-lg bg-light-secondary/60 dark:bg-dark-secondary/60 border border-light-200 dark:border-dark-200 space-y-2.5 overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <p className="text-[11px] text-black/60 dark:text-white/60">
                            {t('settings.apiKeyCustomDesc') ||
                              'Providing an official API key ensures reliable queries without bot blocks and rate limits.'}
                          </p>
                          {eng.apiKeyHelpUrl && (
                            <a
                              href={eng.apiKeyHelpUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:text-sky-600 dark:text-sky-400 dark:hover:text-sky-300 font-medium shrink-0"
                            >
                              <span>{t('settings.getOfficialApiKey') || 'Get official API key'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={isPasswordVisible ? 'text' : 'password'}
                              value={currentInputKey}
                              onChange={(e) =>
                                setApiKeysInput((prev) => ({
                                  ...prev,
                                  [lowerName]: e.target.value,
                                }))
                              }
                              placeholder={
                                t('settings.pasteApiKeyForEngine', { name: eng.name }) ||
                                `Paste API key for ${eng.name}`
                              }
                              className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-1.5 pr-10 !text-xs text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-sky-500 transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordMap((prev) => ({
                                  ...prev,
                                  [lowerName]: !isPasswordVisible,
                                }))
                              }
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70 p-1"
                            >
                              {isPasswordVisible ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEngineApiKey(eng.name)}
                              disabled={savingKeyFor === lowerName}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 min-w-[70px]"
                            >
                              {savingKeyFor === lowerName ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>{t('common.save') || 'Save'}</span>
                            </button>

                            {eng.hasApiKey && (
                              <button
                                type="button"
                                onClick={() => {
                                  setApiKeysInput((prev) => ({
                                    ...prev,
                                    [lowerName]: '',
                                  }));
                                  setTimeout(() => handleSaveEngineApiKey(eng.name), 50);
                                }}
                                disabled={savingKeyFor === lowerName}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/20 transition active:scale-95 disabled:opacity-60"
                                title={t('common.clear') || 'Clear'}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SearchEngines;
