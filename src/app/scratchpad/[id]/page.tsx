'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  NotebookPen,
  Save,
  Download,
  History,
  ListTree,
  Sparkles,
  Layers,
  FileText,
  Share2,
  Trash2,
  Check,
  RotateCcw,
  Compass,
  Waypoints as WaypointsIcon,
  BookOpen,
  X,
  Presentation as PresentationIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import ScratchpadEditor from '@/components/Scratchpad/ScratchpadEditor';
import PresentationCanvas from '@/components/Presentation/PresentationCanvas';
import ScratchpadChat, { ScratchpadChatMessage } from '@/components/Scratchpad/ScratchpadChat';
import ScratchpadTOC from '@/components/Scratchpad/ScratchpadTOC';
import ScratchpadSourcesPanel from '@/components/Scratchpad/ScratchpadSourcesPanel';
import ScratchpadVersionHistory, { ScratchpadVersion } from '@/components/Scratchpad/ScratchpadVersionHistory';
import ScratchpadTemplateDialog from '@/components/Scratchpad/ScratchpadTemplateDialog';
import ScratchpadExportDialog from '@/components/Scratchpad/ScratchpadExportDialog';
import LoginDialog from '@/components/Auth/LoginDialog';
import { applyPatch } from 'rfc6902';

const ScratchpadWorkspacePage = () => {
  const params = useParams();
  const id = (params?.id as string) || '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sketchType, setSketchType] = useState<'note' | 'presentation'>('note');
  const [metadata, setMetadata] = useState<any>({});
  const [sources, setSources] = useState<any[]>([]);
  const [messages, setMessages] = useState<ScratchpadChatMessage[]>([]);
  const [versions, setVersions] = useState<ScratchpadVersion[]>([]);
  const [waypointInfo, setWaypointInfo] = useState<any>(null);
  const [templateInfo, setTemplateInfo] = useState<any>(null);

  // Selection & AI context
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoPromptTriggered = useRef(false);

  // Dialogs & Drawers
  const [drawerTab, setDrawerTab] = useState<'toc' | 'sources' | null>(null);
  const [hoveredSourceIndex, setHoveredSourceIndex] = useState<number | null>(null);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');

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

  // Auto-save debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchScratchpad = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/scratchpad/${id}`);
      if (res.ok) {
        const data = await res.json();
        const sp = data.scratchpad;
        setTitle(sp.title || t('scratchpad.untitled') || 'Untitled');
        setContent(sp.content || '');
        setSketchType(sp.type || 'note');
        setMetadata(typeof sp.metadata === 'string' ? JSON.parse(sp.metadata || '{}') : (sp.metadata || {}));
        setSources(sp.sources || []);
        setMessages(sp.messages || []);
        setVersions(sp.versions || []);
        setWaypointInfo(sp.waypoint || null);
        setTemplateInfo(sp.template || null);
      } else if (res.status === 401) {
        setIsLoginOpen(true);
      } else if (res.status === 404) {
        toast.error(t('scratchpad.noSketchesFound') || 'Note not found.');
        router.push('/scratchpad');
      }
    } catch (err) {
      console.error('Failed to load scratchpad:', err);
      toast.error(t('common.error') || 'An error occurred while loading the note.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    if (id) {
      fetchScratchpad();
    }
  }, [id]);

  // Handle autoPrompt when redirected from New Presentation dialog
  useEffect(() => {
    if (!loading && id && !autoPromptTriggered.current) {
      const autoPrompt = searchParams?.get('autoPrompt');
      if (autoPrompt && messages.length === 0) {
        autoPromptTriggered.current = true;
        // Clean URL query param without full reload
        router.replace(`/scratchpad/${id}`);
        handleSendMessage(autoPrompt, {
          isPresentation: sketchType === 'presentation',
        });
      }
    }
  }, [loading, id, searchParams, messages.length, sketchType]);

  // Debounced auto-save for manual edits
  const triggerAutoSave = useCallback(
    (newTitle: string, newContent: string) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      setIsSaving(true);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/scratchpad/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: newTitle,
              content: newContent,
            }),
          });
        } catch (err) {
          console.error('Auto-save error:', err);
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
    [id],
  );

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    triggerAutoSave(title, newContent);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    triggerAutoSave(newTitle, content);
  };

  const handleAcceptPlan = async (approvedPlan: any) => {
    setMetadata((prev: any) => ({ ...prev, plan: approvedPlan, planStatus: 'approved' }));
    await handleSendMessage('Presentation plan approved. Generate the final slides.', {
      isPresentation: true,
      planApproved: true,
      approvedPlan,
    });
  };

  const handleSendMessage = async (
    userQuery: string,
    options?: {
      clarificationResponse?: {
        question?: string;
        selectedOption?: string;
        customText?: string;
      };
      skipClarification?: boolean;
      isPresentation?: boolean;
      planApproved?: boolean;
      approvedPlan?: any;
    },
  ) => {
    if (!userQuery.trim() || isAiGenerating) return;

    setIsAiGenerating(true);
    const messageId = crypto.randomUUID();

    // Determine query display text for user bubble if it is a clarification response
    let userDisplayText = userQuery;
    if (options?.clarificationResponse?.selectedOption) {
      userDisplayText = `[Clarification: ${options.clarificationResponse.selectedOption}${
        options.clarificationResponse.customText ? ` - ${options.clarificationResponse.customText}` : ''
      }]`;
    } else if (options?.clarificationResponse?.customText) {
      userDisplayText = `[Clarification: ${options.clarificationResponse.customText}]`;
    } else if (options?.planApproved) {
      userDisplayText = `[Presentation plan approved - Generating ${metadata?.slideCount || 8} slides]`;
    }

    // Optimistically add user message
    const userMsg: ScratchpadChatMessage = {
      id: messageId,
      messageId,
      role: 'user',
      query: userDisplayText,
      selectedText: selectedText || null,
      createdAt: new Date().toISOString(),
    };

    // Temporary assistant message
    const assistantMsgId = `${messageId}-assistant`;
    const tempAssistantMsg: ScratchpadChatMessage = {
      id: assistantMsgId,
      messageId,
      role: 'assistant',
      query: '',
      responseBlocks: [{ id: 'temp', type: 'text', data: '' }],
      sources: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, tempAssistantMsg]);

    const activeSelectedText = selectedText;
    setSelectedText(null); // Clear selection after submit

    // Prepare models & settings from storage
    const chatModelProviderId = localStorage.getItem('chatModelProviderId') || 'openai';
    const chatModelKey = localStorage.getItem('chatModelKey') || 'gpt-4o';
    const embeddingModelProviderId = localStorage.getItem('embeddingModelProviderId') || 'openai';
    const embeddingModelKey = localStorage.getItem('embeddingModelKey') || 'text-embedding-3-small';
    const optimizationMode = localStorage.getItem('optimizationMode') || 'balanced';
    let activeSources: string[] = ['web'];
    try {
      const stored = localStorage.getItem('sources');
      if (stored) activeSources = JSON.parse(stored);
    } catch {}

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const isPres = options?.isPresentation ?? sketchType === 'presentation';
      const res = await fetch(`/api/scratchpad/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          message: {
            messageId,
            content: userQuery,
          },
          chatModel: {
            providerId: chatModelProviderId,
            key: chatModelKey,
          },
          embeddingModel: {
            providerId: embeddingModelProviderId,
            key: embeddingModelKey,
          },
          optimizationMode,
          sources: activeSources,
          selectedText: activeSelectedText,
          currentContent: content,
          currentTitle: title,
          waypointId: waypointInfo?.id || null,
          clarificationResponse: options?.clarificationResponse,
          skipClarification: options?.skipClarification ?? false,
          isPresentation: isPres,
          planApproved: options?.planApproved ?? false,
          approvedPlan: options?.approvedPlan,
          presentationConfig: metadata,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error communicating with the AI');
      }

      if (!res.body) throw new Error('No body received');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          let dataStr = line;
          if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim();
          }
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.type === 'ping') {
              continue;
            }

            if (data.type === 'error') {
              toast.error(data.data || 'An error occurred while generating the response.');
              continue;
            }

            if (data.type === 'clarification') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')
                    ? {
                        ...msg,
                        clarification: data.clarification,
                        responseBlocks: [
                          {
                            id: crypto.randomUUID(),
                            type: 'clarification',
                            data: data.clarification,
                          },
                        ],
                      }
                    : msg,
                ),
              );
            } else if (data.type === 'presentation_clarification') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')
                    ? {
                        ...msg,
                        presentationClarification: data.clarification,
                        responseBlocks: [
                          {
                            id: crypto.randomUUID(),
                            type: 'presentation_clarification',
                            data: data.clarification,
                          },
                        ],
                      }
                    : msg,
                ),
              );
            } else if (data.type === 'presentation_plan') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')
                    ? {
                        ...msg,
                        presentationPlan: data.plan,
                        responseBlocks: [
                          {
                            id: crypto.randomUUID(),
                            type: 'presentation_plan',
                            data: data.plan,
                          },
                        ],
                      }
                    : msg,
                ),
              );
            } else if (data.type === 'sources') {
              const newSources = Array.isArray(data.sources) ? data.sources : [];
              setSources(newSources);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')
                    ? { ...msg, sources: newSources }
                    : msg,
                ),
              );
            } else if (data.type === 'block') {
              const block = data.block;
              if (block) {
                if (block.type === 'source' || block.type === 'sources') {
                  const newSources = Array.isArray(block.data) ? block.data : [];
                  if (newSources.length > 0) {
                    setSources(newSources);
                  }
                }

                setMessages((prev) =>
                  prev.map((msg) => {
                    if (msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')) {
                      const existingBlocks = msg.responseBlocks || [];
                      const existsIdx = existingBlocks.findIndex((b) => b && b.id === block.id);
                      let nextBlocks;
                      if (existsIdx !== -1) {
                        nextBlocks = [...existingBlocks];
                        nextBlocks[existsIdx] = block;
                      } else {
                        nextBlocks = [...existingBlocks, block];
                      }
                      return {
                        ...msg,
                        responseBlocks: nextBlocks,
                        sources: (block.type === 'source' || block.type === 'sources') && Array.isArray(block.data) ? block.data : msg.sources,
                      };
                    }
                    return msg;
                  }),
                );
              }
            } else if (data.type === 'updateBlock') {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')) {
                    const existingBlocks = msg.responseBlocks || [];
                    const updatedBlocks = existingBlocks.map((block) => {
                      if (block && block.id === data.blockId) {
                        const updatedBlock = { ...block };
                        applyPatch(updatedBlock, data.patch);
                        return updatedBlock;
                      }
                      return block;
                    });

                    // Real-time live update of editor or slide content as it is generated
                    const textBlock = updatedBlocks.find((b) => b && b.type === 'text');
                    if (textBlock && typeof textBlock.data === 'string') {
                      const presMatch = textBlock.data.match(/<presentation_update(?:\s+title="[^"]*")?>([\s\S]*?)(?:<presentation_suggestions>|<\/presentation_update>|$)/i);
                      if (presMatch && presMatch[1] !== undefined && presMatch[1].trim()) {
                        setContent(presMatch[1].trim());
                      } else {
                        const liveMatch = textBlock.data.match(/<note_update(?:\s+title="[^"]*")?>([\s\S]*?)(?:<note_suggestions>|<\/note_update>|$)/i);
                        if (liveMatch && liveMatch[1] !== undefined && liveMatch[1].trim()) {
                          setContent(liveMatch[1].trim());
                        } else if (textBlock.data.includes('---') && textBlock.data.includes('# ')) {
                          const cleaned = textBlock.data
                            .replace(/<presentation_suggestions[\s\S]*?(?:<\/presentation_suggestions>|$)/gi, '')
                            .replace(/<note_suggestions[\s\S]*?(?:<\/note_suggestions>|$)/gi, '')
                            .trim();
                          if (cleaned.length > 20) {
                            setContent(cleaned);
                          }
                        }
                      }
                    }

                    return { ...msg, responseBlocks: updatedBlocks };
                  }
                  return msg;
                }),
              );
            } else if (data.type === 'scratchpadUpdate') {
              if (data.content !== undefined && data.content !== null) {
                setContent(data.content);
              }
              if (data.sources && Array.isArray(data.sources)) {
                setSources(data.sources);
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')
                    ? {
                        ...msg,
                        ...(data.chatText
                          ? {
                              responseBlocks: [
                                { id: 'final', type: 'text', data: data.chatText },
                                ...(data.suggestions && data.suggestions.length > 0
                                  ? [{ id: 'suggestions', type: 'suggestions', data: data.suggestions }]
                                  : []),
                              ],
                            }
                          : {}),
                        sources: data.sources || msg.sources,
                        suggestions: data.suggestions || msg.suggestions || [],
                        metrics: data.metrics || msg.metrics || null,
                      }
                    : msg,
                ),
              );
            } else if (data.type === 'content_update') {
              if (data.newContent !== undefined) setContent(data.newContent);
            } else if (data.type === 'commentary') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId || (msg.messageId === messageId && msg.role === 'assistant')
                    ? {
                        ...msg,
                        responseBlocks: [{ id: '1', type: 'text', data: data.data }],
                      }
                    : msg,
                ),
              );
            }
          } catch (e) {
            console.warn('Error parsing stream event line:', line, e);
          }
        }
      }

      // Reload versions after update
      const versionsRes = await fetch(`/api/scratchpad/${id}/versions`);
      if (versionsRes.ok) {
        const vData = await versionsRes.json();
        setVersions(vData.versions || []);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Chat generation error:', err);
        toast.error(err.message || 'Error generating the response.');
      }
    } finally {
      setIsAiGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsAiGenerating(false);
      toast.info(t('chat.searchCancelled') || 'Generation stopped.');
    }
  };

  const handleRevertVersion = async (version: ScratchpadVersion) => {
    try {
      const res = await fetch(`/api/scratchpad/${id}/versions/${version.id}/revert`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setTitle(data.scratchpad.title);
        setContent(data.scratchpad.content);
        setVersions(data.scratchpad.versions || []);
        setIsVersionHistoryOpen(false);
        toast.success(t('scratchpad.revertedSuccess') || 'Successfully reverted to the selected version.');
      } else {
        toast.error('Failed to revert to this version.');
      }
    } catch {
      toast.error('Connection error.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-light-primary dark:bg-[#0c0a09]">
        <div className="flex flex-col items-center space-y-3">
          <NotebookPen className="w-8 h-8 text-[#b8864d] animate-bounce" />
          <span className="text-xs text-stone-500 font-medium">{t('common.loading') || 'Loading scratchpad...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen pb-16 lg:pb-0 overflow-hidden bg-light-primary dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100">
      {/* Top Workspace Header */}
      <header className="h-14 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#14100d]/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          <Link
            href="/scratchpad"
            title={t('common.back') || 'Back'}
            className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center space-x-2 truncate">
            <input
              type="text"
              value={title}
              disabled={isAiGenerating}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('scratchpad.untitled') || 'Untitled'}
              className={`bg-transparent font-semibold text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:bg-black/5 dark:focus:bg-white/5 px-2 py-1 rounded-lg transition truncate max-w-xs md:max-w-md ${
                isAiGenerating ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            />

            {sketchType === 'presentation' ? (
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold shrink-0 flex items-center space-x-1 uppercase tracking-wider">
                <PresentationIcon className="w-3 h-3" />
                <span>{t('presentation.badgePresentation') || 'PRESENTATION'}</span>
              </span>
            ) : waypointInfo ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#b8864d]/15 text-[#b8864d] font-medium shrink-0 flex items-center space-x-1">
                <WaypointsIcon className="w-3 h-3" />
                <span>{waypointInfo.name}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5">
          {/* TOC Toggle */}
          <button
            type="button"
            onClick={() => setDrawerTab(drawerTab === 'toc' ? null : 'toc')}
            title={t('scratchpad.tableOfContents') || 'Table of Contents'}
            className={`p-2 rounded-xl text-xs font-medium border transition flex items-center space-x-1.5 ${
              drawerTab === 'toc'
                ? 'bg-[#b8864d]/15 border-[#b8864d]/40 text-[#b8864d]'
                : 'border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <ListTree className="w-4 h-4" />
            <span className="hidden sm:inline">{t('scratchpad.tableOfContents') || 'Table of Contents'}</span>
          </button>

          {/* Sources Panel Toggle */}
          <button
            type="button"
            onClick={() => setDrawerTab(drawerTab === 'sources' ? null : 'sources')}
            title={t('scratchpad.sourcesTab') || 'Sources'}
            className={`p-2 rounded-xl text-xs font-medium border transition flex items-center space-x-1.5 ${
              drawerTab === 'sources'
                ? 'bg-[#b8864d]/15 border-[#b8864d]/40 text-[#b8864d]'
                : 'border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">{t('scratchpad.sourcesTab') || 'Sources'}</span>
            {sources.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#b8864d]/20 text-[#b8864d] font-bold">
                {sources.length}
              </span>
            )}
          </button>

          {/* Version History Button */}
          <button
            type="button"
            onClick={() => setIsVersionHistoryOpen(true)}
            title={t('scratchpad.versionHistory') || 'Note Version History'}
            className="p-2 rounded-xl text-xs font-medium border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center space-x-1.5"
          >
            <History className="w-4 h-4 text-[#b8864d]" />
            <span className="hidden sm:inline">v{versions[0]?.versionNumber || 1}</span>
          </button>

          {/* Save as Template Button */}
          <button
            type="button"
            onClick={() => setIsSaveTemplateOpen(true)}
            title={t('scratchpad.saveAsTemplate') || 'Save as template'}
            className="p-2 rounded-xl text-xs font-medium border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5 transition hidden md:flex items-center space-x-1.5"
          >
            <Layers className="w-4 h-4" />
            <span>{t('scratchpad.saveAsTemplate') || 'Save as template'}</span>
          </button>

          {/* Queue Trigger Button */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-queue-drawer'))}
            title={t('queue.title') || 'Model Task Queue'}
            className="p-2 rounded-xl text-xs font-medium border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5 transition hidden md:flex items-center space-x-1.5"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>{t('queue.tabQueue') || 'Queue'}</span>
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            title={t('scratchpad.exportNote') || 'Export note'}
            className="p-2 rounded-xl text-xs font-medium border border-light-200 dark:border-[#26201a] text-stone-600 dark:text-stone-400 hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{t('common.export') || 'Export'}</span>
          </button>
        </div>
      </header>

      {/* Main Split Body */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-4 gap-3 sm:gap-4">
        {/* Left Column: AI Copilot Chat */}
        <section className="w-full lg:w-[400px] xl:w-[460px] 2xl:w-[500px] shrink-0 h-full overflow-hidden flex flex-col">
          <ScratchpadChat
            messages={messages}
            onSendMessage={handleSendMessage}
            loading={isAiGenerating}
            onStopGenerating={handleStopGenerating}
            selectedText={selectedText}
            onClearSelection={() => setSelectedText(null)}
            waypointId={waypointInfo?.id}
            activeSources={sources}
            templateInfo={templateInfo}
            isPresentation={sketchType === 'presentation'}
            onAcceptPlan={handleAcceptPlan}
          />
        </section>

        {/* Right Column: Live Editor or Presentation Canvas + Side-Drawer */}
        <section className="flex-1 min-w-0 h-full overflow-hidden flex flex-row relative">
          <div className="flex-1 min-w-0 h-full overflow-hidden">
            {sketchType === 'presentation' ? (
              <PresentationCanvas
                content={content}
                title={title}
                theme={metadata?.theme || 'dark-modern'}
                sources={sources}
                readOnly={isAiGenerating}
                isGenerating={isAiGenerating}
                onChangeContent={handleContentChange}
                hoveredSourceIndex={hoveredSourceIndex}
                onHoverCitation={setHoveredSourceIndex}
              />
            ) : (
              <ScratchpadEditor
                content={content}
                onChange={handleContentChange}
                selectedText={selectedText}
                onSelectText={setSelectedText}
                hoveredSourceIndex={hoveredSourceIndex}
                onHoverCitation={setHoveredSourceIndex}
                readOnly={isAiGenerating}
                isGenerating={isAiGenerating}
                templateInfo={templateInfo}
                onAskAiAboutSelection={(text) => {
                  setSelectedText(text);
                }}
              />
            )}
          </div>

          {/* Collapsible Side-Drawer (TOC & Sources) */}
          {drawerTab !== null && (
            <div className="w-72 md:w-80 border-l border-light-200 dark:border-[#221c16] bg-light-secondary/95 dark:bg-[#16120f]/95 backdrop-blur-md h-full overflow-hidden flex flex-col z-10 shrink-0 animate-fadeIn">
              {/* Drawer Tab Switcher Header */}
              <div className="p-2 border-b border-light-200 dark:border-[#221c16] flex items-center justify-between gap-1 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center space-x-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl flex-1">
                  <button
                    type="button"
                    onClick={() => setDrawerTab('toc')}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg text-xs font-medium transition ${
                      drawerTab === 'toc'
                        ? 'bg-light-primary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                    }`}
                  >
                    <ListTree className="w-3.5 h-3.5" />
                    <span>{t('scratchpad.tocTab') || 'Table of Contents'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerTab('sources')}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-1 px-2 rounded-lg text-xs font-medium transition ${
                      drawerTab === 'sources'
                        ? 'bg-light-primary dark:bg-[#1a1613] text-stone-900 dark:text-stone-100 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{t('scratchpad.sourcesTab') || 'Sources'}</span>
                    {sources.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#b8864d]/20 text-[#b8864d] font-bold">
                        {sources.length}
                      </span>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerTab(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
                  title={t('common.close') || 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto">
                {drawerTab === 'toc' ? (
                  <ScratchpadTOC
                    content={content}
                    onSelectHeading={(heading) => {
                      toast.info(t('scratchpad.navigatedToSectionToast', { heading }) || `Navigated to section: "${heading}"`);
                    }}
                    onAskAiForHeading={(heading) => {
                      setSelectedText(heading);
                      toast.info(t('scratchpad.sectionContextSetToast', { heading }) || `Set section "${heading}" as chat context.`);
                    }}
                  />
                ) : (
                  <ScratchpadSourcesPanel
                    sources={sources}
                    hoveredSourceIndex={hoveredSourceIndex}
                    onHoverSource={setHoveredSourceIndex}
                    onSelectSource={(idx) => {
                      toast.info(t('scratchpad.highlightedSourceToast', { index: idx }) || `Highlighted references to source [${idx}] in the text.`);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Version History Modal */}
      <ScratchpadVersionHistory
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        versions={versions}
        currentVersionNumber={versions[0]?.versionNumber}
        onRevert={handleRevertVersion}
      />

      {/* Template Save Modal */}
      <ScratchpadTemplateDialog
        isOpen={isSaveTemplateOpen}
        onClose={() => setIsSaveTemplateOpen(false)}
        saveCurrentNoteMode={true}
        currentNoteTitle={title}
        currentNoteContent={content}
      />

      {/* Export Modal */}
      <ScratchpadExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        title={title}
        content={content}
        sources={sources}
        isPresentation={sketchType === 'presentation'}
        theme={metadata?.theme || 'dark-modern'}
      />


      <LoginDialog
        isOpen={isLoginOpen}
        setIsOpen={setIsLoginOpen}
        currentUser={currentUser}
        onAuthChange={() => {
          fetchCurrentUser();
          fetchScratchpad();
        }}
      />
    </div>
  );
};

export default ScratchpadWorkspacePage;
