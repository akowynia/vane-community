'use client';

import React, { useState, useEffect, Fragment, useMemo } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import {
  Clock,
  Calendar,
  Terminal,
  Cpu,
  Zap,
  Info,
  Check,
  X,
  Sparkles,
  Waypoints as WaypointsIcon,
} from 'lucide-react';
import {
  GlobeIcon,
  GraduationCapIcon,
  NetworkIcon,
} from '@phosphor-icons/react';
import TextareaAutosize from 'react-textarea-autosize';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import WaypointIcon from '@/components/Waypoints/WaypointIcon';
import { MinimalProvider } from '@/lib/models/types';
import {
  describeSchedule,
  isValidCron,
  computeNextRun,
  normalizeCronExpression,
} from '@/lib/cron/parser';
import { formatTimeDifference } from '@/lib/utils';

export interface CronItem {
  id: string;
  waypointId: string;
  name: string;
  schedule: string;
  prompt: string;
  sources: string[];
  optimizationMode: 'speed' | 'balanced' | 'quality';
  chatModelProvider: string;
  chatModelKey: string;
  embeddingModelProvider?: string | null;
  embeddingModelKey?: string | null;
  systemInstructions?: string | null;
  timezone?: string | null;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastStatus?: 'success' | 'error' | 'running' | null;
  lastError?: string | null;
  lastChatId?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  waypointName?: string;
  waypointIcon?: string;
  waypointIsPublic?: boolean;
  isOwner?: boolean;
}

interface CreateEditCronDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  cron?: CronItem | null;
  fixedWaypointId?: string;
  onSaved?: (cron: CronItem) => void;
  onRequireLogin?: () => void;
}

const PRESET_OPTIONS = [
  { id: 'daily', key: 'presetDaily' },
  { id: 'weekdays', key: 'presetWeekdays' },
  { id: 'weekly', key: 'presetWeekly' },
  { id: 'hourly', key: 'presetHourly' },
  { id: 'custom', key: 'presetCustom' },
] as const;

