'use client';

import { Message } from '@/components/ChatWindow';
import { Block } from '@/lib/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import crypto from 'crypto';
import { useParams, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';
import { MinimalProvider } from '../models/types';
import { getAutoMediaSearch } from '../config/clientRegistry';
import { applyPatch } from 'rfc6902';
import { Widget } from '@/components/ChatWindow';

export type Section = {
  message: Message;
  widgets: Widget[];
  parsedTextBlocks: string[];
  speechMessage: string;
  thinkingEnded: boolean;
  suggestions?: string[];
  metrics?: {
    modelKey: string;
    providerId: string;
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

type ChatContext = {
  messages: Message[];
  sections: Section[];
  chatHistory: [string, string][];
  files: File[];
  fileIds: string[];
  sources: string[];
  chatId: string | undefined;
  optimizationMode: string;
  isMessagesLoaded: boolean;
  loading: boolean;
  notFound: boolean;
  messageAppeared: boolean;
  isReady: boolean;
  hasError: boolean;
  configError: string | null;
  refreshConfig: () => Promise<void>;
  chatModelProvider: ChatModelProvider;
  embeddingModelProvider: EmbeddingModelProvider;
  researchEnded: boolean;
  setResearchEnded: (ended: boolean) => void;
  setOptimizationMode: (mode: string) => void;
  setSources: (sources: string[]) => void;
  setFiles: (files: File[]) => void;
  setFileIds: (fileIds: string[]) => void;
  sendMessage: (
    message: string,
    messageId?: string,
    rewrite?: boolean,
    modelOverride?: { key: string; providerId: string },
    waypointIdOverride?: string | null,
  ) => Promise<void>;
  rewrite: (
    messageId: string,
    modelOverride?: { key: string; providerId: string },
  ) => void;
  stopGenerating: () => void;
  deleteMessage: (messageId: string) => Promise<void>;
  retry: (messageId: string) => void;
  editMessage: (messageId: string) => void;
  inputMessage: string;
  setInputMessage: (msg: string) => void;
  setChatModelProvider: (provider: ChatModelProvider) => void;
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void;
  resetChat: () => void;
  waypointId?: string | null;
  setWaypointId: (id: string | null, info?: any) => void;
  waypointInfo?: any;
};

export interface File {
  fileName: string;
  fileExtension: string;
  fileId: string;
}

interface ChatModelProvider {
  key: string;
  providerId: string;
}

interface EmbeddingModelProvider {
  key: string;
  providerId: string;
}

const checkConfig = async (
  setChatModelProvider: (provider: ChatModelProvider) => void,
  setEmbeddingModelProvider: (provider: EmbeddingModelProvider) => void,
  setIsConfigReady: (ready: boolean) => void,
  setHasError: (hasError: boolean) => void,
  setConfigError: (error: string | null) => void,
) => {
  try {
    let chatModelKey = localStorage.getItem('chatModelKey');
    let chatModelProviderId = localStorage.getItem('chatModelProviderId');
    let embeddingModelKey = localStorage.getItem('embeddingModelKey');
    let embeddingModelProviderId = localStorage.getItem(
      'embeddingModelProviderId',
    );

    const res = await fetch(`/api/providers`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to connect to the server (HTTP ${res.status}). Please verify that the application server is running.`,
      );
    }

    const data = await res.json();
    const providers: MinimalProvider[] = data.providers;

    if (!Array.isArray(providers) || providers.length === 0) {
      throw new Error(
        'No AI model providers configured or reachable. Please configure your models in Settings.',
      );
    }

    const chatModelProvider =
      providers.find(
        (p) =>
          p.id === chatModelProviderId &&
          Array.isArray(p.chatModels) &&
          p.chatModels.length > 0,
      ) ??
      providers.find(
        (p) => Array.isArray(p.chatModels) && p.chatModels.length > 0,
      );

    if (
      !chatModelProvider ||
      !Array.isArray(chatModelProvider.chatModels) ||
      chatModelProvider.chatModels.length === 0
    ) {
      throw new Error(
        'No chat models found. Please configure your chat models in Settings.',
      );
    }

    chatModelProviderId = chatModelProvider.id;

    const chatModel =
      chatModelProvider.chatModels.find(
        (m) => m && m.key && m.key === chatModelKey,
      ) ??
      chatModelProvider.chatModels.find((m) => m && m.key && m.key !== 'error') ??
      chatModelProvider.chatModels[0];

    if (!chatModel || !chatModel.key) {
      throw new Error(
        'No valid chat model available. Please configure your models in Settings.',
      );
    }

    chatModelKey = chatModel.key;

    const embeddingModelProvider =
      providers.find(
        (p) =>
          p.id === embeddingModelProviderId &&
          Array.isArray(p.embeddingModels) &&
          p.embeddingModels.length > 0,
      ) ??
      providers.find(
        (p) =>
          Array.isArray(p.embeddingModels) && p.embeddingModels.length > 0,
      );

    if (
      !embeddingModelProvider ||
      !Array.isArray(embeddingModelProvider.embeddingModels) ||
      embeddingModelProvider.embeddingModels.length === 0
    ) {
      throw new Error(
        'No embedding models found. Please configure your embedding models in Settings.',
      );
    }

    embeddingModelProviderId = embeddingModelProvider.id;

    const embeddingModel =
      embeddingModelProvider.embeddingModels.find(
        (m) => m && m.key && m.key === embeddingModelKey,
      ) ??
      embeddingModelProvider.embeddingModels.find(
        (m) => m && m.key && m.key !== 'error',
      ) ??
      embeddingModelProvider.embeddingModels[0];

    if (!embeddingModel || !embeddingModel.key) {
      throw new Error(
        'No valid embedding model available. Please configure your models in Settings.',
      );
    }

    embeddingModelKey = embeddingModel.key;

    localStorage.setItem('chatModelKey', chatModelKey);
    localStorage.setItem('chatModelProviderId', chatModelProviderId);
    localStorage.setItem('embeddingModelKey', embeddingModelKey);
    localStorage.setItem('embeddingModelProviderId', embeddingModelProviderId);

    setChatModelProvider({
      key: chatModelKey,
      providerId: chatModelProviderId,
    });

    setEmbeddingModelProvider({
      key: embeddingModelKey,
      providerId: embeddingModelProviderId,
    });

    setConfigError(null);
    setHasError(false);
    setIsConfigReady(true);
  } catch (err: any) {
    console.error('An error occurred while checking the configuration:', err);
    toast.error(err.message);
    setIsConfigReady(false);
    setConfigError(err.message || 'Configuration error');
    setHasError(true);
  }
};

const loadMessages = async (
  chatId: string,
  setMessages: (messages: Message[]) => void,
  setIsMessagesLoaded: (loaded: boolean) => void,
  chatHistory: React.MutableRefObject<[string, string][]>,
  setSources: (sources: string[]) => void,
  setNotFound: (notFound: boolean) => void,
  setFiles: (files: File[]) => void,
  setFileIds: (fileIds: string[]) => void,
  setWaypointId?: (id: string | null) => void,
  setWaypointInfo?: (info: any) => void,
) => {
  try {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 404) {
      setNotFound(true);
      setIsMessagesLoaded(true);
      return;
    }

    if (!res.ok) {
      throw new Error(`Failed to load chat: status ${res.status}`);
    }

    const data = await res.json();

    const messages = (data.messages || []) as Message[];
    setMessages(messages);

    const history: [string, string][] = [];
    messages.forEach((msg) => {
      history.push(['human', msg.query || '']);

      const textBlocks = (msg.responseBlocks || [])
        .filter(
          (block): block is Block & { type: 'text' } => block?.type === 'text',
        )
        .map((block) => block.data || '')
        .join('\n');

      if (textBlocks) {
        history.push(['assistant', textBlocks]);
      }
    });

    console.debug(new Date(), 'app:messages_loaded');

    if (messages.length > 0 && messages[0].query) {
      document.title = messages[0].query;
    }

    const rawFiles = data.chat?.files || [];
    const files = Array.isArray(rawFiles)
      ? rawFiles.map((file: any) => ({
          fileName: file.name || 'File',
          fileExtension: (file.name || '').split('.').pop() || '',
          fileId: file.fileId || '',
        }))
      : [];

    setFiles(files);
    setFileIds(files.map((file: File) => file.fileId));

    if (setWaypointId) {
      setWaypointId(data.chat?.waypointId || null);
    }
    if (setWaypointInfo) {
      setWaypointInfo(data.chat?.waypoint || null);
    }

    chatHistory.current = history;
    setSources(Array.isArray(data.chat?.sources) ? data.chat.sources : ['web']);
    setIsMessagesLoaded(true);
  } catch (err) {
    console.error('Error loading chat messages:', err);
    toast.error('Failed to load chat messages');
    setIsMessagesLoaded(true);
  }
};

export const chatContext = createContext<ChatContext>({
  chatHistory: [],
  chatId: '',
  fileIds: [],
  files: [],
  sources: [],
  hasError: false,
  configError: null,
  refreshConfig: async () => {},
  isMessagesLoaded: false,
  isReady: false,
  loading: false,
  messageAppeared: false,
  messages: [],
  sections: [],
  notFound: false,
  optimizationMode: '',
  chatModelProvider: { key: '', providerId: '' },
  embeddingModelProvider: { key: '', providerId: '' },
  researchEnded: false,
  rewrite: () => {},
  stopGenerating: () => {},
  deleteMessage: async () => {},
  retry: () => {},
  editMessage: () => {},
  inputMessage: '',
  setInputMessage: () => {},
  sendMessage: async () => {},
  setFileIds: () => {},
  setFiles: () => {},
  setSources: () => {},
  setOptimizationMode: () => {},
  setChatModelProvider: () => {},
  setEmbeddingModelProvider: () => {},
  setResearchEnded: () => {},
  resetChat: () => {},
  waypointId: null,
  setWaypointId: () => {},
  waypointInfo: null,
});

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const params: { chatId: string } = useParams();

  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('q');
  const waypointParam = searchParams.get('waypoint');

  const [waypointId, setWaypointIdState] = useState<string | null>(waypointParam || null);
  const waypointIdRef = useRef<string | null>(waypointParam || null);
  const [waypointInfo, setWaypointInfo] = useState<any>(null);

  const handleSetWaypointId = useCallback((id: string | null, info?: any) => {
    setWaypointIdState(id);
    waypointIdRef.current = id;
    if (info !== undefined) {
      setWaypointInfo(info);
    } else if (id) {
      fetch(`/api/waypoints/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.waypoint) {
            setWaypointInfo(data.waypoint);
          }
        })
        .catch(() => {});
    } else {
      setWaypointInfo(null);
    }
  }, []);

  const setWaypointId = handleSetWaypointId;

  useEffect(() => {
    if (waypointParam && !params.chatId) {
      handleSetWaypointId(waypointParam);
    }
  }, [waypointParam, params.chatId, handleSetWaypointId]);

  const [chatId, setChatId] = useState<string | undefined>(params.chatId);
  const [newChatCreated, setNewChatCreated] = useState(false);

  const [loading, setLoading] = useState(false);
  const [messageAppeared, setMessageAppeared] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const [researchEnded, setResearchEnded] = useState(false);

  const chatHistory = useRef<[string, string][]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const [files, setFiles] = useState<File[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);

  const [sources, setSources] = useState<string[]>(['web']);
  const [optimizationMode, setOptimizationModeState] = useState<string>('speed');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('optimizationMode');
      if (saved && ['speed', 'balanced', 'quality'].includes(saved)) {
        setOptimizationModeState(saved);
      }
    } catch {}
  }, []);

  const setOptimizationMode = (mode: string) => {
    setOptimizationModeState(mode);
    try {
      localStorage.setItem('optimizationMode', mode);
    } catch {}
  };

  const [isMessagesLoaded, setIsMessagesLoaded] = useState(false);

  const [notFound, setNotFound] = useState(false);

  const [chatModelProvider, setChatModelProvider] = useState<ChatModelProvider>(
    {
      key: '',
      providerId: '',
    },
  );

  const [embeddingModelProvider, setEmbeddingModelProvider] =
    useState<EmbeddingModelProvider>({
      key: '',
      providerId: '',
    });

  const [isConfigReady, setIsConfigReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refreshConfig = async () => {
    setHasError(false);
    setConfigError(null);
    await checkConfig(
      setChatModelProvider,
      setEmbeddingModelProvider,
      setIsConfigReady,
      setHasError,
      setConfigError,
    );
  };

  const messagesRef = useRef<Message[]>([]);

  const sections = useMemo<Section[]>(() => {
    return (messages || []).map((msg) => {
      const textBlocks: string[] = [];
      let speechMessage = '';
      let thinkingEnded = false;
      let suggestions: string[] = [];
      let metrics: any = undefined;

      const blocks = Array.isArray(msg.responseBlocks) ? msg.responseBlocks : [];

      const sourceBlocks = blocks.filter(
        (block): block is Block & { type: 'source' } => block?.type === 'source',
      );
      const sources = sourceBlocks.flatMap((block) => (Array.isArray(block.data) ? block.data : []));

      const widgetBlocks = blocks
        .filter((b) => b?.type === 'widget')
        .map((b) => b.data) as Widget[];

      blocks.forEach((block) => {
        if (!block) return;
        if (block.type === 'text') {
          let processedText = typeof block.data === 'string' ? block.data : String(block.data ?? '');
          const citationRegex = /\[([^\]]+)\]/g;
          const regex = /\[(\d+)\]/g;

          if (processedText.includes('</think>') && !processedText.includes('<think>')) {
            processedText = '<think>' + processedText;
          }

          if (processedText.includes('<think>')) {
            const openThinkCount = (processedText.match(/<think>/g) || []).length;
            const closeThinkCount = (processedText.match(/<\/think>/g) || []).length;

            if (openThinkCount > closeThinkCount) {
              processedText += '</think> <a> </a>'.repeat(openThinkCount - closeThinkCount);
            }
          }

          if (typeof block.data === 'string' && block.data.includes('</think>')) {
            thinkingEnded = true;
          }

          if (sources.length > 0) {
            processedText = processedText.replace(
              citationRegex,
              (_, capturedContent: string) => {
                const numbers = capturedContent
                  .split(',')
                  .map((numStr) => numStr.trim());

                const linksHtml = numbers
                  .map((numStr) => {
                    const number = parseInt(numStr);

                    if (isNaN(number) || number <= 0) {
                      return `[${numStr}]`;
                    }

                    const source = sources[number - 1];
                    const url = source?.metadata?.url || '';
                    const title = source?.metadata?.title || source?.metadata?.fileName || url || '';

                    if (url) {
                      const cleanUrl = url.replace(/"/g, '&quot;');
                      const cleanTitle = title.replace(/"/g, '&quot;');
                      return `<citation href="${cleanUrl}" title="${cleanTitle}">${numStr}</citation>`;
                    } else {
                      return ``;
                    }
                  })
                  .join('');

                return linksHtml;
              },
            );
            speechMessage += typeof block.data === 'string' ? block.data.replace(regex, '') : '';
          } else {
            processedText = processedText.replace(regex, '');
            speechMessage += typeof block.data === 'string' ? block.data.replace(regex, '') : '';
          }

          textBlocks.push(processedText);
        } else if (block.type === 'suggestion' && Array.isArray(block.data)) {
          suggestions = block.data;
        } else if (block.type === 'metrics') {
          metrics = block.data;
        }
      });

      return {
        message: msg,
        parsedTextBlocks: textBlocks,
        speechMessage,
        thinkingEnded,
        suggestions,
        widgets: widgetBlocks,
        metrics: metrics || (msg.metadata as any),
      };
    });
  }, [messages]);

  const isReconnectingRef = useRef(false);
  const handledMessageEndRef = useRef<Set<string>>(new Set());

  const checkReconnect = async () => {
    if (isReconnectingRef.current) return;

    setIsReady(true);
    console.debug(new Date(), 'app:ready');

    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];

      if (lastMsg.status === 'answering') {
        setLoading(true);
        setResearchEnded(false);
        setMessageAppeared(false);

        isReconnectingRef.current = true;

        try {
          const res = await fetch(`/api/reconnect/${lastMsg.backendId}`, {
            method: 'POST',
          });

          if (!res.ok) {
            console.warn(`Reconnect returned status ${res.status}`);
            if (chatId) {
              await loadMessages(
                chatId,
                setMessages,
                setIsMessagesLoaded,
                chatHistory,
                setSources,
                setNotFound,
                setFiles,
                setFileIds,
                setWaypointId,
                setWaypointInfo,
              );
            } else {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.messageId === lastMsg.messageId
                    ? { ...msg, status: 'error' as const }
                    : msg,
                ),
              );
            }
            setLoading(false);
            return;
          }

          if (!res.body) throw new Error('No response body');

          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');

          let partialChunk = '';
          const messageHandler = getMessageHandler(lastMsg);

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            partialChunk += decoder.decode(value, { stream: true });

            try {
              const lines = partialChunk.split('\n');
              partialChunk = lines.pop() || '';
              for (const msg of lines) {
                if (!msg.trim()) continue;
                const json = JSON.parse(msg.trim());
                if (json.type === 'ping') continue;
                messageHandler(json);
              }
            } catch {
              console.warn('Incomplete JSON, waiting for next chunk...');
            }
          }
        } catch (error) {
          console.warn('Error during reconnect:', error);
          if (chatId) {
            await loadMessages(
              chatId,
              setMessages,
              setIsMessagesLoaded,
              chatHistory,
              setSources,
              setNotFound,
              setFiles,
              setFileIds,
              setWaypointId,
              setWaypointInfo,
            );
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.messageId === lastMsg.messageId
                  ? { ...msg, status: 'error' as const }
                  : msg,
              ),
            );
          }
        } finally {
          setLoading(false);
          isReconnectingRef.current = false;
        }
      }
    }
  };

  useEffect(() => {
    refreshConfig();

    const handleConfigChange = () => {
      refreshConfig();
    };

    window.addEventListener('client-config-changed', handleConfigChange);
    return () => {
      window.removeEventListener('client-config-changed', handleConfigChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    const newId = crypto.randomBytes(20).toString('hex');
    setChatId(newId);
    setMessages([]);
    chatHistory.current = [];
    setFiles([]);
    setFileIds([]);
    setIsMessagesLoaded(true);
    setNotFound(false);
    setNewChatCreated(true);
    setIsReady(true);
    setInputMessage('');
    const wpFromUrl =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('waypoint')
        : null;
    if (wpFromUrl) {
      handleSetWaypointId(wpFromUrl);
    } else {
      handleSetWaypointId(null);
    }
  }, [handleSetWaypointId]);

  const previousParamsChatIdRef = useRef<string | undefined>(params.chatId);

  useEffect(() => {
    if (params.chatId && params.chatId !== previousParamsChatIdRef.current) {
      previousParamsChatIdRef.current = params.chatId;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setChatId(params.chatId);
      setMessages([]);
      chatHistory.current = [];
      setFiles([]);
      setFileIds([]);
      setIsMessagesLoaded(false);
      setNotFound(false);
      setNewChatCreated(false);
    } else if (!params.chatId && previousParamsChatIdRef.current) {
      previousParamsChatIdRef.current = undefined;
      resetChat();
    }
  }, [params.chatId, resetChat]);

  useEffect(() => {
    if (
      chatId &&
      !newChatCreated &&
      !isMessagesLoaded &&
      messages.length === 0
    ) {
      loadMessages(
        chatId,
        setMessages,
        setIsMessagesLoaded,
        chatHistory,
        setSources,
        setNotFound,
        setFiles,
        setFileIds,
        setWaypointId,
        setWaypointInfo,
      );
    } else if (!chatId) {
      setNewChatCreated(true);
      setIsMessagesLoaded(true);
      setChatId(crypto.randomBytes(20).toString('hex'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isMessagesLoaded, newChatCreated, messages.length]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (isMessagesLoaded && isConfigReady && newChatCreated) {
      setIsReady(true);
      console.debug(new Date(), 'app:ready');
    } else if (isMessagesLoaded && isConfigReady && !newChatCreated) {
      checkReconnect();
    } else {
      setIsReady(false);
    }
  }, [isMessagesLoaded, isConfigReady, newChatCreated]);

  const rewrite = (
    messageId: string,
    modelOverride?: { key: string; providerId: string },
  ) => {
    const index = messages.findIndex((msg) => msg.messageId === messageId);

    if (index === -1) return;

    setMessages((prev) => prev.slice(0, index));

    chatHistory.current = chatHistory.current.slice(0, index * 2);

    const messageToRewrite = messages[index];
    handledMessageEndRef.current.delete(messageToRewrite.messageId);
    sendMessage(
      messageToRewrite.query,
      messageToRewrite.messageId,
      true,
      modelOverride,
    );
  };

  useEffect(() => {
    if (isReady && initialMessage && isConfigReady) {
      if (!isConfigReady) {
        toast.error('Cannot send message before the configuration is ready');
        return;
      }
      const activeWp =
        searchParams.get('waypoint') ||
        waypointIdRef.current ||
        waypointId;

      if (activeWp) {
        handleSetWaypointId(activeWp);
      }
      sendMessage(
        initialMessage,
        undefined,
        false,
        undefined,
        activeWp || undefined,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigReady, isReady, initialMessage]);

  const getMessageHandler = (message: Message) => {
    const messageId = message.messageId;

    return async (data: any) => {
      if (data.type === 'queueStatus') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? {
                  ...msg,
                  queueStatus: {
                    status: data.status,
                    position: data.position,
                    modelKey: data.modelKey,
                    providerId: data.providerId,
                  },
                }
              : msg,
          ),
        );
        return;
      }

      if (data.type === 'error') {
        toast.error(data.data);
        setLoading(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: 'error' as const }
              : msg,
          ),
        );
        return;
      }

      if (data.type === 'researchComplete') {
        setResearchEnded(true);
        if (
          message.responseBlocks.find(
            (b) => b.type === 'source' && b.data.length > 0,
          )
        ) {
          setMessageAppeared(true);
        }
      }

      if (data.type === 'block') {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.messageId === messageId) {
              const exists = msg.responseBlocks.findIndex(
                (b) => b.id === data.block.id,
              );

              if (exists !== -1) {
                const existingBlocks = [...msg.responseBlocks];
                existingBlocks[exists] = data.block;

                return {
                  ...msg,
                  responseBlocks: existingBlocks,
                };
              }

              return {
                ...msg,
                responseBlocks: [...msg.responseBlocks, data.block],
              };
            }
            return msg;
          }),
        );

        if (
          (data.block.type === 'source' && data.block.data.length > 0) ||
          data.block.type === 'text'
        ) {
          setMessageAppeared(true);
          if (data.block.type === 'text') {
            setResearchEnded(true);
          }
        }
      }

      if (data.type === 'updateBlock') {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.messageId === messageId) {
              const updatedBlocks = msg.responseBlocks.map((block) => {
                if (block.id === data.blockId) {
                  const updatedBlock = { ...block };
                  applyPatch(updatedBlock, data.patch);
                  return updatedBlock;
                }
                return block;
              });
              return { ...msg, responseBlocks: updatedBlocks };
            }
            return msg;
          }),
        );
      }

      if (data.type === 'messageEnd') {
        if (handledMessageEndRef.current.has(messageId)) {
          return;
        }

        handledMessageEndRef.current.add(messageId);

        const currentMsg = messagesRef.current.find(
          (msg) => msg.messageId === messageId,
        );

        const newHistory: [string, string][] = [
          ...chatHistory.current,
          ['human', message.query],
          [
            'assistant',
            currentMsg?.responseBlocks.find((b) => b.type === 'text')?.data ||
              '',
          ],
        ];

        chatHistory.current = newHistory;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: 'completed' as const }
              : msg,
          ),
        );

        setLoading(false);

        const lastMsg = messagesRef.current[messagesRef.current.length - 1];

        const autoMediaSearch = getAutoMediaSearch();

        if (autoMediaSearch && lastMsg?.messageId) {
          setTimeout(() => {
            document
              .getElementById(`search-images-${lastMsg.messageId}`)
              ?.click();

            document
              .getElementById(`search-videos-${lastMsg.messageId}`)
              ?.click();
          }, 200);
        }

        // Check if there are sources and no suggestions

        const hasSourceBlocks = currentMsg?.responseBlocks.some(
          (block) => block.type === 'source' && block.data.length > 0,
        );
        const hasSuggestions = currentMsg?.responseBlocks.some(
          (block) => block.type === 'suggestion',
        );

        if (hasSourceBlocks && !hasSuggestions) {
          try {
            const suggestions = await getSuggestions(newHistory);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
              const suggestionBlock: Block = {
                id: crypto.randomBytes(7).toString('hex'),
                type: 'suggestion',
                data: suggestions,
              };

              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.messageId === messageId) {
                    return {
                      ...msg,
                      responseBlocks: [...msg.responseBlocks, suggestionBlock],
                    };
                  }
                  return msg;
                }),
              );
            }
          } catch (suggErr) {
            console.warn('Failed to fetch followup suggestions:', suggErr);
          }
        }
      }
    };
  };

  const stopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setMessages((prev) =>
      prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.status === 'answering') {
          const hasText = msg.responseBlocks.some((b) => b.type === 'text');
          return {
            ...msg,
            status: hasText ? ('completed' as const) : ('error' as const),
          };
        }
        return msg;
      }),
    );
  };

  const deleteMessage = async (messageId: string) => {
    if (loading) {
      stopGenerating();
    }

    const index = messages.findIndex((m) => m.messageId === messageId);
    if (index === -1) return;

    setMessages((prev) => prev.slice(0, index));
    chatHistory.current = chatHistory.current.slice(0, index * 2);
    handledMessageEndRef.current.delete(messageId);

    if (chatId) {
      try {
        await fetch(`/api/chats/${chatId}/messages/${messageId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to delete message from database:', err);
      }
    }
  };

  const retry = (messageId: string) => {
    if (loading) {
      stopGenerating();
    }
    rewrite(messageId);
  };

  const editMessage = (messageId: string) => {
    const targetMsg = messages.find((m) => m.messageId === messageId);
    if (!targetMsg) return;
    const queryText = targetMsg.query;
    deleteMessage(messageId);
    setInputMessage(queryText);
  };

  const sendMessage: ChatContext['sendMessage'] = async (
    message,
    messageId,
    rewrite = false,
    modelOverride,
    waypointIdOverride,
  ) => {
    if (loading || !message) return;
    setLoading(true);
    setResearchEnded(false);
    setMessageAppeared(false);

    if (messageId) {
      handledMessageEndRef.current.delete(messageId);
    }

    if (modelOverride) {
      setChatModelProvider(modelOverride);
      try {
        localStorage.setItem('chatModelKey', modelOverride.key);
        localStorage.setItem('chatModelProviderId', modelOverride.providerId);
      } catch {}
    }

    const effectiveWaypointId =
      waypointIdOverride !== undefined
        ? waypointIdOverride
        : waypointIdRef.current ||
          waypointId ||
          (typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('waypoint')
            : null) ||
          null;

    if (effectiveWaypointId && !waypointInfo) {
      handleSetWaypointId(effectiveWaypointId);
    }

    setNewChatCreated(true);
    if (messages.length <= 1) {
      window.history.replaceState(null, '', `/c/${chatId}`);
    }

    messageId = messageId ?? crypto.randomBytes(7).toString('hex');
    const backendId = crypto.randomBytes(20).toString('hex');

    const newMessage: Message = {
      messageId,
      chatId: chatId!,
      backendId,
      query: message,
      responseBlocks: [],
      status: 'answering',
      createdAt: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        console.warn('Chat stream watchdog timeout (90s of silence)');
        abortController.abort();
      }, 90000);
    };

    resetWatchdog();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          content: message,
          message: {
            messageId: messageId,
            chatId: chatId!,
            content: message,
          },
          chatId: chatId!,
          files: fileIds,
          sources: sources,
          optimizationMode: optimizationMode,
          history: chatHistory.current,
          chatModel: modelOverride
            ? {
                key: modelOverride.key,
                providerId: modelOverride.providerId,
              }
            : {
                key: chatModelProvider.key,
                providerId: chatModelProvider.providerId,
              },
          embeddingModel: {
            key: embeddingModelProvider.key,
            providerId: embeddingModelProvider.providerId,
          },
          systemInstructions: localStorage.getItem('systemInstructions'),
          waypointId: effectiveWaypointId || undefined,
        }),
      });

      if (!res.ok) {
        let errorMessage =
          'An error occurred while communicating with the server';
        try {
          const errorData = await res.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          } else if (errorData?.error) {
            errorMessage =
              typeof errorData.error === 'string'
                ? errorData.error
                : JSON.stringify(errorData.error);
          }
        } catch {
          errorMessage = `Server returned status ${res.status}: ${res.statusText}`;
        }
        toast.error(errorMessage);
        setLoading(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.messageId === messageId
              ? { ...msg, status: 'error' as const }
              : msg,
          ),
        );
        return;
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      let buffer = '';
      const messageHandler = getMessageHandler(newMessage);

      while (true) {
        const { value, done } = await reader.read();
        resetWatchdog();

        if (done) {
          if (buffer.trim()) {
            try {
              const json = JSON.parse(buffer.trim());
              messageHandler(json);
            } catch (e) {
              console.warn('Failed to parse trailing chunk:', buffer, e);
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const json = JSON.parse(trimmed);
            if (json.type === 'ping') {
              continue;
            }
            messageHandler(json);
          } catch (err) {
            console.warn('Failed to parse SSE JSON line:', trimmed, err);
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.info('Message generation stream was disconnected or stopped.');
      } else {
        console.error('Error in sendMessage stream:', err);
        toast.error(err?.message || 'Connection lost during message generation');
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.messageId === messageId && msg.status === 'answering') {
              const hasText = msg.responseBlocks.some((b) => b.type === 'text');
              return {
                ...msg,
                status: hasText ? ('completed' as const) : ('error' as const),
              };
            }
            return msg;
          }),
        );
      }
    } finally {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <chatContext.Provider
      value={{
        messages,
        sections,
        chatHistory: chatHistory.current,
        files,
        fileIds,
        sources,
        chatId,
        hasError,
        configError,
        refreshConfig,
        isMessagesLoaded,
        isReady,
        loading,
        messageAppeared,
        notFound,
        optimizationMode,
        setFileIds,
        setFiles,
        setSources,
        setOptimizationMode,
        rewrite,
        retry,
        deleteMessage,
        editMessage,
        stopGenerating,
        inputMessage,
        setInputMessage,
        sendMessage,
        setChatModelProvider,
        chatModelProvider,
        embeddingModelProvider,
        setEmbeddingModelProvider,
        researchEnded,
        setResearchEnded,
        resetChat,
        waypointId,
        setWaypointId,
        waypointInfo,
      }}
    >
      {children}
    </chatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(chatContext);
  return ctx;
};
