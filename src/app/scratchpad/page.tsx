'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  NotebookPen,
  Plus,
  Search,
  Clock,
  Trash2,
  FileText,
  Sparkles,
  Layers,
  ArrowRight,
  Folder,
  History,
  Presentation,
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
import ScratchpadTemplateDialog, {
  ScratchpadTemplate,
} from '@/components/Scratchpad/ScratchpadTemplateDialog';
import CreatePresentationDialog, {
  CreatePresentationConfig,
} from '@/components/Presentation/CreatePresentationDialog';
import LoginDialog from '@/components/Auth/LoginDialog';

interface ScratchpadListItem {
  id: string;
  title: string;
  excerpt: string;
  type?: 'note' | 'presentation';
  metadata?: any;
  userId?: string | null;
  waypointId?: string | null;
  templateId?: string | null;
  sourcesCount: number;
  versionsCount: number;
  messagesCount: number;
  createdAt: string;
  updatedAt: string;
}

const ScratchpadListPage = () => {
  const { t, locale } = useTranslation();
  const router = useRouter();

  const [items, setItems] = useState<ScratchpadListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isCreatePresentationOpen, setIsCreatePresentationOpen] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<ScratchpadListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-user & auth state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user || null);
        if (data.instanceMode) setInstanceMode(data.instanceMode);
      }
    } catch {
      setCurrentUser(null);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scratchpad');
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.scratchpads) ? data.scratchpads : []);
      }
    } catch (err) {
      console.error('Failed to fetch scratchpads:', err);
      toast.error(t('scratchpad.noSketchesFound') || 'Failed to fetch the list of notes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchItems();
  }, []);

  const handleOpenCreate = () => {
    if (instanceMode === 'multi' && !currentUser) {
      toast.error(t('apiAccess.loginRequiredDesc') || 'Creating notes requires logging in.');
      setIsLoginOpen(true);
      return;
    }
    setIsTemplateDialogOpen(true);
  };

  const handleOpenCreatePresentation = () => {
    if (instanceMode === 'multi' && !currentUser) {
      toast.error(t('apiAccess.loginRequiredDesc') || 'Creating presentations requires logging in.');
      setIsLoginOpen(true);
      return;
    }
    setIsCreatePresentationOpen(true);
  };

  const handleCreatePresentation = async (config: CreatePresentationConfig) => {
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: config.title || config.topic,
          content: '',
          type: 'presentation',
          metadata: config,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/scratchpad/${data.scratchpad.id}?autoPrompt=${encodeURIComponent(config.topic)}`);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to create the presentation.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while creating the presentation.');
    }
  };

  const handleSelectTemplateAndCreate = async (template: ScratchpadTemplate | null) => {
    setIsTemplateDialogOpen(false);
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template ? template.name : (t('scratchpad.newSketch') || 'New note'),
          content: template ? template.content : '',
          type: 'note',
          templateId: template?.id || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/scratchpad/${data.scratchpad.id}`);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to create the note.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error while creating the note.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/scratchpad/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('scratchpad.deleteSuccess') || 'Note was deleted.');
        setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to delete the note.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An error occurred while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.excerpt.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col min-h-screen bg-light-primary dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100">
      {/* Header Banner */}
      <div className="border-b border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#14100d]/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-[#b8864d]/20 to-[#b8864d]/10 border border-[#b8864d]/30 text-[#b8864d] shadow-sm">
              <NotebookPen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                <span>{t('scratchpad.title') || 'Scratchpad'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#b8864d]/15 text-[#b8864d] font-semibold tracking-wider">
                  CANVAS
                </span>
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {t('scratchpad.subtitle') || 'Interactive live notes workspace with AI Copilot and web research'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleOpenCreatePresentation}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-semibold text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/20"
            >
              <Presentation className="w-4 h-4" />
              <span>{t('presentation.newPresentation') || 'New Presentation'}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-stone-950/15 text-stone-950 font-bold tracking-wider">
                BETA
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-stone-950 font-semibold text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-[#b8864d]/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t('scratchpad.newSketch') || 'New note'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 flex flex-col">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('scratchpad.searchPlaceholder') || 'Search notes and drafts...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-light-200 dark:border-[#26201a] bg-light-secondary dark:bg-[#16120f] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-[#b8864d] transition"
          />
        </div>

        {/* Content List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="h-44 rounded-2xl bg-light-secondary/60 dark:bg-[#181411]/60 border border-light-200 dark:border-[#221c16] animate-pulse p-5"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-3xl border border-dashed border-light-300 dark:border-[#2a241d] bg-light-secondary/20 dark:bg-[#14100d]/20">
            <div className="p-4 rounded-3xl bg-[#b8864d]/10 text-[#b8864d] mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200">
              {t('scratchpad.noSketchesFound') || 'No notes found'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mt-1 mb-6">
              {t('scratchpad.noSketchesDesc') || 'Create notes, structure research, and collaborate with AI in real time.'}
            </p>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleOpenCreatePresentation}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 font-semibold text-xs hover:brightness-110 active:scale-95 transition shadow-lg shadow-amber-500/20"
              >
                <Presentation className="w-4 h-4" />
                <span>{t('presentation.newPresentation') || 'New Presentation'}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-stone-950/15 text-stone-950 font-bold tracking-wider">
                  BETA
                </span>
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#b8864d] text-stone-950 font-semibold text-xs hover:brightness-110 active:scale-95 transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t('scratchpad.createFirst') || 'Create your first note'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const isPres = item.type === 'presentation';
              return (
                <div
                  key={item.id}
                  onClick={() => router.push(`/scratchpad/${item.id}`)}
                  className={`group relative flex flex-col justify-between p-5 rounded-2xl bg-light-secondary dark:bg-[#16120f] border transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-black/20 ${
                    isPres
                      ? 'border-amber-500/30 hover:border-amber-500/70 hover:bg-amber-500/[0.02]'
                      : 'border-light-200 dark:border-[#241e18] hover:border-[#b8864d]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-1.5">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        {isPres ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-bold tracking-wider uppercase flex items-center space-x-1 shrink-0">
                            <Presentation className="w-2.5 h-2.5" />
                            <span>{t('presentation.badgePresentation') || 'PRESENTATION'}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-[#b8864d]/15 text-[#b8864d] text-[10px] font-semibold tracking-wider uppercase shrink-0">
                            {t('scratchpad.note') || 'Note'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(item);
                        }}
                        title={t('scratchpad.deleteSketchTitle') || 'Delete note'}
                        className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className={`text-sm font-semibold text-stone-900 dark:text-stone-100 transition line-clamp-1 mb-1.5 ${
                      isPres ? 'group-hover:text-amber-500' : 'group-hover:text-[#b8864d]'
                    }`}>
                      {item.title || t('scratchpad.untitled') || 'Untitled'}
                    </h3>

                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-3 leading-relaxed mb-4">
                      {item.excerpt || `(${t('scratchpad.blankSketch') || 'Blank note'})`}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-light-200/50 dark:border-[#221c16] flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeDifference(item.updatedAt, locale)}</span>
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {item.versionsCount > 1 && (
                        <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-mono text-[10px]">
                          v{item.versionsCount}
                        </span>
                      )}
                      {item.sourcesCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-medium text-[10px]">
                          {item.sourcesCount} {t('common.sources') || 'sources'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Presentation Creation Dialog */}
      <CreatePresentationDialog
        isOpen={isCreatePresentationOpen}
        onClose={() => setIsCreatePresentationOpen(false)}
        onSubmit={handleCreatePresentation}
      />

      {/* Template Chooser Modal */}
      <ScratchpadTemplateDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        onSelectTemplate={handleSelectTemplateAndCreate}
      />

      {/* Delete Confirmation Modal */}
      <Transition show={Boolean(deleteTarget)} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDeleteTarget(null)}>
          <TransitionChild
            as={React.Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
          </TransitionChild>

          <div className="fixed inset-0 z-10 overflow-y-auto p-4 flex items-center justify-center">
            <TransitionChild
              as={React.Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#120f0d] border border-light-200 dark:border-[#2a241d] p-6 text-left shadow-2xl transition-all w-full max-w-md">
                <DialogTitle as="h3" className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2">
                  {t('scratchpad.deleteSketchTitle') || 'Delete note'}
                </DialogTitle>
                <p className="text-xs text-stone-500 dark:text-stone-400 mb-6">
                  {t('scratchpad.deleteSketchConfirm') || 'Are you sure you want to delete this note, including its version history and chat?'}
                </p>

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-stone-500 hover:text-stone-700 transition"
                  >
                    {t('common.cancel') || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDelete}
                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition disabled:opacity-50"
                  >
                    {isDeleting ? t('common.loading') || 'Deleting...' : t('common.delete') || 'Delete'}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <LoginDialog
        isOpen={isLoginOpen}
        setIsOpen={setIsLoginOpen}
        currentUser={currentUser}
        onAuthChange={() => {
          fetchCurrentUser();
          fetchItems();
        }}
      />
    </div>
  );
};

export default ScratchpadListPage;
