'use client';

import { Cpu, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { useEffect, useMemo, useState } from 'react';
import { MinimalProvider } from '@/lib/models/types';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from '@/lib/i18n';

interface ModelSelectorProps {
  position?: 'top' | 'bottom';
  align?: 'left' | 'right';
}

const ModelSelector = ({
  position = 'bottom',
  align = 'right',
}: ModelSelectorProps) => {
  const [providers, setProviders] = useState<MinimalProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [usageStats, setUsageStats] = useState<{
    tokensLast5h: number;
    tokensWeekly: number;
    tokenLimit5h?: number | null;
    tokenLimitWeekly?: number | null;
  } | null>(null);
  const { t } = useTranslation();

  const { setChatModelProvider, chatModelProvider } = useChat();

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true);
        const [res, meRes] = await Promise.all([
          fetch('/api/providers'),
          fetch('/api/auth/me').catch(() => null),
        ]);

        if (!res.ok) {
          throw new Error('Failed to fetch providers');
        }

        const data: { providers: MinimalProvider[] } = await res.json();
        setProviders(data.providers);

        if (meRes && meRes.ok) {
          const meData = await meRes.json();
          if (meData?.user?.tokenStats) {
            setUsageStats({
              tokensLast5h: meData.user.tokenStats.tokensLast5h || 0,
              tokensWeekly: meData.user.tokenStats.tokensWeekly || 0,
              tokenLimit5h: meData.user.tokenLimit5h,
              tokenLimitWeekly: meData.user.tokenLimitWeekly,
            });
          }
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProviders();
  }, []);

  const orderedProviders = useMemo(() => {
    if (!chatModelProvider?.providerId) return providers;

    const currentProviderIndex = providers.findIndex(
      (p) => p.id === chatModelProvider.providerId,
    );

    if (currentProviderIndex === -1) {
      return providers;
    }

    const selectedProvider = providers[currentProviderIndex];
    const remainingProviders = providers.filter(
      (_, index) => index !== currentProviderIndex,
    );

    return [selectedProvider, ...remainingProviders];
  }, [providers, chatModelProvider]);

  const handleModelSelect = (providerId: string, modelKey: string) => {
    setChatModelProvider({ providerId, key: modelKey });
    localStorage.setItem('chatModelProviderId', providerId);
    localStorage.setItem('chatModelKey', modelKey);
  };

  const filteredProviders = (orderedProviders || [])
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
    <Popover className="relative inline-flex items-center">
      {({ open }) => (
        <>
          <PopoverButton
            type="button"
            title={
              chatModelProvider?.key
                ? `Model: ${chatModelProvider.key}`
                : t('chat.selectModel') || 'Select model'
            }
            className="active:border-none hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg focus:outline-none text-black/50 dark:text-white/50 active:scale-95 transition duration-200 hover:text-black dark:hover:text-white"
          >
            <Cpu size={16} className="text-sky-500" />
          </PopoverButton>
          <AnimatePresence>
            {open && (
              <PopoverPanel
                className={cn(
                  'absolute z-[60] w-[240px] sm:w-[280px] md:w-[310px]',
                  align === 'left' ? 'left-0' : 'right-0',
                  position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
                )}
                static
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                  className={cn(
                    'bg-light-primary dark:bg-dark-primary max-h-[300px] sm:max-w-none border rounded-lg border-light-200 dark:border-dark-200 w-full flex flex-col shadow-xl overflow-hidden',
                    position === 'top'
                      ? align === 'left'
                        ? 'origin-bottom-left'
                        : 'origin-bottom-right'
                      : align === 'left'
                        ? 'origin-top-left'
                        : 'origin-top-right',
                  )}
                >
                  {/* Token Usage Sliding Window Indicator (5h & Weekly) */}
                  {usageStats && (usageStats.tokenLimit5h || usageStats.tokenLimitWeekly) && (
                    <div className="px-3 py-2 border-b border-light-200 dark:border-dark-200 bg-light-secondary/40 dark:bg-dark-secondary/30 space-y-1.5">
                      {usageStats.tokenLimit5h ? (
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-black/60 dark:text-stone-400">
                            <span>{t('modelUsage.usage5h') || '5h Usage'}:</span>
                            <span className="font-mono text-black/80 dark:text-stone-200">
                              {usageStats.tokensLast5h.toLocaleString()} / {usageStats.tokenLimit5h.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-stone-300 dark:bg-stone-700/60 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-300',
                                (usageStats.tokensLast5h / usageStats.tokenLimit5h) >= 0.8
                                  ? 'bg-amber-500'
                                  : 'bg-[#b8864d]',
                              )}
                              style={{
                                width: `${Math.min(100, Math.round((usageStats.tokensLast5h / usageStats.tokenLimit5h) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                      {usageStats.tokenLimitWeekly ? (
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-black/60 dark:text-stone-400">
                            <span>{t('modelUsage.usageWeekly') || 'Weekly Usage'}:</span>
                            <span className="font-mono text-black/80 dark:text-stone-200">
                              {usageStats.tokensWeekly.toLocaleString()} / {usageStats.tokenLimitWeekly.toLocaleString()}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-stone-300 dark:bg-stone-700/60 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-300',
                                (usageStats.tokensWeekly / usageStats.tokenLimitWeekly) >= 0.8
                                  ? 'bg-amber-500'
                                  : 'bg-[#b8864d]',
                              )}
                              style={{
                                width: `${Math.min(100, Math.round((usageStats.tokensWeekly / usageStats.tokenLimitWeekly) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="p-2 border-b border-light-200 dark:border-dark-200">
                    <div className="relative">
                      <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40"
                      />
                      <input
                        type="text"
                        placeholder={t('chat.searchModels')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-light-secondary dark:bg-dark-secondary rounded-lg placeholder:text-xs placeholder:-translate-y-[1.5px] text-xs text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none border border-transparent transition duration-200"
                      />
                    </div>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2
                          className="animate-spin text-black/40 dark:text-white/40"
                          size={24}
                        />
                      </div>
                    ) : filteredProviders.length === 0 ? (
                      <div className="text-center py-16 px-4 text-black/60 dark:text-white/60 text-sm">
                        {searchQuery
                          ? t('chat.noModelsFound')
                          : t('chat.noChatModelsConfigured')}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {filteredProviders.map((provider, providerIndex) => (
                          <div key={provider.id}>
                            <div className="px-4 py-2.5 sticky top-0 bg-light-primary dark:bg-dark-primary border-b border-light-200/50 dark:border-dark-200/50">
                              <p className="text-xs text-black/50 dark:text-white/50 uppercase tracking-wider">
                                {provider.name}
                              </p>
                            </div>

                            <div className="flex flex-col px-2 py-2 space-y-0.5">
                              {provider.chatModels.map((model) => model && model.key ? (
                                <button
                                  key={model.key}
                                  onClick={() =>
                                    handleModelSelect(provider.id, model.key)
                                  }
                                  type="button"
                                  className={cn(
                                    'px-3 py-2 flex items-center justify-between text-start duration-200 cursor-pointer transition rounded-lg group',
                                    chatModelProvider?.providerId ===
                                      provider.id &&
                                      chatModelProvider?.key === model.key
                                      ? 'bg-light-secondary dark:bg-dark-secondary'
                                      : 'hover:bg-light-secondary dark:hover:bg-dark-secondary',
                                  )}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                    <Cpu
                                      size={15}
                                      className={cn(
                                        'shrink-0',
                                        chatModelProvider?.providerId ===
                                          provider.id &&
                                          chatModelProvider?.key === model.key
                                          ? 'text-sky-500'
                                          : 'text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70',
                                      )}
                                    />
                                    <p
                                      className={cn(
                                        'text-xs truncate',
                                        chatModelProvider?.providerId ===
                                          provider.id &&
                                          chatModelProvider?.key === model.key
                                          ? 'text-sky-500 font-medium'
                                          : 'text-black/70 dark:text-white/70 group-hover:text-black dark:group-hover:text-white',
                                      )}
                                    >
                                      {model.name || model.key}
                                    </p>
                                  </div>
                                </button>
                              ) : null)}
                            </div>

                            {providerIndex < filteredProviders.length - 1 && (
                              <div className="h-px bg-light-200 dark:bg-dark-200" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              </PopoverPanel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
};

export default ModelSelector;
