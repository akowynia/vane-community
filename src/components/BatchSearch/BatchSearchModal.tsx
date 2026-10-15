'use client';

import React, { useState, useEffect, Fragment } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import BatchSearchWorkspace from './BatchSearchWorkspace';
import { useBatchSearch } from '@/lib/batch-search/context';

interface BatchSearchModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const BatchSearchModal: React.FC<BatchSearchModalProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}) => {
  const { isModalOpen, openModal, closeModal } = useBatchSearch();

  const isControlled = typeof controlledIsOpen === 'boolean';
  const open = isControlled ? controlledIsOpen : isModalOpen;

  const handleClose = () => {
    if (isControlled && controlledOnClose) {
      controlledOnClose();
    } else {
      closeModal();
    }
  };

  useEffect(() => {
    const handleOpenBatchSearch = () => {
      openModal();
    };

    window.addEventListener('open-batch-search', handleOpenBatchSearch);
    return () => {
      window.removeEventListener('open-batch-search', handleOpenBatchSearch);
    };
  }, [openModal]);

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[90]" onClose={handleClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-black/75 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-3 sm:p-5 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-250"
              enterFrom="opacity-0 scale-95 translate-y-3"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-3"
            >
              <DialogPanel className="w-full max-w-6xl h-[88vh] transform overflow-hidden rounded-2xl bg-light-primary dark:bg-[#0c0a09] border border-light-200 dark:border-[#251d16] text-left align-middle shadow-2xl transition-all flex flex-col">
                <BatchSearchWorkspace onClose={handleClose} isModal={true} />
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default BatchSearchModal;
