'use client';

import React, { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Waypoints,
  Plus,
  Search,
  MessageSquare,
  Clock,
  Terminal,
  Edit2,
  Trash2,
  ArrowRight,
  Sparkles,
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
import CreateEditWaypointDialog, {
  WaypointItem,
} from '@/components/Waypoints/CreateEditWaypointDialog';
import LoginDialog from '@/components/Auth/LoginDialog';

const WaypointsPage = () => {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [waypoints, setWaypoints] = useState<WaypointItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWaypoint, setEditingWaypoint] = useState<WaypointItem | null>(null);

  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: string;
    displayName?: string | null;
  } | null>(null);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WaypointItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCurrentUser = async () => {
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

  const fetchWaypoints = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/waypoints');
      if (res.ok) {
        const data = await res.json();
        setWaypoints(Array.isArray(data.waypoints) ? data.waypoints : []);
      } else {
        setWaypoints([]);
      }
    } catch (err) {
      console.error('Failed to fetch waypoints:', err);
      toast.error(t('waypoints.fetchListError') || 'Failed to fetch the waypoints list.');
      setWaypoints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchWaypoints();
  }, []);

  const handleOpenCreate = () => {
    if (instanceMode === 'multi' && !currentUser) {
      toast.error(t('waypoints.createRequiresLoginToast') || 'Creating personalized spaces requires logging in.');
      setIsLoginOpen(true);
      return;
    }
    setEditingWaypoint(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, wp: WaypointItem) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingWaypoint(wp);
    setIsDialogOpen(true);
  };

  const handleOpenDelete = (e: React.MouseEvent, wp: WaypointItem) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteTarget(wp);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/waypoints/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('waypoints.deleteSuccess') || 'Waypoint deleted successfully.');
        setWaypoints((prev) => prev.filter((w) => w.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const err = await res.json();
        throw new Error(err?.message || t('waypoints.deleteErrorGeneric') || 'Error deleting');
      }
    } catch (err: any) {
      toast.error(err?.message || t('waypoints.deleteErrorFallback') || 'Failed to delete the waypoint.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaved = (savedWp: WaypointItem) => {
    setWaypoints((prev) => {
      const idx = prev.findIndex((w) => w.id === savedWp.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...savedWp };
        return updated;
      }
      return [savedWp, ...prev];
    });
  };

  const filteredWaypoints = waypoints.filter((wp) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      wp.name.toLowerCase().includes(q) ||
      (wp.description && wp.description.toLowerCase().includes(q)) ||
      (wp.systemInstructions && wp.systemInstructions.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-light-200/50 dark:border-[#221c16]">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#b8864d]/30 to-[#b8864d]/10 border border-[#b8864d]/40 text-[#b8864d] shadow-sm">
            <Waypoints size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-stone-100">
                {t('waypoints.title') || 'Waypoints'}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mt-1 max-w-2xl">
              {t('waypoints.subtitle') ||
                'Your dedicated spaces with custom Masterprompts and persistent system instructions.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs sm:text-sm hover:brightness-110 active:scale-95 transition shadow-sm"
          >
            <Plus size={17} />
            <span>{t('waypoints.create') || 'New waypoint'}</span>
          </button>
        </div>
      </div>

      {/* Multi-user Guest / Unauthenticated Notice Banner */}
      {instanceMode === 'multi' && !currentUser && (
        <div className="mt-4 p-3.5 rounded-2xl border border-[#b8864d]/30 bg-[#b8864d]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#b8864d]">
            <Sparkles size={16} className="shrink-0" />
            <span className="text-black/80 dark:text-stone-200">
              {t('waypoints.guestBannerText') ||
                "You're browsing public spaces. Log in to create and manage your own private Waypoint spaces."}
            </span>
          </div>
          <button
            onClick={() => setIsLoginOpen(true)}
            className="shrink-0 self-start sm:self-auto px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 transition shadow-sm"
          >
            {t('auth.login') || 'Log In'}
          </button>
        </div>
      )}

      {/* Filter / Search bar if waypoints exist */}
      {waypoints.length > 0 && (
        <div className="pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-stone-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('waypoints.searchPlaceholder') || 'Search spaces...'}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-light-200 dark:border-[#282119] bg-light-primary dark:bg-[#14110e] text-xs sm:text-sm text-black dark:text-stone-200 placeholder:text-black/40 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#b8864d]/60 transition"
            />
          </div>
          <div className="text-xs text-black/50 dark:text-stone-400 self-end sm:self-center">
            {t('waypoints.totalSpaces') || 'Total spaces:'}{' '}
            <span className="font-semibold text-[#b8864d]">{waypoints.length}</span>
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-10 h-10 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-xs text-black/60 dark:text-stone-400">
            {t('waypoints.loadingSpaces') || 'Loading Waypoint spaces...'}
          </p>
        </div>
      ) : waypoints.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center text-center min-h-[55vh] p-8 mt-6 rounded-3xl border border-dashed border-light-300 dark:border-[#2c241c] bg-light-secondary/40 dark:bg-[#110e0c]/60">
          <div className="p-4 rounded-3xl bg-gradient-to-br from-[#b8864d]/25 to-[#b8864d]/5 border border-[#b8864d]/30 text-[#b8864d] mb-4">
            <Waypoints size={42} />
          </div>
          <h3 className="text-lg font-semibold text-black dark:text-stone-100 mb-1">
            {t('waypoints.noWaypointsFound') || 'No waypoints created yet.'}
          </h3>
          <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 max-w-md mb-6 leading-relaxed">
            {t('waypoints.createNewWaypoint') ||
              'Create your first waypoint to specialize AI responses for your task. Each space has its own unique Masterprompt.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-sm hover:brightness-110 active:scale-95 transition shadow-sm"
          >
            <Plus size={17} />
            <span>{t('waypoints.create') || 'Create your first waypoint'}</span>
          </button>
        </div>
      ) : filteredWaypoints.length === 0 ? (
        <div className="text-center py-16 text-black/50 dark:text-stone-400 text-sm">
          {t('waypoints.noResultsForQuery', { query: searchQuery }) ||
            `No spaces matching "${searchQuery}".`}
        </div>
      ) : (
        /* Waypoints Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-4">
          {filteredWaypoints.map((wp) => {
            const hasMasterprompt = Boolean(wp.systemInstructions && wp.systemInstructions.trim());
            const promptLength = wp.systemInstructions ? wp.systemInstructions.trim().length : 0;

            return (
              <div
                key={wp.id}
                onClick={() => router.push(`/waypoints/${wp.id}`)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl border border-light-200 dark:border-[#251f19] bg-light-primary dark:bg-[#14110e] hover:border-[#b8864d]/60 dark:hover:border-[#b8864d]/60 hover:shadow-xl hover:shadow-black/20 transition-all duration-200 cursor-pointer overflow-hidden"
              >
                {/* Subtle gradient background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#b8864d]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div>
                  {/* Top card bar: icon + badge + actions */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-light-secondary dark:bg-[#1e1915] border border-light-200/80 dark:border-[#30271e] text-[#b8864d] group-hover:scale-105 group-hover:border-[#b8864d]/50 transition duration-200">
                        <WaypointIcon name={wp.icon} size={22} />
                      </div>
                      {wp.isPublic ? (
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {t('waypoints.sharedBadge') || 'Shared'}
                        </span>
                      ) : (
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/30">
                          {t('waypoints.privateBadge') || 'Private'}
                        </span>
                      )}
                    </div>

                    {wp.isOwner && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(e, wp)}
                          title={t('common.edit') || 'Edit'}
                          className="p-1.5 rounded-lg text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#221c17] transition"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleOpenDelete(e, wp)}
                          title={t('common.delete') || 'Delete'}
                          className="p-1.5 rounded-lg text-black/50 dark:text-stone-400 hover:text-red-500 hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Title and Description */}
                  <h3 className="text-base font-semibold text-black dark:text-stone-100 group-hover:text-[#b8864d] transition duration-200 line-clamp-1 mb-1">
                    {wp.name}
                  </h3>
                  <p className="text-xs text-black/60 dark:text-stone-400 line-clamp-2 leading-relaxed min-h-[32px]">
                    {wp.description || t('waypoints.noDescription') || 'No description for this waypoint.'}
                  </p>

                  {/* Masterprompt status pill */}
                  <div className="mt-3.5 pt-3 border-t border-light-200/50 dark:border-[#221c16]">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-black/70 dark:text-stone-300">
                      <Terminal size={13} className="text-[#b8864d] shrink-0" />
                      {hasMasterprompt ? (
                        <span className="truncate">
                          {(() => {
                            const template =
                              t('waypoints.masterpromptCharCount') ||
                              'Masterprompt: {count} characters';
                            const [prefix, suffix] = template.split('{count}');
                            return (
                              <>
                                {prefix}
                                <span className="text-[#b8864d] font-semibold">{promptLength}</span>
                                {suffix}
                              </>
                            );
                          })()}
                        </span>
                      ) : (
                        <span className="text-black/40 dark:text-stone-500 italic">
                          {t('waypoints.defaultInstructions') || 'Default instructions'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer of card */}
                <div className="mt-4 pt-3 flex items-center justify-between text-xs text-black/50 dark:text-stone-400 border-t border-light-200/50 dark:border-[#221c16]">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare size={13} />
                    <span>
                      {wp.chatsCount || 0}{' '}
                      {(wp.chatsCount || 0) === 1
                        ? t('common.chat') || 'chat'
                        : t('common.chats') || 'chats'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 group-hover:text-[#b8864d] transition duration-200 font-medium text-[11px]">
                    <span>{t('waypoints.openWaypoint') || 'Open space'}</span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <CreateEditWaypointDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        waypoint={editingWaypoint}
        onSaved={handleSaved}
        isAdmin={currentUser?.role === 'admin'}
        onRequireLogin={() => setIsLoginOpen(true)}
      />

      {/* Login Dialog for multi-user mode */}
      <LoginDialog
        isOpen={isLoginOpen}
        setIsOpen={setIsLoginOpen}
        currentUser={currentUser}
        onAuthChange={() => {
          fetchCurrentUser();
          fetchWaypoints();
        }}
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
          <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
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
                    {t('waypoints.confirmDeleteTitle') || 'Are you sure you want to delete this waypoint?'}
                  </DialogTitle>
                  <p className="mt-2 text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                    {t('waypoints.confirmDeleteDesc') ||
                      'This action cannot be undone. Associated chats will be unlinked from this space.'}
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
                      {isDeleting ? t('waypoints.deletingLabel') || 'Deleting...' : t('common.delete') || 'Delete'}
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

export default WaypointsPage;
