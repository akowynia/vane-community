'use client';

import React, { Fragment } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  deletingLabel?: string;
}

/**
 * Shared confirmation modal for single and bulk deletion actions.
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
  title,
  description,
  confirmLabel,
  cancelLabel,
  deletingLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {
          if (!isDeleting) onClose();
        }}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity" />
        </TransitionChild>

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
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-500 shrink-0 mt-0.5">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="text-base font-semibold text-black dark:text-stone-100">
                      {title}
                    </DialogTitle>
                    <p className="mt-2 text-xs text-black/65 dark:text-stone-400 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium rounded-xl text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#201b16] transition disabled:opacity-50"
                  >
                    {cancelLabel || t('common.cancel') || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onConfirm}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition active:scale-95 disabled:opacity-50"
                  >
                    {isDeleting && <Loader2 size={13} className="animate-spin" />}
                    <span>
                      {isDeleting
                        ? deletingLabel || t('bulkDelete.deleting') || 'Deleting...'
                        : confirmLabel || t('common.delete') || 'Delete'}
                    </span>
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default DeleteConfirmDialog;

