'use client';

import { Dialog, DialogPanel, Switch, Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Layers,
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Trash2,
  Zap,
  RefreshCw,
  Search,
  MessageSquare,
  Calendar,
  Terminal,
} from 'lucide-react';
import React, { useEffect, useState, useMemo } from 'react';
import { ProviderQueueState, QueueTask } from '@/lib/queue/types';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface QueueDrawerProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  selectedProviderId?: string;
}

const getTaskTypeIcon = (type: string) => {
  switch (type) {
    case 'chat':
      return <MessageSquare size={13} className="text-sky-400" />;
    case 'search':
      return <Search size={13} className="text-amber-400" />;
    case 'cron':
      return <Calendar size={13} className="text-purple-400" />;
    case 'playground':
      return <Terminal size={13} className="text-emerald-400" />;
    default:
      return <Layers size={13} className="text-stone-400" />;
  }
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};

export const QueueDrawer = ({
  isOpen,
  setIsOpen,
  selectedProviderId,
}: QueueDrawerProps) => {
  const { t } = useTranslation();
  const [queues, setQueues] = useState<ProviderQueueState[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: string;
    displayName?: string | null;
  } | null>(null);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');

  const fetchAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user || null);
        if (data.instanceMode) {
          setInstanceMode(data.instanceMode);
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const fetchQueues = () => {
    fetch('/api/queue')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.queues) setQueues(d.queues);
      })
      .catch(() => {});
  };

  const isSoloMode = instanceMode === 'single';
  const isAdmin = currentUser?.role === 'admin' || (isSoloMode && !currentUser);

  const canCancelTask = (task?: QueueTask | null) => {
    if (!task) return false;
    if (isAdmin) return true;
    if (currentUser && task.userId && task.userId === currentUser.id) return true;
    return false;
  };

  // Fetch initial queues on mount or subscribe via SSE
  useEffect(() => {
    fetchAuth();
    fetchQueues();

    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource('/api/queue/stream');

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.allQueues) {
            setQueues(data.allQueues);
          } else if (data.queues) {
            setQueues(data.queues);
          }
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource?.close();
        fetchQueues();
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAuth();
      fetchQueues();
    }
  }, [isOpen]);

  // Filter queues to local providers or active ones
  const relevantQueues = useMemo(() => {
    const filtered = queues.filter(
      (q) =>
        q.providerType === 'ollama' ||
        q.providerType === 'lmstudio' ||
        q.totalQueued > 0 ||
        q.activeTask !== null ||
        q.queueEnabled,
    );
    return filtered.length > 0 ? filtered : queues;
  }, [queues]);

  useEffect(() => {
    if (relevantQueues.length > 0) {
      if (selectedProviderId && relevantQueues.some((q) => q.providerId === selectedProviderId)) {
        setActiveTab(selectedProviderId);
      } else if (!activeTab || !relevantQueues.some((q) => q.providerId === activeTab)) {
        setActiveTab(relevantQueues[0].providerId);
      }
    }
  }, [relevantQueues, selectedProviderId, activeTab]);

  const currentQueue = useMemo(() => {
    return relevantQueues.find((q) => q.providerId === activeTab) || relevantQueues[0] || null;
  }, [relevantQueues, activeTab]);

  // Live timer for active running task
  const [activeElapsedMs, setActiveElapsedMs] = useState<number>(0);
  useEffect(() => {
    if (!currentQueue?.activeTask?.startedAt) {
      setActiveElapsedMs(0);
      return;
    }

    const interval = setInterval(() => {
      if (currentQueue.activeTask?.startedAt) {
        setActiveElapsedMs(Date.now() - currentQueue.activeTask.startedAt);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentQueue?.activeTask?.startedAt]);

  const handleCancelTask = async (taskId: string, providerId: string) => {
    setCancellingId(taskId);
    try {
      const res = await fetch(
        `/api/queue/tasks/${taskId}?providerId=${encodeURIComponent(providerId)}`,
        {
          method: 'DELETE',
        },
      );
      if (res.ok) {
        toast.success(t('queue.taskCancelled') || 'Task was cancelled.');
      } else {
        const d = await res.json();
        toast.error(d?.error || 'Failed to cancel the task.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred while cancelling the task.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleToggleQueue = async (providerId: string, enabled: boolean) => {
    if (!isAdmin) {
      toast.error(
        t('queue.adminOnlyToggle') ||
          'Only administrators can configure model task queues.',
      );
      return;
    }
    setToggling(true);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, enabled }),
      });
      if (res.ok) {
        toast.success(
          enabled
            ? t('queue.queueEnabledSuccess') || 'Task queueing enabled.'
            : t('queue.queueDisabledSuccess') || 'Task queueing disabled.',
        );
      } else {
        const d = await res.json();
        toast.error(d?.error || 'Failed to change queue settings.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred while changing queue mode.');
    } finally {
      setToggling(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={() => setIsOpen(false)}
          className="relative z-50"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Right Slide-over Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="w-screen max-w-md bg-light-primary dark:bg-[#0c0a09] border-l border-light-200 dark:border-[#221c16] shadow-2xl flex flex-col h-full overflow-hidden text-black dark:text-stone-100"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#120f0d] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-b from-[#b8864d]/25 to-[#b8864d]/10 border border-[#b8864d]/40 text-[#b8864d]">
                    <Layers size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-black dark:text-stone-100 leading-tight">
                      {t('queue.title') || 'Model Task Queue'}
                    </h3>
                    <p className="text-[11px] text-black/50 dark:text-stone-400 mt-0.5">
                      {t('queue.subtitle') || 'VRAM optimization and sequential execution'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#1e1914] transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Providers Tab Bar if more than 1 */}
              {relevantQueues.length > 1 && (
                <div className="px-4 pt-3 pb-1 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/20 dark:bg-[#0f0d0b]">
                  <div className="flex flex-wrap gap-1.5">
                    {relevantQueues.map((q) => {
                      const isActive = q.providerId === activeTab;
                      const hasTasks = q.activeTask || q.totalQueued > 0;

                      return (
                        <button
                          key={q.providerId}
                          onClick={() => setActiveTab(q.providerId)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            isActive
                              ? 'bg-light-200 dark:bg-[#221c16] text-black dark:text-[#f3d5ab] border border-light-300 dark:border-[#3a2f24]'
                              : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200 hover:bg-light-200/50 dark:hover:bg-[#181410]'
                          }`}
                        >
                          <span>{q.providerName}</span>
                          {hasTasks && (
                            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                          )}
                          {q.totalQueued > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#b8864d]/20 text-[#b8864d] font-bold">
                              {q.totalQueued}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Content Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {currentQueue ? (
                  <>
                    {/* Provider Status & Toggle Card */}
                    <div className="p-4 rounded-xl border border-light-200 dark:border-[#221c16] bg-light-secondary/30 dark:bg-[#14100d] flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-black dark:text-stone-200">
                            {currentQueue.providerName}
                          </span>
                          <span
                            className={`text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                              currentQueue.queueEnabled
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                : 'bg-stone-500/10 text-stone-500 border-stone-500/30'
                            }`}
                          >
                            {currentQueue.queueEnabled
                              ? t('queue.statusActive') || 'Queue active'
                              : t('queue.statusDisabled') || 'Disabled'}
                          </span>
                        </div>
                        {currentQueue.currentlyLoadedModel && (
                          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#b8864d]">
                            <Cpu size={12} />
                            <span>
                              {t('queue.loadedModel') || 'Loaded in VRAM'}:{' '}
                              <strong className="font-mono text-black dark:text-[#f3d5ab]">
                                {currentQueue.currentlyLoadedModel}
                              </strong>
                            </span>
                          </div>
                        )}
                      </div>

                        <div className="flex items-center gap-2">
                          {!isAdmin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                              {t('queue.adminBadge') || 'Admin only'}
                            </span>
                          )}
                          <Switch
                            checked={currentQueue.queueEnabled}
                            disabled={toggling || !isAdmin}
                            onChange={(val: boolean) =>
                              handleToggleQueue(currentQueue.providerId, val)
                            }
                            className={cn(
                              "group relative flex h-6 w-11 shrink-0 rounded-full p-1 duration-200 ease-in-out focus:outline-none transition-colors",
                              !isAdmin
                                ? "cursor-not-allowed opacity-40 bg-stone-300 dark:bg-stone-700"
                                : "cursor-pointer bg-light-200 dark:bg-white/10 data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className="pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-5"
                            />
                          </Switch>
                        </div>
                      </div>

                    {/* Section: Active Running Task */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] uppercase font-bold tracking-wider text-black/60 dark:text-stone-400 flex items-center gap-1.5">
                          <Zap size={13} className="text-amber-500" />
                          <span>{t('queue.activeTask') || 'Active Task'}</span>
                        </h4>
                        {currentQueue.activeTask && (
                          <span className="text-[11px] font-mono font-medium text-amber-500 flex items-center gap-1">
                            <Clock size={11} className="animate-spin" />
                            {formatDuration(activeElapsedMs)}
                          </span>
                        )}
                      </div>

                      {currentQueue.activeTask ? (
                        <div className="p-4 rounded-xl border border-amber-500/30 dark:border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10 space-y-2.5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-xl rounded-full pointer-events-none" />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="p-1 rounded-md bg-amber-500/20 text-amber-500">
                                {getTaskTypeIcon(currentQueue.activeTask.taskType)}
                              </span>
                              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300">
                                {currentQueue.activeTask.taskType}
                              </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-black dark:text-white px-2 py-0.5 rounded-md bg-light-secondary dark:bg-[#1f1914] border border-light-200 dark:border-[#382d20]">
                              {currentQueue.activeTask.modelKey}
                            </span>
                          </div>

                          <p className="text-xs font-medium text-black dark:text-stone-100 line-clamp-2">
                            {currentQueue.activeTask.title}
                          </p>

                          <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-black/60 dark:text-stone-400">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              {t('queue.running') || 'Processing...'}
                            </span>
                            {canCancelTask(currentQueue.activeTask) && (
                              <button
                                onClick={() =>
                                  currentQueue.activeTask &&
                                  handleCancelTask(
                                    currentQueue.activeTask.id,
                                    currentQueue.providerId,
                                  )
                                }
                                disabled={cancellingId === currentQueue.activeTask.id}
                                className="text-red-500 hover:text-red-600 text-xs font-medium transition"
                              >
                                {cancellingId === currentQueue.activeTask.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  t('queue.cancel') || 'Cancel'
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl border border-dashed border-light-200 dark:border-[#221c16] bg-light-secondary/10 dark:bg-[#120f0d] text-center">
                          <p className="text-xs text-black/40 dark:text-stone-500">
                            {t('queue.noActiveTask') || 'No active task (provider is idle)'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Section: Pending Queue */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] uppercase font-bold tracking-wider text-black/60 dark:text-stone-400 flex items-center gap-1.5">
                          <Clock size={13} className="text-sky-500" />
                          <span>
                            {t('queue.pendingTasks') || 'Pending Tasks'} (
                            {currentQueue.pendingTasks.length})
                          </span>
                        </h4>
                      </div>

                      {currentQueue.pendingTasks.length > 0 ? (
                        <div className="space-y-2">
                          {currentQueue.pendingTasks.map((task, idx) => {
                            const isSameModel = !task.isModelSwitch;

                            return (
                              <div
                                key={task.id}
                                className="p-3 rounded-xl border border-light-200 dark:border-[#221c16] bg-light-secondary/20 dark:bg-[#14100d] space-y-2 transition hover:border-light-300 dark:hover:border-[#382d20]"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-light-200 dark:bg-[#221c16] text-[10px] font-bold text-black/70 dark:text-stone-300 flex items-center justify-center">
                                      #{idx + 1}
                                    </span>
                                    <span className="p-1 rounded-md bg-light-100 dark:bg-[#1c1713]">
                                      {getTaskTypeIcon(task.taskType)}
                                    </span>
                                    <span className="text-[10px] uppercase font-bold tracking-wide text-black/60 dark:text-stone-400">
                                      {task.taskType}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-medium text-black/80 dark:text-stone-300">
                                      {task.modelKey}
                                    </span>
                                    {canCancelTask(task) && (
                                      <button
                                        onClick={() =>
                                          handleCancelTask(task.id, currentQueue.providerId)
                                        }
                                        disabled={cancellingId === task.id}
                                        title={t('queue.cancel') || 'Cancel'}
                                        className="p-1 text-black/40 dark:text-stone-500 hover:text-red-500 transition"
                                      >
                                        {cancellingId === task.id ? (
                                          <Loader2 size={13} className="animate-spin" />
                                        ) : (
                                          <X size={13} />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-black/80 dark:text-stone-300 line-clamp-1">
                                  {task.title}
                                </p>

                                {/* Model scheduling optimization badge */}
                                <div className="pt-1.5 border-t border-light-200/50 dark:border-[#1c1713] flex items-center justify-between text-[10px]">
                                  {isSameModel ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                      <CheckCircle2 size={11} />
                                      {t('queue.sameModelNoReload') ||
                                        'Same model (VRAM optimization)'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                      <RefreshCw size={11} />
                                      {t('queue.modelSwitchNeeded') ||
                                        'Requires model switch'}
                                    </span>
                                  )}
                                  <span className="text-black/40 dark:text-stone-500">
                                    {t('queue.queuedAt') || 'Queued'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-dashed border-light-200 dark:border-[#221c16] bg-light-secondary/10 dark:bg-[#120f0d] text-center">
                          <p className="text-xs text-black/40 dark:text-stone-500">
                            {t('queue.noPendingTasks') || 'No pending tasks in queue.'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Section: Recent History */}
                    {currentQueue.history.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-light-200 dark:border-[#221c16]">
                        <h4 className="text-[11px] uppercase font-bold tracking-wider text-black/60 dark:text-stone-400">
                          {t('queue.recentHistory') || 'Recent Activity'}
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {currentQueue.history.map((h) => (
                            <div
                              key={h.id}
                              className="p-2.5 rounded-lg border border-light-200/60 dark:border-[#1a1512] bg-light-secondary/10 dark:bg-[#100e0c] flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                {h.status === 'completed' ? (
                                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                ) : h.status === 'cancelled' ? (
                                  <XCircle size={13} className="text-stone-400 shrink-0" />
                                ) : (
                                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                                )}
                                <span className="truncate text-black/80 dark:text-stone-300">
                                  {h.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 text-[10.5px] font-mono text-black/50 dark:text-stone-400">
                                <span>{h.modelKey}</span>
                                {h.durationMs ? (
                                  <span className="text-[#b8864d]">
                                    ({formatDuration(h.durationMs)})
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12 text-center text-xs text-black/50 dark:text-stone-400">
                    {t('queue.noLocalQueuesConfigured') || 'No local model providers configured (Ollama / LM Studio).'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default QueueDrawer;