export const CreateEditCronDialog: React.FC<CreateEditCronDialogProps> = ({
  isOpen,
  setIsOpen,
  cron,
  fixedWaypointId,
  onSaved,
  onRequireLogin,
}) => {
  const { t, locale } = useTranslation();

  const sourcesList = useMemo(
    () => [
      {
        key: 'web',
        name: t('focusModes.web') || 'Web',
        icon: <GlobeIcon className="h-4 w-4 shrink-0" />,
      },
      {
        key: 'academic',
        name: t('focusModes.academic') || 'Academic',
        icon: <GraduationCapIcon className="h-4 w-4 shrink-0" />,
      },
      {
        key: 'discussions',
        name: t('focusModes.discussions') || 'Discussions',
        icon: <NetworkIcon className="h-4 w-4 shrink-0" />,
      },
    ],
    [t],
  );

  const userTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  // Form State
  const [selectedWaypointId, setSelectedWaypointId] = useState<string>('');
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [preset, setPreset] = useState<'daily' | 'weekdays' | 'weekly' | 'hourly' | 'custom'>('daily');
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [customCron, setCustomCron] = useState('0 8 * * *');
  const [timezone, setTimezone] = useState<string>(userTimeZone);
  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationMode] = useState<'speed' | 'balanced' | 'quality'>('balanced');
  const [chatModelProvider, setChatModelProvider] = useState('');
  const [chatModelKey, setChatModelKey] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [enabled, setEnabled] = useState(true);

  // External data
  const [waypointsList, setWaypointsList] = useState<any[]>([]);
  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Load waypoints and providers on open
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        const [wpRes, provRes] = await Promise.all([
          fetch('/api/waypoints'),
          fetch('/api/providers'),
        ]);

        if (wpRes.ok) {
          const wpData = await wpRes.json();
          setWaypointsList(Array.isArray(wpData.waypoints) ? wpData.waypoints : []);
        }

        if (provRes.ok) {
          const provData = await provRes.json();
          const pList: MinimalProvider[] = Array.isArray(provData.providers) ? provData.providers : [];
          setProviders(pList);

          // If no model selected, select default
          if (!chatModelProvider || !chatModelKey) {
            const firstWithModel = pList.find((p) => p.chatModels && p.chatModels.length > 0 && p.chatModels[0].key !== 'error');
            if (firstWithModel) {
              setChatModelProvider(firstWithModel.id);
              setChatModelKey(firstWithModel.chatModels[0].key);
            }
          }
        }
      } catch (err) {
        console.error('Error loading dialog data:', err);
      }
    };

    loadData();
  }, [isOpen]);

  // Populate fields on edit or create
  useEffect(() => {
    if (!isOpen) return;

    if (cron) {
      setSelectedWaypointId(cron.waypointId);
      setName(cron.name || '');
      setPrompt(cron.prompt || '');
      setSources(Array.isArray(cron.sources) && cron.sources.length > 0 ? cron.sources : ['web']);
      setOptimizationMode(cron.optimizationMode || 'balanced');
      setChatModelProvider(cron.chatModelProvider || '');
      setChatModelKey(cron.chatModelKey || '');
      setSystemInstructions(cron.systemInstructions || '');
      setTimezone(cron.timezone || userTimeZone);
      setEnabled(cron.enabled !== undefined ? cron.enabled : true);

      // Parse schedule
      const sched = cron.schedule.trim();
      setCustomCron(sched);

      const parts = sched.split(/\s+/);
      if (parts.length === 5) {
        const [mStr, hStr, domStr, monStr, dowStr] = parts;
        if (/^\d+$/.test(mStr) && /^\d+$/.test(hStr) && domStr === '*' && monStr === '*') {
          setHour(hStr.padStart(2, '0'));
          setMinute(mStr.padStart(2, '0'));
          if (dowStr === '*') setPreset('daily');
          else if (dowStr === '1-5') setPreset('weekdays');
          else if (dowStr === '1') setPreset('weekly');
          else setPreset('custom');
        } else if (mStr === '0' && hStr === '*' && domStr === '*' && monStr === '*' && dowStr === '*') {
          setPreset('hourly');
          setMinute('00');
        } else {
          setPreset('custom');
        }
      } else {
        setPreset('custom');
      }
    } else {
      setSelectedWaypointId(fixedWaypointId || '');
      setName('');
      setPrompt('');
      setPreset('daily');
      setHour('08');
      setMinute('00');
      setCustomCron('0 8 * * *');
      setTimezone(userTimeZone);
      setSources(['web']);
      setOptimizationMode('balanced');
      setSystemInstructions('');
      setEnabled(true);
    }
  }, [cron, isOpen, fixedWaypointId, userTimeZone]);

  // Compute active cron string
  const activeCronExpression = useMemo(() => {
    if (preset === 'daily') {
      return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * *`;
    }
    if (preset === 'weekdays') {
      return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * 1-5`;
    }
    if (preset === 'weekly') {
      return `${parseInt(minute, 10)} ${parseInt(hour, 10)} * * 1`;
    }
    if (preset === 'hourly') {
      return `0 * * * *`;
    }
    return normalizeCronExpression(customCron);
  }, [preset, hour, minute, customCron]);

  const schedulePreview = useMemo(() => {
    if (!isValidCron(activeCronExpression)) {
      return t('crons.invalidCronFormat') || 'Invalid cron format';
    }
    const desc = describeSchedule(activeCronExpression, locale);
    const nextDate = computeNextRun(activeCronExpression, new Date(), timezone);
    if (!nextDate) return desc;
    return `${desc} (${t('crons.nextRunPrefix') || 'Next'}: ${nextDate.toLocaleString(locale, {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })})`;
  }, [activeCronExpression, locale, timezone, t]);

  const toggleSource = (sourceId: string) => {
    setSources((prev) => {
      if (prev.includes(sourceId)) {
        if (prev.length === 1) return prev; // keep at least 1 source
        return prev.filter((s) => s !== sourceId);
      }
      return [...prev, sourceId];
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetWp = fixedWaypointId || selectedWaypointId;
    if (!targetWp) {
      toast.error(t('crons.selectWaypointRequired') || 'Please select a Waypoint space for this task.');
      return;
    }

    if (!name.trim()) {
      toast.error(t('crons.nameRequired') || 'Enter a task name.');
      return;
    }

    if (!prompt.trim()) {
      toast.error(t('crons.promptRequired') || 'Enter the prompt content.');
      return;
    }

    if (!isValidCron(activeCronExpression)) {
      toast.error(t('crons.invalidScheduleError') || 'The provided schedule is invalid.');
      return;
    }

    if (!chatModelProvider || !chatModelKey) {
      toast.error(t('crons.selectModelRequired') || 'Select an AI model.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        waypointId: targetWp,
        name: name.trim(),
        schedule: activeCronExpression,
        prompt: prompt.trim(),
        sources,
        optimizationMode,
        chatModelProvider,
        chatModelKey,
        systemInstructions: systemInstructions.trim() || null,
        timezone: timezone || userTimeZone,
        enabled,
      };

      const url = cron ? `/api/crons/${cron.id}` : '/api/crons';
      const method = cron ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        if (onRequireLogin) onRequireLogin();
        toast.error(t('crons.loginRequired') || 'Login required.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        toast.success(
          cron
            ? t('crons.saveSuccess') || 'Schedule saved successfully.'
            : t('crons.createSuccess') || 'New schedule created.',
        );
        if (onSaved && data.cron) {
          onSaved(data.cron);
        }
        setIsOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || t('crons.saveErrorGeneric') || 'Error saving the task');
      }
    } catch (err: any) {
      toast.error(err?.message || t('crons.saveErrorFallback') || 'Failed to save the schedule.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
        <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-2xl transform overflow-hidden rounded-3xl bg-light-primary dark:bg-[#14110e] border border-light-200 dark:border-[#2e261e] p-6 text-left align-middle shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-light-200/60 dark:border-[#241e17]">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-[#b8864d]/30 to-[#b8864d]/10 border border-[#b8864d]/40 text-[#b8864d] shadow-sm">
                      <Clock size={24} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-bold text-black dark:text-stone-100">
                        {cron
                          ? t('crons.edit') || 'Edit schedule'
                          : t('crons.create') || 'New schedule'}
                      </DialogTitle>
                      <p className="text-xs text-black/60 dark:text-stone-400 mt-0.5">
                        {t('crons.subtitle') ||
                          'Recurring tasks attached to Waypoint spaces, executed automatically on schedule.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-xl text-black/40 dark:text-stone-500 hover:text-black dark:hover:text-stone-200 hover:bg-light-200 dark:hover:bg-[#201b16] transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="mt-5 space-y-4">
                  {/* Waypoint Selector (if not fixed) */}
                  {!fixedWaypointId && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                        {t('crons.waypoint') || 'Waypoint Space'} *
                      </label>
                      <select
                        value={selectedWaypointId}
                        onChange={(e) => setSelectedWaypointId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs sm:text-sm text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]/70 transition"
                      >
                        <option value="">{t('crons.selectWaypoint') || 'Select space...'}</option>
                        {waypointsList.map((wp) => (
                          <option key={wp.id} value={wp.id}>
                            {wp.name} {wp.userId === null ? t('crons.sharedTag') || '(Shared)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Task Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                      {t('crons.name') || 'Task Name'} *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        t('crons.namePlaceholder') ||
                        'e.g. Daily Market Brief, Weekly AI Recap'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs sm:text-sm text-black dark:text-stone-100 placeholder:text-black/35 dark:placeholder:text-stone-600 focus:outline-none focus:border-[#b8864d]/70 transition"
                      maxLength={100}
                    />
                  </div>

                  {/* Prompt Textarea */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                      {t('crons.prompt') || 'Prompt / Scheduled Query'} *
                    </label>
                    <TextareaAutosize
                      minRows={3}
                      maxRows={7}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={
                        t('crons.promptPlaceholder') ||
                        'Enter the query to be executed repeatedly...'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs sm:text-sm text-black dark:text-stone-100 placeholder:text-black/35 dark:placeholder:text-stone-600 focus:outline-none focus:border-[#b8864d]/70 transition resize-none"
                    />
                  </div>

                  {/* Schedule Configuration */}
                  <div className="p-4 rounded-2xl border border-light-200 dark:border-[#282119] bg-light-secondary/30 dark:bg-[#100d0b]/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#b8864d]">
                        <Calendar size={14} />
                        <span>{t('crons.schedule') || 'Schedule'}</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#b8864d]">
                        {activeCronExpression}
                      </span>
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PRESET_OPTIONS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPreset(p.id as any)}
                          className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${
                            preset === p.id
                              ? 'bg-[#b8864d]/20 border-[#b8864d] text-[#b8864d]'
                              : 'border-light-200 dark:border-[#2b231b] bg-light-primary dark:bg-[#181411] text-black/70 dark:text-stone-300 hover:border-[#b8864d]/50'
                          }`}
                        >
                          {t(`crons.${p.key}`)}
                        </button>
                      ))}
                    </div>

                    {/* Time Picker for daily / weekdays / weekly */}
                    {preset !== 'hourly' && preset !== 'custom' && (
                      <div className="flex items-center gap-3 pt-2">
                        <span className="text-xs text-black/70 dark:text-stone-300">
                          {t('crons.selectTime') || 'Execution Time'}:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={hour}
                            onChange={(e) => setHour(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-light-200 dark:border-[#2b231b] bg-light-primary dark:bg-[#181411] text-xs text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                          >
                            {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <span className="text-sm font-bold text-black/50 dark:text-stone-400">:</span>
                          <select
                            value={minute}
                            onChange={(e) => setMinute(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-light-200 dark:border-[#2b231b] bg-light-primary dark:bg-[#181411] text-xs text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                          >
                            {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Custom Cron Input */}
                    {preset === 'custom' && (
                      <div className="pt-2">
                        <input
                          type="text"
                          value={customCron}
                          onChange={(e) => setCustomCron(e.target.value)}
                          placeholder={t('crons.customCronPlaceholder') || 'e.g. 0 8 * * 1-5'}
                          className="w-full px-3 py-2 rounded-xl border border-light-200 dark:border-[#2b231b] bg-light-primary dark:bg-[#181411] text-xs font-mono text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                        />
                        <p className="text-[10.5px] text-black/50 dark:text-stone-400 mt-1">
                          {t('crons.cronFormatHint') ||
                            'Format: [minute 0-59] [hour 0-23] [day 1-31] [month 1-12] [weekday 0-6 (0=Sun)]'}
                        </p>
                      </div>
                    )}

                    {/* Schedule Preview Bar */}
                    <div className="text-[11.5px] text-black/70 dark:text-stone-300 flex flex-wrap items-center justify-between gap-1.5 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-[#b8864d] shrink-0" />
                        <span>{schedulePreview}</span>
                      </div>
                      <span className="text-[10px] text-black/45 dark:text-stone-500 font-mono bg-light-secondary/60 dark:bg-[#181411] px-2 py-0.5 rounded-md border border-light-200/50 dark:border-[#2b231b]">
                        {timezone}
                      </span>
                    </div>
                  </div>

                  {/* Query Settings: Model, Optimization, Sources */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Chat Model Selector */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                        {t('crons.chatModel') || 'AI Model'} *
                      </label>
                      <select
                        value={`${chatModelProvider}:::${chatModelKey}`}
                        onChange={(e) => {
                          const [pId, key] = e.target.value.split(':::');
                          setChatModelProvider(pId || '');
                          setChatModelKey(key || '');
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]/70 transition"
                      >
                        {providers.map((p) => (
                          <optgroup key={p.id} label={p.name}>
                            {(p.chatModels || [])
                              .filter((m) => m && m.key && m.key !== 'error')
                              .map((m) => (
                                <option key={m.key} value={`${p.id}:::${m.key}`}>
                                  {m.name || m.key}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Optimization Mode */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                        {t('crons.optimizationMode') || 'Optimization Mode'}
                      </label>
                      <div className="flex items-center gap-1.5">
                        {(['speed', 'balanced', 'quality'] as const).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setOptimizationMode(mode)}
                            className={`flex-1 py-2 rounded-xl text-xs font-medium border capitalize transition ${
                              optimizationMode === mode
                                ? 'bg-[#b8864d]/20 border-[#b8864d] text-[#b8864d]'
                                : 'border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-black/70 dark:text-stone-400 hover:border-[#b8864d]/50'
                            }`}
                          >
                            {mode === 'speed'
                              ? t('optimization.speedTitle')
                              : mode === 'balanced'
                                ? t('optimization.balancedTitle')
                                : t('optimization.qualityTitle')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sources Selector */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                      {t('crons.sources') || 'Search Sources'}
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {sourcesList.map((src) => {
                        const isSelected = sources.includes(src.key);
                        return (
                          <button
                            key={src.key}
                            type="button"
                            onClick={() => toggleSource(src.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                              isSelected
                                ? 'bg-[#b8864d]/20 border-[#b8864d] text-[#b8864d]'
                                : 'border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-black/60 dark:text-stone-400 hover:border-[#b8864d]/40'
                            }`}
                          >
                            {src.icon}
                            <span>{src.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Additional System Instructions (Optional) */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1.5">
                      {t('crons.systemInstructions') || 'Additional Instructions (optional)'}
                    </label>
                    <TextareaAutosize
                      minRows={2}
                      maxRows={5}
                      value={systemInstructions}
                      onChange={(e) => setSystemInstructions(e.target.value)}
                      placeholder={
                        t('crons.systemInstructionsPlaceholder') ||
                        'Optional extra instructions extending the space Masterprompt...'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs text-black dark:text-stone-100 placeholder:text-black/35 dark:placeholder:text-stone-600 focus:outline-none focus:border-[#b8864d]/70 transition resize-none font-mono text-[11px]"
                    />
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-black/80 dark:text-stone-300">
                      {t('crons.statusToggleLabel') || 'Schedule status:'}{' '}
                      <span className="font-semibold text-[#b8864d]">
                        {enabled ? t('crons.enabled') || 'Active' : t('crons.disabled') || 'Paused'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnabled(!enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enabled ? 'bg-[#b8864d]' : 'bg-stone-300 dark:bg-stone-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Submit buttons */}
                  <div className="mt-6 pt-4 border-t border-light-200/60 dark:border-[#241e17] flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 text-xs font-medium rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#201b16] transition"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      onClick={handleSave}
                      className="px-5 py-2 text-xs font-medium rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] hover:brightness-110 active:scale-95 transition shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? t('crons.savingLabel') || 'Saving...' : t('common.save') || 'Save'}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateEditCronDialog;
