'use client';

import React, { useEffect, useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Terminal,
  Edit2,
  Trash2,
  Search,
  MessageSquare,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Lock,
  ShieldAlert,
  Globe2,
  FileText,
} from 'lucide-react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import TextareaAutosize from 'react-textarea-autosize';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { formatTimeDifference } from '@/lib/utils';
import WaypointIcon from '@/components/Waypoints/WaypointIcon';
import CreateEditWaypointDialog, {
  WaypointItem,
} from '@/components/Waypoints/CreateEditWaypointDialog';
import DeleteChat from '@/components/DeleteChat';
import ModelSelector from '@/components/MessageInputActions/ChatModelSelector';
import Optimization from '@/components/MessageInputActions/Optimization';
import Sources from '@/components/MessageInputActions/Sources';
import Attach from '@/components/MessageInputActions/Attach';
import LoginDialog from '@/components/Auth/LoginDialog';
import { useChat } from '@/lib/hooks/useChat';
import CronList from '@/components/Crons/CronList';
import CreateEditCronDialog, { CronItem } from '@/components/Crons/CreateEditCronDialog';
import { Plus, Calendar } from 'lucide-react';

interface ExtendedWaypointItem extends WaypointItem {
  isPublic?: boolean;
  isOwner?: boolean;
  canEdit?: boolean;
}

