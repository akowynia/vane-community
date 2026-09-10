'use client';

import React, { useState, Fragment } from 'react';
import Link from 'next/link';
import {
  Clock,
  Calendar,
  Play,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  MessageSquare,
  Globe2,
  Cpu,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { formatTimeDifference } from '@/lib/utils';
import WaypointIcon from '@/components/Waypoints/WaypointIcon';
import { describeSchedule } from '@/lib/cron/parser';
import { CronItem, CreateEditCronDialog } from './CreateEditCronDialog';

interface CronListProps {
  crons: CronItem[];
  onCronsChange: (updatedList: CronItem[]) => void;
  fixedWaypointId?: string;
  onRequireLogin?: () => void;
  emptyTitle?: string;
  emptyDesc?: string;
  onCreateNew?: () => void;
  showWaypointBadge?: boolean;
}

export const CronList: React.FC<CronListProps> = ({
  crons,
  onCronsChange,
  fixedWaypointId,
  onRequireLogin,
  emptyTitle,
  emptyDesc,
  onCreateNew,
  showWaypointBadge = true,
}) => {
  const { t, locale } = useTranslation();
  const isPl = locale.startsWith('pl');

  const [runningCronId, setRunningCronId] = useState<string | null>(null);
  const [editingCron, setEditingCron] = useState<CronItem | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CronItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle active/inactive
  const handleToggleEnabled = async (cron: CronItem) => {
    try {
      const res = await fetch(`/api/crons/${cron.id}/toggle`, {
        method: 'PATCH',
      });

      if (res.status === 401) {
        if (onRequireLogin) onRequireLogin();
        toast.error(t('crons.loginRequired') || 'Login required.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || t('crons.toggleSuccess') || 'Schedule status changed.');
        onCronsChange(
          crons.map((c) => (c.id === cron.id ? { ...c, ...data.cron, enabled: data.enabled } : c)),
        );
      } else {
        const err = await res.json();
        throw new Error(err?.message || t('crons.toggleErrorGeneric') || 'Error toggling status');
      }
    } catch (err: any) {
      toast.error(err?.message || t('crons.toggleErrorFallback') || 'Failed to change the task status.');
    }
  };

  // Run Now on demand
  const handleRunNow = async (cron: CronItem) => {
    setRunningCronId(cron.id);
    try {
      const res = await fetch(`/api/crons/${cron.id}/run`, {
        method: 'POST',
      });

      if (res.status === 401) {
        if (onRequireLogin) onRequireLogin();
        toast.error(t('crons.loginRequired') || 'Login required.');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        toast.success(
          t('crons.runSuccess') || 'Task executed successfully!',
          {
            action: data.chatId
              ? {
                  label: t('crons.openChatAction') || 'Open chat',
                  onClick: () => {
                    window.location.href = `/c/${data.chatId}`;
                  },
                }
              : undefined,
          },
        );

        if (data.cron) {
          onCronsChange(
            crons.map((c) => (c.id === cron.id ? { ...c, ...data.cron } : c)),
          );
        }
      } else {
        const err = await res.json();
        throw new Error(err?.message || t('crons.runErrorGeneric') || 'Error running the task');
      }
    } catch (err: any) {
      toast.error(err?.message || t('crons.runErrorFallback') || 'An error occurred while running the task.');
    } finally {
      setRunningCronId(null);
    }
  };

  // Delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/crons/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (res.status === 401) {
        if (onRequireLogin) onRequireLogin();
        toast.error(t('crons.loginRequired') || 'Login required.');
        return;
      }

      if (res.ok) {
        toast.success(t('crons.deleteSuccess') || 'Schedule deleted successfully.');
        onCronsChange(crons.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const err = await res.json();
        throw new Error(err?.message || t('crons.deleteErrorGeneric') || 'Error deleting');
      }
    } catch (err: any) {
      toast.error(err?.message || t('crons.deleteErrorFallback') || 'Failed to delete the schedule.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaved = (saved: CronItem) => {
    const idx = crons.findIndex((c) => c.id === saved.id);
    if (idx >= 0) {
      const updated = [...crons];
      updated[idx] = { ...updated[idx], ...saved };
      onCronsChange(updated);
    } else {
      onCronsChange([saved, ...crons]);
    }
  };

  if (crons.length === 0) {
    return (
      <div className="text-center py-14 px-4 rounded-3xl border border-dashed border-light-300 dark:border-[#282018] bg-light-secondary/30 dark:bg-[#110e0c]/40">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#b8864d]/25 to-[#b8864d]/5 border border-[#b8864d]/30 text-[#b8864d] inline-flex mb-3">
          <Clock size={32} />
        </div>
        <h3 className="text-sm sm:text-base font-semibold text-black dark:text-stone-200 mb-1">
          {emptyTitle || t('crons.noCronsFound') || 'No scheduled tasks configured.'}
        </h3>
        <p className="text-xs text-black/60 dark:text-stone-400 max-w-md mx-auto mb-5 leading-relaxed">
          {emptyDesc || t('crons.noCronsDesc') ||
            'Define a recurring task with a prompt, and the AI model will automatically generate analyses at the times you choose.'}
        </p>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 active:scale-95 transition shadow-sm"
          >
            <Clock size={15} />
            <span>{t('crons.create') || 'New schedule'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {crons.map((cron) => {
          const isRunning = runningCronId === cron.id || cron.lastStatus === 'running';
          const humanSchedule = describeSchedule(cron.schedule, locale);
          const safeSources = Array.isArray(cron.sources) ? cron.sources : [];

          return (
            <div
              key={cron.id}
              className={`p-5 rounded-2xl border transition-all duration-200 ${
                cron.enabled
                  ? 'border-light-200 dark:border-[#251f19] bg-light-primary dark:bg-[#14110e] hover:border-[#b8864d]/50'
                  : 'border-light-200/60 dark:border-[#1e1814] bg-light-secondary/40 dark:bg-[#0e0c0a] opacity-75'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Left side: Icon, Name, Waypoint, Schedule */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="p-3 rounded-xl bg-light-secondary dark:bg-[#1e1915] border border-light-200/80 dark:border-[#30271e] text-[#b8864d] shrink-0 mt-0.5">
                    <Clock size={20} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-black dark:text-stone-100 truncate">
                        {cron.name}
                      </h3>

                      {/* Waypoint space badge */}
                      {showWaypointBadge && cron.waypointName && (
                        <Link
                          href={`/waypoints/${cron.waypointId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#b8864d]/10 text-[#b8864d] border border-[#b8864d]/25 hover:bg-[#b8864d]/20 transition"
                        >
                          <WaypointIcon name={cron.waypointIcon} size={12} />
                          <span>{cron.waypointName}</span>
                        </Link>
                      )}

                      {/* Enabled / Paused status badge */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          cron.enabled
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-stone-500/10 text-stone-400 border-stone-500/20'
                        }`}
                      >
                        {cron.enabled
                          ? t('crons.enabled') || 'Active'
                          : t('crons.disabled') || 'Paused'}
                      </span>
                    </div>

                    {/* Prompt snippet */}
                    <p className="text-xs text-black/70 dark:text-stone-300 line-clamp-2 leading-relaxed mb-2 font-mono bg-light-secondary/40 dark:bg-[#0c0a09] p-2 rounded-xl border border-light-200/40 dark:border-[#221c16]">
                      "{cron.prompt}"
                    </p>

                    {/* Schedule, Model, and Run Metadata */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-black/60 dark:text-stone-400">
                      {/* Schedule info */}
                      <span className="inline-flex items-center gap-1 font-medium text-[#b8864d]">
                        <Calendar size={12} />
                        <span>{humanSchedule}</span>
                      </span>

                      {/* AI Model Tag */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-light-secondary dark:bg-[#1a1613] border border-light-200 dark:border-[#2b231b]">
                        <Cpu size={12} className="text-sky-500" />
                        <span>{cron.chatModelKey}</span>
                      </span>

                      {/* Sources Tag */}
                      {safeSources.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-light-secondary dark:bg-[#1a1613] border border-light-200 dark:border-[#2b231b]">
                          <Globe2 size={12} />
                          <span>
                            {safeSources
                              .map((s) => {
                                if (s === 'web') return t('focusModes.web') || 'Web';
                                if (s === 'academic') return t('focusModes.academic') || 'Academic';
                                if (s === 'discussions') return t('focusModes.discussions') || 'Discussions';
                                return s;
                              })
                              .join(', ')}
                          </span>
                        </span>
                      )}

                      {/* Last Run & Status */}
                      {cron.lastRunAt && (
                        <span className="inline-flex items-center gap-1">
                          <span>{t('crons.lastRunShort') || 'Last:'}</span>
                          <span className="font-medium text-black/80 dark:text-stone-300">
                            {formatTimeDifference(new Date(), cron.lastRunAt, locale)}
                          </span>
                          {cron.lastStatus === 'success' && (
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          )}
                          {cron.lastStatus === 'error' && (
                            <span className="inline-flex items-center gap-0.5 text-red-500 font-semibold" title={cron.lastError || ''}>
                              <AlertCircle size={13} />
                              <span>{t('crons.statusError') || 'Error'}</span>
                            </span>
                          )}
                        </span>
                      )}

                      {/* Next Run */}
                      {cron.enabled && cron.nextRunAt && (
                        <span className="inline-flex items-center gap-1 text-black/50 dark:text-stone-500">
                          <span>• {t('crons.nextRunShort') || 'Next:'}</span>
                          <span className="font-medium text-black/70 dark:text-stone-300">
                            {formatTimeDifference(new Date(), cron.nextRunAt, locale)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Link to last generated chat */}
                  {cron.lastChatId && (
                    <Link
                      href={`/c/${cron.lastChatId}`}
                      className="p-2 rounded-xl text-black/50 dark:text-stone-400 hover:text-[#b8864d] hover:bg-light-200 dark:hover:bg-[#1e1915] border border-light-200 dark:border-[#2b231b] transition flex items-center gap-1 text-xs"
                      title={t('crons.viewLastChatTitle') || 'View last generated chat'}
                    >
                      <MessageSquare size={14} />
                      <span className="hidden md:inline">{t('crons.lastChatLabel') || 'Last chat'}</span>
                    </Link>
                  )}

                  {/* Run Now Button */}
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => handleRunNow(cron)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/30 hover:bg-[#b8864d]/25 active:scale-95 transition disabled:opacity-50"
                    title={t('crons.runNow') || 'Run Now'}
                  >
                    {isRunning ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={13} className="fill-[#b8864d]" />
                    )}
                    <span>{isRunning ? t('crons.running') || 'Running...' : t('crons.runNow') || 'Run Now'}</span>
                  </button>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleEnabled(cron)}
                    title={cron.enabled ? t('crons.pauseTask') || 'Pause task' : t('crons.enableTask') || 'Enable task'}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      cron.enabled ? 'bg-[#b8864d]' : 'bg-stone-300 dark:bg-stone-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        cron.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCron(cron);
                      setIsEditDialogOpen(true);
                    }}
                    title={t('common.edit') || 'Edit'}
                    className="p-2 rounded-xl text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#1e1915] border border-light-200 dark:border-[#2b231b] transition"
                  >
                    <Edit2 size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(cron)}
                    title={t('common.delete') || 'Delete'}
                    className="p-2 rounded-xl text-black/50 dark:text-stone-400 hover:text-red-500 hover:bg-red-500/10 border border-light-200 dark:border-[#2b231b] transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Cron Dialog */}
      <CreateEditCronDialog
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        cron={editingCron}
        fixedWaypointId={fixedWaypointId}
        onSaved={handleSaved}
        onRequireLogin={onRequireLogin}
      />

      {/* Delete Confirmation Dialog */}
      <Transition appear show={Boolean(deleteTarget)} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        >
          <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#14110f] border border-light-200 dark:border-[#2e261e] p-6 text-left align-middle shadow-2xl transition-all">
                  <DialogTitle className="text-base font-semibold text-black dark:text-stone-100">
                    {t('crons.confirmDeleteTitle') || 'Are you sure you want to delete this schedule?'}
                  </DialogTitle>
                  <p className="mt-2 text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                    {t('crons.confirmDeleteDesc') ||
                      'This action cannot be undone. The scheduled task will no longer run.'}
                  </p>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setDeleteTarget(null)}
                      className="px-4 py-2 text-xs font-medium rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#201b16] transition"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={confirmDelete}
                      className="px-4 py-2 text-xs font-medium rounded-xl bg-red-500 hover:bg-red-600 text-white transition active:scale-95 disabled:opacity-50"
                    >
                      {isDeleting ? t('crons.deletingLabel') || 'Deleting...' : t('common.delete') || 'Delete'}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default CronList;
