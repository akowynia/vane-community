'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import DeleteChat from '@/components/DeleteChat';
import { formatTimeDifference } from '@/lib/utils';
import {
  BookOpenText,
  ClockIcon,
  FileText,
  Globe2Icon,
  Clock,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import CronList from '@/components/Crons/CronList';
import CreateEditCronDialog, { CronItem } from '@/components/Crons/CreateEditCronDialog';
import LoginDialog from '@/components/Auth/LoginDialog';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  sources: string[];
  files: { fileId: string; name: string }[];
}

const LibraryContent = () => {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'crons' ? 'crons' : 'chats';

  const [activeTab, setActiveTab] = useState<'chats' | 'crons'>(initialTab);
  const [chats, setChats] = useState<Chat[]>([]);
  const [crons, setCrons] = useState<CronItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCrons, setLoadingCrons] = useState(true);

  // Search & filtering for crons
  const [cronSearch, setCronSearch] = useState('');
  const [selectedWaypointFilter, setSelectedWaypointFilter] = useState<string>('all');
  const [isCreateCronOpen, setIsCreateCronOpen] = useState(false);

  // Multi-user & auth
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [instanceMode, setInstanceMode] = useState<string>('single');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const isGuest = instanceMode === 'multi' && !currentUser;

  const { t, locale } = useTranslation();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user || null);
        if (data.instanceMode) {
          setInstanceMode(data.instanceMode);
        }
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        setChats(Array.isArray(data.chats) ? data.chats : []);
      } else {
        setChats([]);
      }
    } catch (err) {
      console.error('Error fetching chats in library:', err);
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCrons = async () => {
    setLoadingCrons(true);
    try {
      const res = await fetch(`/api/crons`);
      if (res.ok) {
        const data = await res.json();
        setCrons(Array.isArray(data.crons) ? data.crons : []);
      } else {
        setCrons([]);
      }
    } catch (err) {
      console.error('Error fetching crons in library:', err);
      setCrons([]);
    } finally {
      setLoadingCrons(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchChats();
    fetchCrons();
  }, []);

  // Unique waypoints for filter dropdown
  const waypointFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of crons) {
      if (c.waypointId && c.waypointName) {
        map.set(c.waypointId, c.waypointName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [crons]);

  const filteredCrons = useMemo(() => {
    return crons.filter((c) => {
      if (selectedWaypointFilter !== 'all' && c.waypointId !== selectedWaypointFilter) {
        return false;
      }
      const q = cronSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.prompt.toLowerCase().includes(q) ||
        (c.waypointName && c.waypointName.toLowerCase().includes(q))
      );
    });
  }, [crons, selectedWaypointFilter, cronSearch]);

  const activeCronsCount = crons.filter((c) => c.enabled).length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col pt-8 border-b border-light-200/50 dark:border-[#221c16] pb-5 px-2">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div className="flex items-center justify-center lg:justify-start">
            <div className="flex flex-col">
              <h1 className="text-3xl lg:text-4xl text-center lg:text-left text-black dark:text-stone-100 font-bold tracking-tight mb-1">
                {t('library.title')}
              </h1>
              <div className="px-1 text-xs sm:text-sm text-black/60 dark:text-stone-400 text-center lg:text-left">
                {t('library.subtitle')}
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center justify-center lg:justify-end gap-2 text-xs text-black/60 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-light-200 dark:border-[#2b231b] bg-light-primary dark:bg-[#14110e] px-3 py-1 font-medium">
              <BookOpenText size={14} className="text-[#b8864d]" />
              <span>
                {loading
                  ? t('library.loading')
                  : `${chats.length} ${chats.length === 1 ? t('common.chat') || 'czat' : t('common.chats') || 'czatów'}`}
              </span>
            </span>

            {(!isGuest) && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-light-200 dark:border-[#2b231b] bg-light-primary dark:bg-[#14110e] px-3 py-1 font-medium">
                <Clock size={14} className="text-[#b8864d]" />
                <span>
                  {loadingCrons
                    ? '...'
                    : `${crons.length} ${crons.length === 1 ? t('crons.countSingle') || 'schedule' : t('crons.countMultiple') || 'schedules'}`}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-between gap-3 mt-6 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('chats')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                activeTab === 'chats'
                  ? 'bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/30 shadow-sm'
                  : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#181411]'
              }`}
            >
              <MessageSquare size={16} />
              <span>{t('crons.tabsChats') || 'All Chats'}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-light-200 dark:bg-[#201b16] font-semibold">
                {chats.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('crons')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                activeTab === 'crons'
                  ? 'bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/30 shadow-sm'
                  : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200/60 dark:hover:bg-[#181411]'
              }`}
            >
              <Clock size={16} />
              <span>{t('crons.tabsCrons') || 'Schedules (Crons)'}</span>
              {!isGuest && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-light-200 dark:bg-[#201b16] font-semibold">
                  {crons.length}
                </span>
              )}
            </button>
          </div>

          {/* Action button in header if on crons tab and not guest */}
          {activeTab === 'crons' && !isGuest && (
            <button
              onClick={() => setIsCreateCronOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 active:scale-95 transition shadow-sm shrink-0"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">{t('crons.create') || 'New schedule'}</span>
              <span className="sm:hidden">{t('common.add') || 'Add'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Chats View */}
      {activeTab === 'chats' && (
        <>
          {loading ? (
            <div className="flex flex-row items-center justify-center min-h-[50vh]">
              <div className="w-8 h-8 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (chats || []).length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-2 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl border border-light-200 dark:border-[#282119] bg-light-secondary dark:bg-[#14110e] text-[#b8864d]">
                <BookOpenText size={24} />
              </div>
              <p className="mt-3 text-black/70 dark:text-stone-300 text-sm font-medium">
                {t('library.noChatsFound')}
              </p>
              <p className="mt-1 text-black/50 dark:text-stone-500 text-xs">
                <Link href="/" className="text-[#b8864d] hover:underline font-medium">
                  {t('library.startNewChat')}
                </Link>{' '}
                {t('library.toSeeItListed')}
              </p>
            </div>
          ) : (
            <div className="pt-6 pb-28 px-2">
              <div className="rounded-2xl border border-light-200 dark:border-[#251f19] overflow-hidden bg-light-primary dark:bg-[#14110e]">
                {chats.map((chat, index) => {
                  const safeSources = Array.isArray(chat?.sources) ? chat.sources : [];
                  const safeFiles = Array.isArray(chat?.files) ? chat.files : [];

                  const sourcesLabel =
                    safeSources.length === 0
                      ? null
                      : safeSources.length <= 2
                        ? safeSources
                            .filter((s) => typeof s === 'string')
                            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(', ')
                        : `${safeSources
                            .slice(0, 2)
                            .filter((s) => typeof s === 'string')
                            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(', ')} + ${safeSources.length - 2}`;

                  return (
                    <div
                      key={chat.id}
                      className={
                        'group flex flex-col gap-2 p-4 hover:bg-light-secondary dark:hover:bg-[#1a1612] transition-colors duration-200 ' +
                        (index !== chats.length - 1
                          ? 'border-b border-light-200 dark:border-[#221c16]'
                          : '')
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/c/${chat.id}`}
                          className="flex-1 text-black dark:text-stone-100 text-base sm:text-lg font-medium leading-snug line-clamp-2 group-hover:text-[#b8864d] transition duration-200"
                          title={chat.title || 'Untitled'}
                        >
                          {chat.title || 'Untitled'}
                        </Link>
                        <div className="pt-0.5 shrink-0">
                          <DeleteChat
                            chatId={chat.id}
                            chats={chats}
                            setChats={setChats}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-black/60 dark:text-stone-400">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <ClockIcon size={13} />
                          {chat.createdAt
                            ? formatTimeDifference(new Date(), chat.createdAt, locale)
                            : ''}
                        </span>

                        {sourcesLabel && (
                          <span className="inline-flex items-center gap-1 text-xs border border-light-200 dark:border-[#2c241c] rounded-full px-2 py-0.5">
                            <Globe2Icon size={13} />
                            {sourcesLabel}
                          </span>
                        )}
                        {safeFiles.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs border border-light-200 dark:border-[#2c241c] rounded-full px-2 py-0.5">
                            <FileText size={13} />
                            {safeFiles.length}{' '}
                            {safeFiles.length === 1 ? t('common.file') : t('common.files')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab 2: Crons (Harmonogramy ze wszystkich przestrzeni) */}
      {activeTab === 'crons' && (
        <div className="pt-5 pb-28 px-2 space-y-4">
          {isGuest ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center py-12">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl border border-[#b8864d]/30 bg-[#b8864d]/10 text-[#b8864d] shadow-sm mb-4">
                <Clock size={28} />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-black dark:text-stone-100">
                {t('crons.guestTitle') || 'Schedules (Crons) require logging in'}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-black/60 dark:text-stone-400 max-w-md leading-relaxed">
                {t('crons.guestDesc') ||
                  'Log in to create recurring tasks, define timed prompts, and automate AI analyses in Waypoints spaces.'}
              </p>
              <button
                type="button"
                onClick={() => setIsLoginOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs sm:text-sm hover:brightness-110 active:scale-95 transition shadow-sm"
              >
                <span>{t('auth.login') || 'Log in'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Filtering and Search Controls */}
              {crons.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-light-200 dark:border-[#251f19] bg-light-primary dark:bg-[#14110e]">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {/* Search input */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-stone-500"
                      />
                      <input
                        type="text"
                        value={cronSearch}
                        onChange={(e) => setCronSearch(e.target.value)}
                        placeholder={
                          t('crons.searchPlaceholder') || 'Search task, prompt, or space...'
                        }
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs text-black dark:text-stone-200 placeholder:text-black/40 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#b8864d]/70 transition"
                      />
                    </div>

                    {/* Waypoint filter dropdown */}
                    {waypointFilterOptions.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Filter size={13} className="text-[#b8864d] shrink-0" />
                        <select
                          value={selectedWaypointFilter}
                          onChange={(e) => setSelectedWaypointFilter(e.target.value)}
                          className="px-2.5 py-1.5 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]/70 transition"
                        >
                          <option value="all">
                            {t('crons.allSpaces') || 'All spaces'}
                          </option>
                          {waypointFilterOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Stats pill */}
                  <div className="text-xs text-black/60 dark:text-stone-400 self-end sm:self-center">
                    {t('crons.activeCount') || 'Active:'}{' '}
                    <span className="font-semibold text-emerald-500">{activeCronsCount}</span> /{' '}
                    {crons.length}
                  </div>
                </div>
              )}

              {/* Crons List Content */}
              {loadingCrons ? (
                <div className="flex flex-row items-center justify-center min-h-[40vh]">
                  <div className="w-8 h-8 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <CronList
                  crons={filteredCrons}
                  onCronsChange={setCrons}
                  onRequireLogin={() => setIsLoginOpen(true)}
                  onCreateNew={() => setIsCreateCronOpen(true)}
                  showWaypointBadge={true}
                  emptyTitle={t('crons.emptyLibraryTitle') || 'No schedules in library'}
                  emptyDesc={
                    t('crons.emptyLibraryDesc') ||
                    'Create a recurring task linked to any waypoint to automate AI research.'
                  }
                />
              )}

              {/* Global Create Cron Dialog */}
              <CreateEditCronDialog
                isOpen={isCreateCronOpen}
                setIsOpen={setIsCreateCronOpen}
                onSaved={(newCron) => setCrons([newCron, ...crons])}
                onRequireLogin={() => setIsLoginOpen(true)}
              />
            </>
          )}
        </div>
      )}

      {/* Login Dialog if needed */}
      <LoginDialog
        isOpen={isLoginOpen}
        setIsOpen={setIsLoginOpen}
        currentUser={currentUser}
        onAuthChange={() => {
          fetchCurrentUser();
          fetchChats();
          fetchCrons();
        }}
      />
    </div>
  );
};

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="flex flex-row items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
};

export default Page;
