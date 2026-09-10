'use client';

import { ChevronDown, Cpu, Loader2, Repeat, Search } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { MinimalProvider } from '@/lib/models/types';
import { useChat } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

interface RewriteProps {
  rewrite: (
    messageId: string,
    modelOverride?: { key: string; providerId: string },
  ) => void;
  messageId: string;
}

const Rewrite = ({ rewrite, messageId }: RewriteProps) => {
  const { t } = useTranslation();
  const { chatModelProvider } = useChat();

  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadProviders = async () => {
    if (providers.length > 0) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data: { providers: MinimalProvider[] } = await res.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to load providers in Rewrite:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectModel = (
    providerId: string,
    modelKey: string,
    close: () => void,
  ) => {
    close();
    rewrite(messageId, { providerId, key: modelKey });
  };

  const filteredProviders = providers
    .map((provider) => ({
      ...provider,
      chatModels: (provider?.chatModels || [])
        .filter((model) => model && model.key && model.key !== 'error')
        .filter(
          (model) =>
            (model.name || model.key)
              .toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            (provider.name || '')
              .toLowerCase()
              .includes(searchQuery.toLowerCase()),
        ),
    }))
    .filter((provider) => provider.chatModels.length > 0);

  return (
    <div className="relative inline-flex items-center rounded-lg hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-150">
      {/* Quick rewrite button using the current model */}
      <button
        type="button"
        title={`${t('chat.rewrite') || 'Rewrite'} (${chatModelProvider?.key || t('chat.currentModel') || 'Current model'})`}
        onClick={() => rewrite(messageId)}
        className="p-2 text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white transition duration-150 flex items-center"
      >
        <Repeat size={16} />
      </button>

      {/* Select a different model to rewrite with */}
      <Popover className="relative">
        {({ open, close }) => (
          <>
            <PopoverButton
              type="button"
              onClick={loadProviders}
              title={t('chat.selectModel') || 'Select model'}
              className="p-1 -ml-1 pr-1.5 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white focus:outline-none transition duration-150"
            >
              <ChevronDown
                size={13}
                className={cn(
                  open ? 'rotate-180' : 'rotate-0',
                  'transition-transform duration-200',
                )}
              />
            </PopoverButton>

            <AnimatePresence>
              {open && (
                <PopoverPanel
                  static
                  className="absolute z-[60] w-[260px] sm:w-[300px] left-0 bottom-full mb-2"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="origin-bottom-left bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-2xl p-2 max-h-[320px] overflow-hidden flex flex-col"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-light-200/60 dark:border-dark-200/60 px-1">
                      <span className="text-xs font-semibold text-black/80 dark:text-stone-200">
                        {t('chat.rewriteWithModel') || 'Rewrite with model:'}
                      </span>
                    </div>

                    <div className="relative mb-2">
                      <Search
                        size={14}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
                      />
                      <input
                        type="text"
                        placeholder={t('chat.searchModels') || 'Search models...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 bg-light-secondary dark:bg-dark-secondary rounded-lg text-xs text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none border border-transparent focus:border-[#b8864d]/50 transition"
                      />
                    </div>

                    <div className="overflow-y-auto max-h-[200px] space-y-2 pr-1">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2
                            size={18}
                            className="animate-spin text-black/40 dark:text-white/40"
                          />
                        </div>
                      ) : filteredProviders.length === 0 ? (
                        <div className="text-center py-6 text-xs text-black/50 dark:text-white/50">
                          {t('chat.noModelsFound') || 'No models found'}
                        </div>
                      ) : (
                        filteredProviders.map((provider) => (
                          <div key={provider.id} className="space-y-1">
                            <p className="text-[10px] uppercase font-semibold text-black/40 dark:text-stone-400 px-1">
                              {provider.name}
                            </p>
                            <div className="space-y-0.5">
                              {provider.chatModels.map((model) => {
                                const isCurrent =
                                  chatModelProvider?.providerId ===
                                    provider.id &&
                                  chatModelProvider?.key === model.key;

                                return (
                                  <button
                                    key={model.key}
                                    type="button"
                                    onClick={() =>
                                      handleSelectModel(
                                        provider.id,
                                        model.key,
                                        close,
                                      )
                                    }
                                    className={cn(
                                      'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition duration-150 text-left',
                                      isCurrent
                                        ? 'bg-[#b8864d]/15 text-[#f3d5ab] font-medium'
                                        : 'text-black/80 dark:text-stone-300 hover:bg-light-secondary dark:hover:bg-dark-secondary',
                                    )}
                                  >
                                    <span className="truncate flex-1">
                                      {model.name || model.key}
                                    </span>
                                    {isCurrent && (
                                      <span className="text-[10px] text-[#b8864d] ml-1 flex-shrink-0">
                                        ({t('chat.current') || 'current'})
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                </PopoverPanel>
              )}
            </AnimatePresence>
          </>
        )}
      </Popover>
    </div>
  );
};

export default Rewrite;