const WaypointDetailPage = () => {
  const params = useParams();
  const waypointId = (params?.id as string) || '';

  const { t, locale } = useTranslation();
  const router = useRouter();
  const { setWaypointId } = useChat();

  const [waypoint, setWaypoint] = useState<ExtendedWaypointItem | null>(null);
  const [chats, setChats] = useState<any[]>([]);
  const [crons, setCrons] = useState<CronItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCrons, setLoadingCrons] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'crons'>('chats');
  const [isCreateCronOpen, setIsCreateCronOpen] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-user & auth state
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: string;
    displayName?: string | null;
  } | null>(null);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // New query in space
  const [query, setQuery] = useState('');

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

  const fetchCrons = async () => {
    if (!waypointId) return;
    setLoadingCrons(true);
    try {
      const res = await fetch(`/api/crons?waypointId=${encodeURIComponent(waypointId)}`);
      if (res.ok) {
        const data = await res.json();
        setCrons(Array.isArray(data.crons) ? data.crons : []);
      } else {
        setCrons([]);
      }
    } catch (err) {
      console.error('Error fetching crons for waypoint:', err);
    } finally {
      setLoadingCrons(false);
    }
  };

  const fetchWaypointDetails = async () => {
    setLoading(true);
    setErrorStatus(null);
    try {
      const res = await fetch(`/api/waypoints/${waypointId}`);
      if (res.ok) {
        const data = await res.json();
        const wpData = data.waypoint || null;
        setWaypoint(wpData);
        if (wpData) {
          setWaypointId(wpData.id, wpData);
        }
        setChats(Array.isArray(data.chats) ? data.chats : []);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorStatus(res.status);
        setErrorMessage(errData?.message || '');
        if (res.status === 404) {
          toast.error(t('waypoints.notFoundToast') || 'Space not found.');
        } else if (res.status === 401) {
          toast.error(t('waypoints.loginRequiredToast') || 'Login is required for this space.');
        } else if (res.status === 403) {
          toast.error(t('waypoints.noPermissionToast') || 'No permission for this private space.');
        }
      }
    } catch (err) {
      console.error('Error fetching waypoint:', err);
      toast.error(t('waypoints.loadErrorToast') || 'An error occurred while loading the waypoint.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    if (waypointId) {
      fetchWaypointDetails();
      fetchCrons();
    }
  }, [waypointId]);

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const trimmed = query.trim();
    setQuery('');
    setWaypointId(waypointId, waypoint);
    router.push(`/?waypoint=${encodeURIComponent(waypointId)}&q=${encodeURIComponent(trimmed)}`);
  };

  const handleDeleteWaypoint = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/waypoints/${waypointId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('waypoints.deleteSuccess') || 'Waypoint deleted successfully.');
        router.push('/waypoints');
      } else {
        const err = await res.json();
        throw new Error(err?.message || t('waypoints.deleteErrorGeneric') || 'Error deleting');
      }
    } catch (err: any) {
      toast.error(err?.message || t('waypoints.deleteErrorFallback') || 'Failed to delete the waypoint.');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const filteredChats = chats.filter((c) => {
    const q = chatSearch.toLowerCase().trim();
    if (!q) return true;
    return c.title && c.title.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-10 h-10 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-xs text-black/60 dark:text-stone-400">
          {t('waypoints.loadingDetails') || 'Loading space details...'}
        </p>
      </div>
    );
  }

  // Handle unauthenticated private space (401)
  if (errorStatus === 401) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-4 rounded-3xl bg-[#b8864d]/10 border border-[#b8864d]/30 text-[#b8864d] inline-flex mb-4">
          <Lock size={36} />
        </div>
        <h2 className="text-xl font-bold text-black dark:text-stone-100 mb-2">
          {t('waypoints.loginRequiredTitle') || 'This space requires login'}
        </h2>
        <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mb-6 leading-relaxed">
          {errorMessage ||
            t('waypoints.loginRequiredDesc') ||
            'This space is private. Log in to your account to access its settings and threads.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/waypoints"
            className="px-4 py-2 rounded-xl border border-light-200 dark:border-[#2e261e] text-xs font-medium text-black/70 dark:text-stone-300 hover:bg-light-200 dark:hover:bg-[#1e1915] transition"
          >
            {t('waypoints.backToList') || 'Back to list'}
          </Link>
          <button
            onClick={() => setIsLoginOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 transition shadow-sm"
          >
            {t('auth.login') || 'Log In'}
          </button>
        </div>
        <LoginDialog
          isOpen={isLoginOpen}
          setIsOpen={setIsLoginOpen}
          currentUser={currentUser}
          onAuthChange={() => {
            fetchCurrentUser();
            fetchWaypointDetails();
          }}
        />
      </div>
    );
  }

  // Handle forbidden private space (403)
  if (errorStatus === 403) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-4 rounded-3xl bg-red-500/10 border border-red-500/30 text-red-500 inline-flex mb-4">
          <ShieldAlert size={36} />
        </div>
        <h2 className="text-xl font-bold text-black dark:text-stone-100 mb-2">
          {t('waypoints.noPermissionTitle') || 'No permission'}
        </h2>
        <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mb-6 leading-relaxed">
          {errorMessage ||
            t('waypoints.noPermissionDesc') ||
            "This space belongs to another user. You don't have permission to view it."}
        </p>
        <Link
          href="/waypoints"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 transition shadow-sm"
        >
          <ArrowLeft size={14} />
          <span>{t('waypoints.backToListOfSpaces') || 'Back to spaces list'}</span>
        </Link>
      </div>
    );
  }

  // Handle not found (404) or missing waypoint
  if (errorStatus === 404 || !waypoint) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="p-4 rounded-3xl bg-light-200 dark:bg-[#1e1915] text-[#b8864d] inline-flex mb-4">
          <Info size={36} />
        </div>
        <h2 className="text-xl font-bold text-black dark:text-stone-100 mb-2">
          {t('waypoints.notFoundTitle') || 'Space not found'}
        </h2>
        <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mb-6 leading-relaxed">
          {t('waypoints.notFoundDesc') ||
            "The selected Waypoint space doesn't exist or has been deleted."}
        </p>
        <Link
          href="/waypoints"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 transition shadow-sm"
        >
          <ArrowLeft size={14} />
          <span>{t('waypoints.backToListOfSpaces') || 'Back to spaces list'}</span>
        </Link>
      </div>
    );
  }

  const hasMasterprompt = Boolean(waypoint.systemInstructions && waypoint.systemInstructions.trim());
  const isGuest = instanceMode === 'multi' && !currentUser;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
      {/* Breadcrumb / Back button */}
      <div>
        <Link
          href="/waypoints"
          className="inline-flex items-center gap-2 text-xs font-medium text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 transition group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>{t('waypoints.backToWaypoints') || 'Back to waypoints'}</span>
        </Link>
      </div>

      {/* Main Space Header Card */}
      <div className="p-6 sm:p-7 rounded-3xl border border-light-200 dark:border-[#282119] bg-light-primary dark:bg-[#14110e] shadow-lg shadow-black/10 dark:shadow-black/30">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#b8864d]/30 to-[#b8864d]/10 border border-[#b8864d]/40 text-[#b8864d] shadow-sm shrink-0">
              <WaypointIcon name={waypoint.icon} size={30} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-stone-100">
                  {waypoint.name}
                </h1>
                {waypoint.isPublic ? (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/15 text-blue-500 border border-blue-500/30">
                    {t('waypoints.sharedSpaceBadge') || 'Shared space'}
                  </span>
                ) : (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/30">
                    {t('waypoints.privateSpaceBadge') || 'Private space'}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mt-1.5 leading-relaxed max-w-2xl">
                {waypoint.description || t('waypoints.noAdditionalDescription') || 'No additional description for this space.'}
              </p>
            </div>
          </div>

          {/* Action buttons (only for owners or administrators) */}
          {(waypoint.canEdit || waypoint.isOwner) && (
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
              <button
                onClick={() => setIsEditDialogOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-light-200 dark:border-[#2f271f] bg-light-secondary/60 dark:bg-[#1b1714] text-black/70 dark:text-stone-300 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#25201b] transition"
              >
                <Edit2 size={14} />
                <span>{t('waypoints.edit') || 'Edit waypoint'}</span>
              </button>
              <button
                onClick={() => setDeleteDialogOpen(true)}
                className="p-2 rounded-xl text-black/50 dark:text-stone-400 hover:text-red-500 hover:bg-red-500/10 border border-light-200 dark:border-[#2f271f] transition"
                title={t('common.delete') || 'Delete'}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Masterprompt (System Instructions) Section */}
        <div className="mt-6 pt-5 border-t border-light-200/60 dark:border-[#241e17]">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#b8864d]">
              <Terminal size={15} />
              <span>{t('waypoints.systemInstructions') || 'Masterprompt (System Instructions)'}</span>
            </div>
            <button
              onClick={() => setIsPromptExpanded(!isPromptExpanded)}
              className="flex items-center gap-1 text-[11px] text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-200 transition"
            >
              <span>
                {isPromptExpanded
                  ? t('waypoints.collapseLabel') || 'Collapse'
                  : t('waypoints.expandLabel') || 'Expand'}
              </span>
              {isPromptExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {isPromptExpanded && (
            <div className="p-4 rounded-2xl bg-light-secondary/80 dark:bg-[#0d0b0a] border border-light-200 dark:border-[#261f18] text-xs font-mono leading-relaxed text-black/85 dark:text-stone-200 transition-all">
              {hasMasterprompt ? (
                <div className="whitespace-pre-wrap max-h-56 overflow-y-auto pr-2">
                  {waypoint.systemInstructions}
                </div>
              ) : (
                <div className="flex items-center justify-between text-black/50 dark:text-stone-500 italic py-1">
                  <span>
                    {t('waypoints.noMasterpromptDefinedHint') ||
                      'No dedicated masterprompt defined. Click "Edit" to add system instructions.'}
                  </span>
                  {(waypoint.canEdit || waypoint.isOwner) && (
                    <button
                      onClick={() => setIsEditDialogOpen(true)}
                      className="text-[#b8864d] not-italic font-sans font-medium text-xs hover:underline"
                    >
                      {t('waypoints.addMasterpromptAction') || 'Add masterprompt'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Space Content Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-light-200/60 dark:border-[#221c16] pb-3">
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

      {/* Tab: Chats & Direct Query Input */}
      {activeTab === 'chats' && (
        <div className="space-y-7">
          {/* Input to Ask Question directly in this Waypoint */}
          <form
            onSubmit={handleStartChat}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleStartChat(e);
              }
            }}
            className="w-full"
          >
            <div className="flex flex-col bg-light-secondary/90 dark:bg-[#181513]/90 backdrop-blur-md px-4 pt-4 pb-3 rounded-2xl w-full border border-light-200 dark:border-[#2e2720] shadow-xl shadow-black/25 transition-all duration-200 focus-within:border-light-300 dark:focus-within:border-[#b8864d]/60 dark:focus-within:ring-1 dark:focus-within:ring-[#b8864d]/30">
              <div className="flex flex-row items-start space-x-2.5">
                <Search className="w-5 h-5 mt-1 text-black/40 dark:text-stone-400 shrink-0" />
                <TextareaAutosize
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  minRows={2}
                  className="px-1 py-0.5 bg-transparent placeholder:text-[15px] placeholder:text-black/50 dark:placeholder:text-stone-500 text-sm text-black dark:text-stone-100 resize-none focus:outline-none w-full max-h-24 lg:max-h-36 xl:max-h-48"
                  placeholder={
                    t('waypoints.askInSpacePlaceholder', { name: waypoint.name }) ||
                    `Ask a question in "${waypoint.name}" (uses the active masterprompt)...`
                  }
                />
              </div>
              <div className="flex flex-row items-center justify-between mt-3 pt-2 border-t border-light-200/50 dark:border-[#28221b]/70">
                <Optimization align="left" />
                <div className="flex flex-row items-center space-x-2">
                  <div className="flex flex-row items-center space-x-1">
                    <Sources />
                    <ModelSelector />
                    <Attach />
                  </div>
                  <button
                    type="submit"
                    disabled={query.trim().length === 0}
                    className="bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium disabled:opacity-30 disabled:bg-none disabled:bg-[#e0e0dc] dark:disabled:bg-[#25201a] dark:disabled:text-stone-600 hover:brightness-110 active:scale-95 transition-all duration-200 rounded-full p-2"
                  >
                    <ArrowRight size={17} />
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Chats / Threads in this Space */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-light-200/50 dark:border-[#221c16]">
              <div className="flex items-center gap-2">
                <MessageSquare size={17} className="text-[#b8864d]" />
                <h2 className="text-lg font-semibold text-black dark:text-stone-100">
                  {t('common.chats') || 'Chats in this space'}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-light-200 dark:bg-[#221c16] text-black/60 dark:text-stone-400 font-medium">
                  {chats.length}
                </span>
              </div>

              {chats.length > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-stone-500"
                  />
                  <input
                    type="text"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder={t('waypoints.searchChats') || 'Search chats in this space...'}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-light-200 dark:border-[#282119] bg-light-primary dark:bg-[#14110e] text-xs text-black dark:text-stone-200 placeholder:text-black/40 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#b8864d]/60 transition"
                  />
                </div>
              )}
            </div>

            {/* Chats List */}
            {chats.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-light-300 dark:border-[#282018] bg-light-secondary/30 dark:bg-[#110e0c]/40">
                <MessageSquare size={32} className="mx-auto text-black/30 dark:text-stone-600 mb-2" />
                <h3 className="text-sm font-semibold text-black dark:text-stone-200 mb-1">
                  {t('waypoints.emptyChatsTitle') || 'No chats in this space yet'}
                </h3>
                <p className="text-xs text-black/60 dark:text-stone-400 max-w-sm mx-auto">
                  {t('waypoints.emptyChatsDesc') ||
                    'Type your first query above to start researching with your custom masterprompt.'}
                </p>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-10 text-xs text-black/50 dark:text-stone-400">
                {t('waypoints.noChatsMatchingQuery', { query: chatSearch }) ||
                  `No chats matching "${chatSearch}".`}
              </div>
            ) : (
              <div className="rounded-2xl border border-light-200 dark:border-[#251f19] overflow-hidden bg-light-primary dark:bg-[#14110e]">
                {filteredChats.map((chat, index) => {
                  const safeSources = Array.isArray(chat?.sources) ? chat.sources : [];
                  const safeFiles = Array.isArray(chat?.files) ? chat.files : [];

                  return (
                    <div
                      key={chat.id}
                      className={`group flex items-center justify-between gap-4 p-4 hover:bg-light-secondary dark:hover:bg-[#1a1612] transition-colors duration-200 ${
                        index !== filteredChats.length - 1 ? 'border-b border-light-200 dark:border-[#221c16]' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/c/${chat.id}`}
                          className="text-sm sm:text-base font-medium text-black dark:text-stone-100 group-hover:text-[#b8864d] transition line-clamp-1 block"
                          title={chat.title || t('waypoints.untitledChat') || 'Untitled'}
                        >
                          {chat.title || t('waypoints.untitledChat') || 'Untitled'}
                        </Link>

                        <div className="flex flex-wrap items-center gap-2.5 mt-1 text-[11px] text-black/55 dark:text-stone-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {chat.createdAt ? formatTimeDifference(new Date(), chat.createdAt, locale) : ''}
                          </span>

                          {safeSources.length > 0 && (
                            <span className="inline-flex items-center gap-1 border border-light-200 dark:border-[#2c241c] rounded-full px-2 py-0.5">
                              <Globe2 size={12} />
                              {safeSources.length}{' '}
                              {safeSources.length === 1
                                ? t('waypoints.sourceSingular') || 'source'
                                : t('waypoints.sourcePlural') || 'sources'}
                            </span>
                          )}

                          {safeFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 border border-light-200 dark:border-[#2c241c] rounded-full px-2 py-0.5">
                              <FileText size={12} />
                              {safeFiles.length}{' '}
                              {safeFiles.length === 1
                                ? t('waypoints.fileSingular') || 'file'
                                : t('waypoints.filePlural') || 'files'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Link
                          href={`/c/${chat.id}`}
                          className="p-1.5 rounded-lg text-black/40 dark:text-stone-500 hover:text-[#b8864d] hover:bg-light-200 dark:hover:bg-[#221c16] transition"
                          title={t('crons.openChatAction') || 'Open chat'}
                        >
                          <ArrowRight size={16} />
                        </Link>
                        <DeleteChat
                          chatId={chat.id}
                          chats={chats}
                          setChats={setChats}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Scheduled Cron Tasks in this Space */}
      {activeTab === 'crons' && (
        <div className="space-y-4 pt-1">
          {isGuest ? (
            <div className="flex flex-col items-center justify-center min-h-[40vh] px-4 text-center py-12">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl border border-[#b8864d]/30 bg-[#b8864d]/10 text-[#b8864d] shadow-sm mb-4">
                <Clock size={28} />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-black dark:text-stone-100">
                {t('waypoints.cronsLoginRequiredTitle') || 'Schedules require login'}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-black/60 dark:text-stone-400 max-w-md leading-relaxed">
                {t('waypoints.cronsLoginRequiredDesc') ||
                  'Log in to create and manage recurring tasks linked to this space.'}
              </p>
              <button
                type="button"
                onClick={() => setIsLoginOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs sm:text-sm hover:brightness-110 active:scale-95 transition shadow-sm"
              >
                <span>{t('auth.login') || 'Log In'}</span>
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 pb-2 border-b border-light-200/50 dark:border-[#221c16]">
                <div>
                  <h2 className="text-lg font-semibold text-black dark:text-stone-100">
                    {t('crons.title') || 'Schedules (Crons)'}
                  </h2>
                  <p className="text-xs text-black/60 dark:text-stone-400 mt-0.5">
                    {t('waypoints.cronsTabDesc') ||
                      "Recurring queries executed automatically using this space's active Masterprompt."}
                  </p>
                </div>

                <button
                  onClick={() => setIsCreateCronOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] font-medium text-xs hover:brightness-110 active:scale-95 transition shadow-sm shrink-0"
                >
                  <Plus size={15} />
                  <span>{t('crons.create') || 'New schedule'}</span>
                </button>
              </div>

              {loadingCrons ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-[#b8864d] border-t-transparent rounded-full animate-spin" />
                  <p className="mt-3 text-xs text-black/60 dark:text-stone-400">
                    {t('waypoints.loadingSchedules') || 'Loading schedules...'}
                  </p>
                </div>
              ) : (
                <CronList
                  crons={crons}
                  onCronsChange={setCrons}
                  fixedWaypointId={waypointId}
                  onRequireLogin={() => setIsLoginOpen(true)}
                  onCreateNew={() => setIsCreateCronOpen(true)}
                  showWaypointBadge={false}
                  emptyTitle={t('waypoints.noSchedulesInSpaceTitle') || 'No schedules in this space'}
                  emptyDesc={
                    t('waypoints.noSchedulesInSpaceDesc') ||
                    'Add a recurring task, and the AI model will regularly research this topic and create threads in this space.'
                  }
                />
              )}

              {/* Dialog to create new cron in this waypoint */}
              <CreateEditCronDialog
                isOpen={isCreateCronOpen}
                setIsOpen={setIsCreateCronOpen}
                fixedWaypointId={waypointId}
                onSaved={(newCron) => setCrons([newCron, ...crons])}
                onRequireLogin={() => setIsLoginOpen(true)}
              />
            </>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <CreateEditWaypointDialog
        isOpen={isEditDialogOpen}
        setIsOpen={setIsEditDialogOpen}
        waypoint={waypoint}
        onSaved={(updated) => setWaypoint(updated)}
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
          fetchWaypointDetails();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Transition appear show={deleteDialogOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (!isDeleting) setDeleteDialogOpen(false);
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
                      onClick={() => setDeleteDialogOpen(false)}
                      className="px-4 py-2 text-xs font-medium rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#201b16] transition"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteWaypoint}
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

export default WaypointDetailPage;
