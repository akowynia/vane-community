'use client';

import React, { Fragment, useState, useEffect } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { Loader2, Sparkles, X, TerminalSquare, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import WaypointIcon, { AVAILABLE_WAYPOINT_ICONS } from './WaypointIcon';

export interface WaypointItem {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  systemInstructions?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  chatsCount?: number;
  isPublic?: boolean;
  isOwner?: boolean;
  canEdit?: boolean;
}

interface CreateEditWaypointDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  waypoint?: WaypointItem | null;
  onSaved?: (waypoint: WaypointItem) => void;
  isAdmin?: boolean;
  onRequireLogin?: () => void;
}

const CreateEditWaypointDialog = ({
  isOpen,
  setIsOpen,
  waypoint,
  onSaved,
  isAdmin = false,
  onRequireLogin,
}: CreateEditWaypointDialogProps) => {
  const { t } = useTranslation();
  const isEditing = Boolean(waypoint?.id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Waypoints');
  const [systemInstructions, setSystemInstructions] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (waypoint) {
      setName(waypoint.name || '');
      setDescription(waypoint.description || '');
      setIcon(waypoint.icon || 'Waypoints');
      setSystemInstructions(waypoint.systemInstructions || '');
      setIsPublic(waypoint.userId === null);
    } else {
      setName('');
      setDescription('');
      setIcon('Waypoints');
      setSystemInstructions('');
      setIsPublic(false);
    }
  }, [waypoint, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t('waypoints.nameRequiredError') || 'Waypoint name is required.');
      return;
    }

    setLoading(true);
    try {
      const url = isEditing ? `/api/waypoints/${waypoint!.id}` : '/api/waypoints';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          icon: icon || 'Waypoints',
          systemInstructions: systemInstructions.trim() || '',
          isPublic: isAdmin ? isPublic : undefined,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          toast.error(t('waypoints.loginRequiredToCreateEdit') || 'Login is required to create or edit a space.');
          if (onRequireLogin) {
            setIsOpen(false);
            onRequireLogin();
          }
          return;
        }
        const errData = await res.json();
        throw new Error(errData?.message || t('waypoints.saveErrorFallback') || 'Failed to save the waypoint.');
      }

      const data = await res.json();
      toast.success(
        t('waypoints.saveSuccess') ||
          (isEditing ? 'Waypoint updated successfully.' : 'Waypoint created successfully.')
      );

      if (onSaved && data?.waypoint) {
        onSaved(data.waypoint);
      }
      setIsOpen(false);
    } catch (err: any) {
      console.error('Error saving waypoint:', err);
      toast.error(err?.message || t('waypoints.saveErrorFallback') || 'Failed to save the waypoint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          if (!loading) setIsOpen(false);
        }}
      >
        <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />

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
              <DialogPanel className="w-full max-w-xl transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#14110f] border border-light-200 dark:border-[#2e261e] p-6 text-left align-middle shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-light-200 dark:border-[#262019]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-[#b8864d]/25 to-[#b8864d]/10 border border-[#b8864d]/30 text-[#b8864d]">
                      <WaypointIcon name={icon} size={22} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-semibold text-black dark:text-stone-100">
                        {isEditing
                          ? t('waypoints.edit') || 'Edit Waypoint'
                          : t('waypoints.create') || 'New Waypoint'}
                      </DialogTitle>
                      <p className="text-xs text-black/60 dark:text-stone-400">
                        {t('waypoints.subtitle') ||
                          'Space with personalized system instructions (Masterprompt).'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={loading}
                    className="p-1 rounded-lg text-black/40 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#201b16] transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-black/80 dark:text-stone-300 mb-1">
                      {t('waypoints.name') || 'Space Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={
                        t('waypoints.namePlaceholder') ||
                        'e.g. TypeScript Expert, Market Research, SEO Copywriting'
                      }
                      className="w-full rounded-xl border border-light-200 dark:border-[#2e261e] bg-light-secondary/60 dark:bg-[#1b1714] px-3.5 py-2.5 text-sm text-black dark:text-stone-100 placeholder:text-black/40 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#b8864d]/70 transition"
                      disabled={loading}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-black/80 dark:text-stone-300 mb-1">
                      {t('waypoints.description') || 'Description (optional)'}
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        t('waypoints.descriptionPlaceholder') ||
                        'Short description of this space...'
                      }
                      className="w-full rounded-xl border border-light-200 dark:border-[#2e261e] bg-light-secondary/60 dark:bg-[#1b1714] px-3.5 py-2 text-sm text-black dark:text-stone-100 placeholder:text-black/40 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#b8864d]/70 transition"
                      disabled={loading}
                    />
                  </div>

                  {/* Icon Picker */}
                  <div>
                    <label className="block text-xs font-medium text-black/80 dark:text-stone-300 mb-1.5">
                      {t('waypoints.icon') || 'Space Icon'}
                    </label>
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 max-h-28 overflow-y-auto p-1.5 rounded-xl border border-light-200 dark:border-[#282119] bg-light-secondary/30 dark:bg-[#16120f]">
                      {AVAILABLE_WAYPOINT_ICONS.map((item) => {
                        const IconCmp = item.icon;
                        const isSelected = icon === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setIcon(item.id)}
                            title={t(`waypoints.icons.${item.id}`) || item.id}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-gradient-to-b from-[#b8864d]/30 to-[#b8864d]/10 border border-[#b8864d] text-[#b8864d] shadow-sm'
                                : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200 hover:bg-light-200/50 dark:hover:bg-[#221c17] border border-transparent'
                            }`}
                          >
                            <IconCmp size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Masterprompt (System Instructions) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-1.5 text-xs font-medium text-black/80 dark:text-stone-300">
                        <TerminalSquare size={14} className="text-[#b8864d]" />
                        <span>{t('waypoints.systemInstructions') || 'Masterprompt (System Instructions)'}</span>
                      </label>
                    </div>

                    <div className="relative">
                      <textarea
                        rows={5}
                        value={systemInstructions}
                        onChange={(e) => setSystemInstructions(e.target.value)}
                        placeholder={
                          t('waypoints.systemInstructionsPlaceholder') ||
                          'Enter system instructions that the AI model should always follow in this space...\ne.g. "Always respond concisely with explicit TypeScript types and JSDoc comments."'
                        }
                        className="w-full rounded-xl border border-light-200 dark:border-[#2e261e] bg-light-secondary/60 dark:bg-[#1b1714] p-3 text-xs sm:text-[13px] font-mono leading-relaxed text-black dark:text-stone-100 placeholder:text-black/40 dark:placeholder:text-stone-500 focus:outline-none focus:border-[#b8864d]/70 transition resize-y"
                        disabled={loading}
                      />
                    </div>

                    <div className="flex items-start gap-1.5 mt-1.5 text-[11px] text-black/55 dark:text-stone-400 leading-normal">
                      <Info size={13} className="shrink-0 text-[#b8864d] mt-0.5" />
                      <span>
                        {t('waypoints.systemInstructionsDesc') ||
                          'All queries sent in this waypoint will automatically follow these system instructions as a master rule.'}
                      </span>
                    </div>
                  </div>

                  {/* Public Space Switch (Visible for Administrators) */}
                  {isAdmin && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-light-secondary/60 dark:bg-[#1b1714] border border-light-200 dark:border-[#2e261e]">
                      <div>
                        <div className="text-xs font-semibold text-black dark:text-stone-200">
                          {t('waypoints.publicSpaceLabel') || 'Public space (shared)'}
                        </div>
                        <div className="text-[11px] text-black/50 dark:text-stone-400">
                          {t('waypoints.publicSpaceDesc') || 'Visible and accessible to all app users'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-[#b8864d] focus:ring-[#b8864d] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-light-200 dark:border-[#262019]">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      disabled={loading}
                      className="px-4 py-2 text-xs font-medium rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#201b16] transition"
                    >
                      {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !name.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-gradient-to-r from-[#b8864d] to-[#d4a373] text-[#0c0a09] hover:brightness-110 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {loading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                      <span>
                        {isEditing
                          ? t('common.save') || 'Save Changes'
                          : t('waypoints.create') || 'Create Waypoint'}
                      </span>
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

export default CreateEditWaypointDialog;
