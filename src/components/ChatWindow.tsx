'use client';

import Navbar from './Navbar';
import Chat from './Chat';
import EmptyChat from './EmptyChat';
import NextError from 'next/error';
import { useChat } from '@/lib/hooks/useChat';
import SettingsButtonMobile from './Settings/SettingsButtonMobile';
import { Block } from '@/lib/types';
import Loader from './ui/Loader';

import { useState } from 'react';
import SettingsDialogue from './Settings/SettingsDialogue';
import { BrainCog, Settings, RotateCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';

export interface BaseMessage {
  chatId: string;
  messageId: string;
  createdAt: Date;
}

export interface MessageMetadata {
  modelKey?: string;
  providerId?: string;
  durationMs?: number;
  totalTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface Message extends BaseMessage {
  backendId: string;
  query: string;
  responseBlocks: Block[];
  status: 'answering' | 'completed' | 'error';
  metadata?: MessageMetadata;
  queueStatus?: {
    status: 'queued' | 'running';
    position?: number;
    modelKey?: string;
    providerId?: string;
  };
}

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

export interface Widget {
  widgetType: string;
  params: Record<string, any>;
}

const ChatWindow = () => {
  const { hasError, configError, refreshConfig, notFound, messages, isReady } =
    useChat();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const { t } = useTranslation();

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await refreshConfig();
    } finally {
      setTimeout(() => setIsRetrying(false), 400);
    }
  };

  if (hasError) {
    const isNoProviders =
      !configError ||
      configError.toLowerCase().includes('provider') ||
      configError.toLowerCase().includes('model');

    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
        <div className="absolute w-full flex flex-row items-center justify-end mr-5 mt-5 top-0 right-0">
          <SettingsButtonMobile />
        </div>

        <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-light-200 dark:border-dark-200 bg-light-primary/80 dark:bg-dark-primary/80 shadow-md flex flex-col items-center text-center space-y-4">
          <div className="p-3.5 rounded-full bg-sky-500/10 text-sky-500">
            <BrainCog className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-semibold text-black dark:text-white">
              {isNoProviders
                ? t('chat.aiConfigRequired') || 'AI Model Configuration Required'
                : t('chat.connectionConfigError') || 'Connection or Configuration Error'}
            </h3>
            <p className="text-xs sm:text-xs text-black/60 dark:text-white/60 leading-relaxed max-w-sm">
              {configError ||
                t('chat.noProviderConfiguredError') ||
                'No AI model provider is configured, or the configured model is unavailable. Go to Settings to add a provider (e.g. Ollama, OpenAI, Gemini, Groq).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 w-full">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-4 py-2 text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition duration-200 flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t('chat.openSettings') || 'Open Settings'}</span>
            </button>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-4 py-2 text-xs font-medium bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary hover:dark:bg-dark-200 text-black/70 dark:text-white/70 border border-light-200 dark:border-dark-200 rounded-lg transition duration-200 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`}
              />
              <span>
                {isRetrying
                  ? t('chat.checkingStatus') || 'Checking...'
                  : t('common.retry') || 'Retry'}
              </span>
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isSettingsOpen && (
            <SettingsDialogue
              isOpen={isSettingsOpen}
              setIsOpen={setIsSettingsOpen}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return isReady ? (
    notFound ? (
      <NextError statusCode={404} />
    ) : (
      <div>
        {messages.length > 0 ? (
          <>
            <Navbar />
            <Chat />
          </>
        ) : (
          <EmptyChat />
        )}
      </div>
    )
  ) : (
    <div className="flex items-center justify-center min-h-screen w-full">
      <Loader />
    </div>
  );
};

export default ChatWindow;
