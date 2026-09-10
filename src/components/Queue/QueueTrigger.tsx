'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Layers, Zap } from 'lucide-react';
import QueueDrawer from './QueueDrawer';
import { ProviderQueueState } from '@/lib/queue/types';
import { useTranslation } from '@/lib/i18n';

export const QueueTrigger = () => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isScratchpadEditor = pathname ? /^\/scratchpad\/[^/]+/.test(pathname) : false;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | undefined>(undefined);
  const [queues, setQueues] = useState<ProviderQueueState[]>([]);


  useEffect(() => {
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
      };
    };

    const fetchQueues = () => {
      fetch('/api/queue')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.queues) {
            setQueues(data.queues);
          }
        })
        .catch(() => {});
    };

    fetchQueues();
    connectSSE();

    const handleOpenDrawer = (e: Event) => {
      const customEvent = e as CustomEvent<{ providerId?: string }>;
      if (customEvent.detail?.providerId) {
        setSelectedProviderId(customEvent.detail.providerId);
      }
      setIsOpen(true);
    };

    window.addEventListener('open-queue-drawer', handleOpenDrawer);

    return () => {
      eventSource?.close();
      window.removeEventListener('open-queue-drawer', handleOpenDrawer);
    };
  }, []);

  const totalActive = queues.filter((q) => q.activeTask !== null).length;
  const totalPending = queues.reduce((sum, q) => sum + q.totalQueued, 0);
  const totalTasks = totalActive + totalPending;

  return (
    <>
      {/* Floating trigger on the right side of the screen - hidden on Scratchpad workspace where it is integrated in top header */}
      {!isScratchpadEditor && (
        <div className="fixed top-20 right-3 z-40 lg:right-6">
          <button
            onClick={() => setIsOpen(true)}
            title={
              totalTasks > 0
                ? `${t('queue.title') || 'Queue'}: ${totalActive} ${t('queue.active') || 'active'}, ${totalPending} ${t('queue.pending') || 'in queue'}`
                : t('queue.title') || 'Model Task Queue'
            }
            className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 active:scale-95 ${
              totalTasks > 0
                ? 'bg-gradient-to-r from-[#b8864d]/30 to-[#b8864d]/10 border-[#b8864d]/60 text-black dark:text-[#f3d5ab] shadow-[#b8864d]/10 ring-2 ring-[#b8864d]/30'
                : 'bg-light-primary/90 dark:bg-[#14100d]/90 border-light-200 dark:border-[#28221b] text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200 hover:border-light-300 dark:hover:border-[#3a2f24]'
            }`}
          >
            <div className="relative">
              {totalActive > 0 ? (
                <Zap size={14} className="text-amber-500 animate-pulse" />
              ) : (
                <Layers size={14} className="group-hover:scale-110 transition-transform" />
              )}
              {totalPending > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-500 ring-1 ring-black" />
              )}
            </div>

            <span className="text-[11px] font-medium tracking-tight">
              {totalTasks > 0 ? (
                <span className="flex items-center gap-1">
                  <strong className="font-mono text-amber-500">{totalTasks}</strong>
                  <span className="hidden sm:inline opacity-80">{t('queue.tasksShort') || 'in queue'}</span>
                </span>
              ) : (
                <span className="hidden sm:inline">{t('queue.tabQueue') || 'Queue'}</span>
              )}
            </span>
          </button>
        </div>
      )}


      <QueueDrawer
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        selectedProviderId={selectedProviderId}
      />
    </>
  );
};

export default QueueTrigger;
