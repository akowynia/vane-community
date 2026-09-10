/* eslint-disable @next/next/no-img-element */
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { File } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Chunk } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

const MessageSources = ({ sources }: { sources: Chunk[] }) => {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeModal = () => {
    setIsDialogOpen(false);
    document.body.classList.remove('overflow-hidden-scrollable');
  };

  const openModal = () => {
    setIsDialogOpen(true);
    document.body.classList.add('overflow-hidden-scrollable');
  };

  const getUrl = (source: Chunk) => source?.metadata?.url || '';
  const getTitle = (source: Chunk) => source?.metadata?.title || 'Untitled';
  const formatDomain = (url: string) => {
    if (!url) return '';
    return url.replace(/.+\/\/|www.|\..+/g, '');
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {sources.slice(0, 3).map((source, i) => {
        const url = getUrl(source);
        const title = getTitle(source);
        const isFile = !url || url.includes('file_id://') || url === 'File' || !url.startsWith('http');

        const cardContent = (
          <>
            <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
              {title}
            </p>
            <div className="flex flex-row items-center justify-between">
              <div className="flex flex-row items-center space-x-1">
                {isFile ? (
                  <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                    <File size={12} className="text-white/70" />
                  </div>
                ) : (
                  <img
                    src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${encodeURIComponent(url)}`}
                    width={16}
                    height={16}
                    alt="favicon"
                    className="rounded-lg h-4 w-4"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                  {isFile ? t('chat.uploadedFile') : formatDomain(url)}
                </p>
              </div>
              <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
                <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
                <span>{i + 1}</span>
              </div>
            </div>
          </>
        );

        if (isFile) {
          return (
            <div
              className="bg-light-100 dark:bg-dark-100 rounded-lg p-3 flex flex-col space-y-2 font-medium cursor-default"
              key={i}
            >
              {cardContent}
            </div>
          );
        }

        return (
          <a
            className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {cardContent}
          </a>
        );
      })}
      {sources.length > 3 && (
        <button
          onClick={openModal}
          className="bg-light-100 hover:bg-light-200 dark:bg-dark-100 dark:hover:bg-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
        >
          <div className="flex flex-row items-center space-x-1">
            {sources.slice(3, 6).map((source, i) => {
              const url = getUrl(source);
              const isFile = url.includes('file_id://') || url === 'File';
              return isFile ? (
                <div
                  key={i}
                  className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full"
                >
                  <File size={12} className="text-white/70" />
                </div>
              ) : (
                <img
                  key={i}
                  src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${encodeURIComponent(url)}`}
                  width={16}
                  height={16}
                  alt="favicon"
                  className="rounded-lg h-4 w-4"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              );
            })}
          </div>
          <p className="text-xs text-black/50 dark:text-white/50">
            {t('chat.viewMoreSources', { count: sources.length - 3 })}
          </p>
        </button>
      )}
      <Transition appear show={isDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-200"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform rounded-2xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 p-6 text-left align-middle shadow-xl transition-all">
                  <DialogTitle className="text-lg font-medium leading-6 dark:text-white">
                    {t('chat.sources')}
                  </DialogTitle>
                  <div className="grid grid-cols-2 gap-2 overflow-auto max-h-[300px] mt-2 pr-2">
                    {sources.map((source, i) => {
                      const url = getUrl(source);
                      const title = getTitle(source);
                      const isFile = !url || url.includes('file_id://') || url === 'File' || !url.startsWith('http');

                      const modalItemContent = (
                        <>
                          <p className="dark:text-white text-xs overflow-hidden whitespace-nowrap text-ellipsis">
                            {title}
                          </p>
                          <div className="flex flex-row items-center justify-between">
                            <div className="flex flex-row items-center space-x-1">
                              {isFile ? (
                                <div className="bg-dark-200 hover:bg-dark-100 transition duration-200 flex items-center justify-center w-6 h-6 rounded-full">
                                  <File size={12} className="text-white/70" />
                                </div>
                              ) : (
                                <img
                                  src={`https://s2.googleusercontent.com/s2/favicons?domain_url=${encodeURIComponent(url)}`}
                                  width={16}
                                  height={16}
                                  alt="favicon"
                                  className="rounded-lg h-4 w-4"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              )}
                              <p className="text-xs text-black/50 dark:text-white/50 overflow-hidden whitespace-nowrap text-ellipsis">
                                {isFile ? t('chat.uploadedFile') : formatDomain(url)}
                              </p>
                            </div>
                            <div className="flex flex-row items-center space-x-1 text-black/50 dark:text-white/50 text-xs">
                              <div className="bg-black/50 dark:bg-white/50 h-[4px] w-[4px] rounded-full" />
                              <span>{i + 1}</span>
                            </div>
                          </div>
                        </>
                      );

                      if (isFile) {
                        return (
                          <div
                            className="bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 rounded-lg p-3 flex flex-col space-y-2 font-medium cursor-default"
                            key={i}
                          >
                            {modalItemContent}
                          </div>
                        );
                      }

                      return (
                        <a
                          className="bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary dark:hover:bg-dark-200 border border-light-200 dark:border-dark-200 transition duration-200 rounded-lg p-3 flex flex-col space-y-2 font-medium"
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {modalItemContent}
                        </a>
                      );
                    })}
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

export default MessageSources;
