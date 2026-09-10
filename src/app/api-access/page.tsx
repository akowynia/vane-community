'use client';

import React, { useEffect, useState, useRef, Fragment, useMemo } from 'react';
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  Edit2,
  Play,
  Terminal,
  Code2,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Zap,
  Layers,
  Settings2,
  RefreshCw,
  Eye,
  EyeOff,
  Clock,
  Activity,
  Send,
  StopCircle,
  HelpCircle,
  Cpu,
  Database,
  Globe,
  Sliders,
} from 'lucide-react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { cn, formatTimeDifference } from '@/lib/utils';
import LoginDialog from '@/components/Auth/LoginDialog';
import Markdown from 'markdown-to-jsx';

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    role: string;
    displayName?: string | null;
  };
  defaultWaypointId?: string | null;
  rateLimitPerMin?: number;
  rateLimitPerMinute?: number;
  dailyTokenLimit?: number | null;
  tokenLimitPerDay?: number | null;
  defaultModelProvider?: string | null;
  defaultModelName?: string | null;
  status: 'active' | 'suspended';
  lastUsedAt?: string | null;
  createdAt: string;
}

interface WaypointOption {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
}

export default function ApiAccessPage() {
  const { t, locale } = useTranslation();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'keys' | 'playground' | 'snippets'>('keys');

  // User & Mode
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    role: string;
    displayName?: string | null;
  } | null>(null);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showAllUsersKeys, setShowAllUsersKeys] = useState(false);

  // Waypoints & Models
  const [waypoints, setWaypoints] = useState<WaypointOption[]>([]);
  const [modelProviders, setModelProviders] = useState<Record<string, Record<string, string>>>({});
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  // Create Key Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    defaultWaypointId: '',
    rateLimitPerMin: 60,
    dailyTokenLimit: '',
    defaultModelProvider: '',
    defaultModelName: '',
  });

  // Newly Created Key Modal (Reveal once)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    rawKey: string;
    name: string;
    keyPrefix: string;
  } | null>(null);
  const [isCopiedNewKey, setIsCopiedNewKey] = useState(false);
  const [showRawKeySecret, setShowRawKeySecret] = useState(false);

  // Edit Key Dialog state
  const [editingKey, setEditingKey] = useState<ApiKeyItem | null>(null);
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    rateLimitPerMin: 60,
    dailyTokenLimit: '',
    status: 'active' as 'active' | 'suspended',
    defaultWaypointId: '',
  });

  // Delete Key Dialog
  const [deletingKey, setDeletingKey] = useState<ApiKeyItem | null>(null);
  const [isDeletingKey, setIsDeletingKey] = useState(false);

  // Playground state
  const [playgroundKeyId, setPlaygroundKeyId] = useState<string>('');
  const [playgroundQuery, setPlaygroundQuery] = useState('');
  const [playgroundOptimization, setPlaygroundOptimization] = useState<'speed' | 'balanced' | 'quality'>('balanced');
  const [playgroundFocusMode, setPlaygroundFocusMode] = useState<string>('web');
  const [playgroundWaypointId, setPlaygroundWaypointId] = useState<string>('');
  const [playgroundStream, setPlaygroundStream] = useState<boolean>(true);
  const [isRunningPlayground, setIsRunningPlayground] = useState(false);
  const [playgroundOutput, setPlaygroundOutput] = useState<string>('');
  const [playgroundSources, setPlaygroundSources] = useState<any[]>([]);
  const [playgroundRawChunks, setPlaygroundRawChunks] = useState<string[]>([]);
  const [playgroundMetrics, setPlaygroundMetrics] = useState<{
    durationMs?: number;
    tokensUsed?: number;
    promptTokens?: number;
    completionTokens?: number;
    rateLimitRemaining?: string | null;
    status?: number;
  } | null>(null);
  const [playgroundViewMode, setPlaygroundViewMode] = useState<'formatted' | 'raw' | 'sources'>('formatted');
  const abortControllerRef = useRef<AbortController | null>(null);

  // Snippets state
  const [snippetLanguage, setSnippetLanguage] = useState<'curl' | 'python' | 'javascript' | 'n8n'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // List of all localized default sample queries to detect when switching language
  const defaultSampleQueries = useMemo(() => [
    'Provide a concise summary of Vane platform search API capabilities.',
    'Podaj zwięzłe podsumowanie możliwości API platformy Vane.',
    'Geben Sie eine prägnante Zusammenfassung der API-Funktionen der Vane-Plattform.',
    "Fournissez un résumé concis des fonctionnalités de l'API Vane.",
    'Proporcione un resumen conciso de las capacidades de la API de Vane.',
    "Fornisci un riassunto conciso delle funzionalità dell'API della piattaforma Vane.",
    'Forneça um resumo conciso dos recursos da API da plataforma Vane.',
    'Предоставьте краткий обзор возможностей API поиска платформы Vane.',
    'Надайте стислий огляд можливостей API пошуку платформи Vane.',
    '请简要概述 Vane 平台搜索 API 的功能与特性。',
    'Vane プラットフォーム検索 API の概要と機能について簡潔に説明してください。',
    'Vane 플랫폼 검색 API의 주요 기능과 특징을 간략히 요약해 주세요.',
  ], []);

  // Initialize and sync sample query from localization
  useEffect(() => {
    const localizedDefault =
      t('apiAccess.defaultSampleQuery') ||
      'Provide a concise summary of Vane platform search API capabilities.';
    if (!playgroundQuery || defaultSampleQueries.includes(playgroundQuery)) {
      setPlaygroundQuery(localizedDefault);
    }
  }, [t, defaultSampleQueries]);

  // Fetch current user and config
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

  // Fetch Waypoints
  const fetchWaypoints = async () => {
    try {
      const res = await fetch('/api/waypoints');
      if (res.ok) {
        const data = await res.json();
        setWaypoints(Array.isArray(data.waypoints) ? data.waypoints : []);
      }
    } catch (err) {
      console.error('Failed to fetch waypoints:', err);
    }
  };

  // Fetch Models
  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        if (data.chatModelProviders) {
          setModelProviders(data.chatModelProviders);
          const providers = Object.keys(data.chatModelProviders);
          if (providers.length > 0 && !selectedProvider) {
            const firstP = providers[0];
            setSelectedProvider(firstP);
            const models = Object.keys(data.chatModelProviders[firstP] || {});
            if (models.length > 0 && !selectedModel) {
              setSelectedModel(models[0]);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    }
  };

  // Fetch API Keys
  const fetchApiKeys = async (all = showAllUsersKeys) => {
    setLoadingKeys(true);
    try {
      const url = all ? '/api/api-keys?all=true' : '/api/api-keys';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setApiKeys(Array.isArray(data.keys) ? data.keys : []);
        if (data.keys?.length > 0 && !playgroundKeyId) {
          setPlaygroundKeyId(data.keys[0].id);
        }
      } else {
        setApiKeys([]);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
      toast.error(t('apiAccess.loadError') || 'Failed to fetch API keys.');
      setApiKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchWaypoints();
    fetchModels();
  }, []);

  useEffect(() => {
    fetchApiKeys(showAllUsersKeys);
  }, [showAllUsersKeys]);

  const isAdmin = currentUser?.role === 'admin' || (instanceMode === 'single' && !currentUser);

  // Handle Provider Change in forms / playground
  const handleProviderChange = (prov: string) => {
    setSelectedProvider(prov);
    if (modelProviders[prov]) {
      const models = Object.keys(modelProviders[prov]);
      if (models.length > 0) {
        setSelectedModel(models[0]);
      } else {
        setSelectedModel('');
      }
    }
  };

  // Create API Key
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error(t('apiAccess.nameRequired') || 'Key name is required.');
      return;
    }

    setIsCreatingKey(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          defaultWaypointId: createForm.defaultWaypointId || null,
          rateLimitPerMin: Number(createForm.rateLimitPerMin) || 60,
          dailyTokenLimit: createForm.dailyTokenLimit ? Number(createForm.dailyTokenLimit) : null,
          defaultModelProvider: createForm.defaultModelProvider || null,
          defaultModelName: createForm.defaultModelName || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create API key.');
      }

      const data = await res.json();
      setIsCreateDialogOpen(false);
      setNewlyCreatedKey({
        rawKey: data.rawKey || data.key?.rawKey,
        name: data.key?.name || data.name || createForm.name.trim(),
        keyPrefix: data.key?.keyPrefix || data.keyPrefix || '',
      });
      setShowRawKeySecret(true);
      toast.success(t('apiAccess.createSuccess') || 'API key created successfully!');
      fetchApiKeys();
      setCreateForm({
        name: '',
        defaultWaypointId: '',
        rateLimitPerMin: 60,
        dailyTokenLimit: '',
        defaultModelProvider: '',
        defaultModelName: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while creating key.');
    } finally {
      setIsCreatingKey(false);
    }
  };

  // Open Edit Key Dialog
  const handleOpenEdit = (key: ApiKeyItem) => {
    setEditingKey(key);
    setEditForm({
      name: key.name,
      rateLimitPerMin: key.rateLimitPerMin || 60,
      dailyTokenLimit: key.dailyTokenLimit ? String(key.dailyTokenLimit) : '',
      status: key.status,
      defaultWaypointId: key.defaultWaypointId || '',
    });
  };

  // Save Edit Key
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    setIsEditingKey(true);
    try {
      const res = await fetch(`/api/api-keys/${editingKey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          rateLimitPerMin: Number(editForm.rateLimitPerMin) || 60,
          dailyTokenLimit: editForm.dailyTokenLimit ? Number(editForm.dailyTokenLimit) : null,
          status: editForm.status,
          defaultWaypointId: editForm.defaultWaypointId || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update API key.');
      }

      toast.success(t('apiAccess.updateSuccess') || 'API key updated successfully.');
      setEditingKey(null);
      fetchApiKeys();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while updating key.');
    } finally {
      setIsEditingKey(false);
    }
  };

  // Confirm Delete Key
  const handleConfirmDelete = async () => {
    if (!deletingKey) return;
    setIsDeletingKey(true);
    try {
      const res = await fetch(`/api/api-keys/${deletingKey.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete API key.');
      }

      toast.success(t('apiAccess.deleteSuccess') || 'API key deleted successfully.');
      setDeletingKey(null);
      fetchApiKeys();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while deleting key.');
    } finally {
      setIsDeletingKey(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, onCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    onCopied(true);
    toast.success(t('apiAccess.copiedToClipboard') || 'Copied to clipboard!');
    setTimeout(() => onCopied(false), 2500);
  };

  // Run Playground Request (Server-side execution for security)
  const handleRunPlayground = async () => {
    if (!playgroundKeyId) {
      toast.error(t('apiAccess.selectKeyPrompt') || 'Please select an API key to execute the test.');
      return;
    }
    if (!playgroundQuery.trim()) {
      toast.error(t('apiAccess.queryRequired') || 'Please enter a search query.');
      return;
    }

    setIsRunningPlayground(true);
    setPlaygroundOutput('');
    setPlaygroundSources([]);
    setPlaygroundRawChunks([]);
    setPlaygroundMetrics(null);

    const startTime = performance.now();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/api-keys/playground-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          keyId: playgroundKeyId,
          apiKeyId: playgroundKeyId,
          query: playgroundQuery.trim(),
          chatModel: selectedModel ? { provider: selectedProvider, model: selectedModel } : undefined,
          optimizationMode: playgroundOptimization,
          focusMode: playgroundFocusMode,
          waypointId: playgroundWaypointId || undefined,
          stream: playgroundStream,
        }),
      });

      const remainingHeader = res.headers.get('X-RateLimit-Remaining');
      const durationMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        setPlaygroundMetrics({
          durationMs,
          status: res.status,
          rateLimitRemaining: remainingHeader,
        });
        throw new Error(errorData.message || `Server error (${res.status})`);
      }

      if (playgroundStream && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let sourcesFound: any[] = [];
        let streamBuffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunkText = decoder.decode(value, { stream: true });
          setPlaygroundRawChunks((prev) => [...prev, chunkText]);
          streamBuffer += chunkText;

          // Split by newline and preserve uncompleted line in streamBuffer
          const lines = streamBuffer.split('\n');
          streamBuffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            let jsonStr = line;
            if (jsonStr.startsWith('data:')) {
              jsonStr = jsonStr.slice(5).trim();
            }
            if (!jsonStr || jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'response') {
                fullText += parsed.data || '';
                setPlaygroundOutput(fullText);
              } else if (parsed.type === 'sources' || parsed.type === 'searchResults') {
                sourcesFound = parsed.data || [];
                setPlaygroundSources(sourcesFound);
              }
            } catch {
              // Ignore non-json or incomplete chunk
            }
          }
        }

        // Process any leftover in streamBuffer
        if (streamBuffer.trim()) {
          let jsonStr = streamBuffer.trim();
          if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.type === 'response') {
                fullText += parsed.data || '';
                setPlaygroundOutput(fullText);
              } else if (parsed.type === 'sources' || parsed.type === 'searchResults') {
                sourcesFound = parsed.data || [];
                setPlaygroundSources(sourcesFound);
              }
            } catch {}
          }
        }

        const finalDuration = Math.round(performance.now() - startTime);
        setPlaygroundMetrics({
          durationMs: finalDuration,
          status: 200,
          rateLimitRemaining: remainingHeader,
        });
        toast.success(t('apiAccess.playgroundSuccess') || 'API query executed successfully!');
      } else {
        const jsonResult = await res.json();
        const textContent =
          jsonResult.message ||
          jsonResult.response ||
          jsonResult.answer ||
          JSON.stringify(jsonResult, null, 2);
        setPlaygroundOutput(textContent);
        setPlaygroundSources(jsonResult.sources || []);
        setPlaygroundRawChunks([JSON.stringify(jsonResult, null, 2)]);
        setPlaygroundMetrics({
          durationMs,
          status: 200,
          rateLimitRemaining: remainingHeader,
        });
        toast.success(t('apiAccess.playgroundSuccess') || 'API query executed successfully!');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info(t('apiAccess.aborted') || 'Request was cancelled.');
      } else {
        toast.error(err.message || 'Error occurred while executing query in Playground.');
      }
    } finally {
      setIsRunningPlayground(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopPlayground = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Generate Snippets Code Client-Side
  const generateSnippetCode = () => {
    const activeKey = apiKeys.find((k) => k.id === playgroundKeyId);
    const keyToken = activeKey ? `${activeKey.keyPrefix}...` : 'vane_sk_YOUR_API_KEY_HERE';
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const provider = selectedProvider || 'openai';
    const model = selectedModel || 'gpt-4o-mini';

    switch (snippetLanguage) {
      case 'curl':
        return `# Direct Vane Search API Request with Bearer Authorization
curl -X POST "${baseUrl}/api/search" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${keyToken}" \\
  -d '{
    "query": "${playgroundQuery.replace(/"/g, '\\"')}",
    "chatModel": {
      "provider": "${provider}",
      "model": "${model}"
    },
    "optimizationMode": "${playgroundOptimization}",
    "focusMode": "${playgroundFocusMode}",
    "stream": true
  }'`;

      case 'python':
        return `import json
import requests

API_URL = "${baseUrl}/api/search"
API_KEY = "${keyToken}"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

payload = {
    "query": "${playgroundQuery.replace(/"/g, '\\"')}",
    "chatModel": {
        "provider": "${provider}",
        "model": "${model}"
    },
    "optimizationMode": "${playgroundOptimization}",
    "focusMode": "${playgroundFocusMode}",
    "stream": True
}

response = requests.post(API_URL, headers=headers, json=payload, stream=True)

if response.status_code == 200:
    print("Streaming response from Vane API:\\n")
    for line in response.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith("data: "):
                data_str = decoded[6:]
                if data_str == "[DONE]":
                    break
                try:
                    event = json.loads(data_str)
                    if event.get("type") == "response":
                        print(event.get("data", ""), end="", flush=True)
                except json.JSONDecodeError:
                    pass
    print()
else:
    print(f"Error {response.status_code}: {response.text}")`;

      case 'javascript':
        return `// Node.js 18+ or Modern Browser with native fetch and SSE
async function searchVane() {
  const API_URL = "${baseUrl}/api/search";
  const API_KEY = "${keyToken}";

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${API_KEY}\`
    },
    body: JSON.stringify({
      query: "${playgroundQuery.replace(/"/g, '\\"')}",
      chatModel: {
        provider: "${provider}",
        model: "${model}"
      },
      optimizationMode: "${playgroundOptimization}",
      focusMode: "${playgroundFocusMode}",
      stream: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(\`HTTP \${response.status}: \${errorText}\`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.substring(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === "response") {
            process.stdout.write(parsed.data);
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }
  }
}

searchVane().catch(console.error);`;

      case 'n8n':
        return `// n8n HTTP Request Node Configuration:
// Method: POST
// URL: ${baseUrl}/api/search
// Authentication: Header Auth
//   Header Name: Authorization
//   Header Value: Bearer ${keyToken}
// Body Parameters (JSON):
{
  "query": "={{ $json.message || 'Search recent news and trends' }}",
  "chatModel": {
    "provider": "${provider}",
    "model": "${model}"
  },
  "optimizationMode": "balanced",
  "focusMode": "web",
  "stream": false
}`;
    }
  };

  if (instanceMode === 'multi' && !currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-[#b8864d]/20 to-[#b8864d]/5 border border-[#b8864d]/30 flex items-center justify-center text-[#b8864d] shadow-sm">
          <KeyRound size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-black dark:text-[#f3d5ab] tracking-tight">
            {t('apiAccess.loginRequiredTitle') || 'Authentication Required'}
          </h2>
          <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 max-w-md mx-auto">
            {t('apiAccess.loginRequiredDesc') ||
              'API keys management, Playground, and integration snippets require an active user account.'}
          </p>
        </div>
        <button
          onClick={() => setIsLoginOpen(true)}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#996b3a] hover:from-[#c99558] hover:to-[#a87742] text-white font-medium text-xs shadow-md active:scale-95 transition"
        >
          <span>{t('auth.login') || 'Log in'}</span>
        </button>
        <LoginDialog
          isOpen={isLoginOpen}
          setIsOpen={setIsLoginOpen}
          currentUser={currentUser}
          onAuthChange={fetchCurrentUser}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-light-200 dark:border-[#221c16]">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#b8864d]/20 to-[#b8864d]/5 border border-[#b8864d]/30 text-[#b8864d] shadow-sm">
              <KeyRound size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-[#f3d5ab] tracking-tight">
                {t('apiAccess.title') || 'API Access & Developer Space'}
              </h1>
              <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mt-0.5">
                {t('apiAccess.subtitle') ||
                  'Manage API keys, test queries in the live Playground, and integrate Vane with your applications.'}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-light-200 dark:bg-[#161310] border border-light-200 dark:border-[#261f18] rounded-xl shadow-inner">
            <button
              onClick={() => setActiveTab('keys')}
              className={cn(
                'flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeTab === 'keys'
                  ? 'bg-white dark:bg-[#221c15] text-black dark:text-[#f3d5ab] shadow-sm'
                  : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
              )}
            >
              <KeyRound size={15} />
              <span>{t('apiAccess.tabKeys') || 'API Keys'}</span>
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#b8864d]/20 text-[#b8864d]">
                {apiKeys.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('playground')}
              className={cn(
                'flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeTab === 'playground'
                  ? 'bg-white dark:bg-[#221c15] text-black dark:text-[#f3d5ab] shadow-sm'
                  : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
              )}
            >
              <Play size={15} />
              <span>{t('apiAccess.tabPlayground') || 'Playground'}</span>
            </button>

            <button
              onClick={() => setActiveTab('snippets')}
              className={cn(
                'flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeTab === 'snippets'
                  ? 'bg-white dark:bg-[#221c15] text-black dark:text-[#f3d5ab] shadow-sm'
                  : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
              )}
            >
              <Code2 size={15} />
              <span>{t('apiAccess.tabSnippets') || 'Integration / Snippets'}</span>
            </button>
          </div>

          {activeTab === 'keys' && (
            <button
              onClick={() => {
                if (instanceMode === 'multi' && !currentUser) {
                  toast.error(t('auth.loginRequired') || 'Login required.');
                  setIsLoginOpen(true);
                  return;
                }
                setIsCreateDialogOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#996b3a] hover:from-[#c99558] hover:to-[#a87742] text-white font-medium text-xs shadow-md active:scale-95 transition duration-150"
            >
              <Plus size={16} />
              <span>{t('apiAccess.createNewKey') || 'Create New Key'}</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: API KEYS LIST */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          {/* Admin toggle if multi-user */}
          {isAdmin && instanceMode === 'multi' && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#b8864d]/10 border border-[#b8864d]/20 text-xs">
              <div className="flex items-center space-x-2 text-[#b8864d]">
                <ShieldCheck size={18} />
                <span className="font-semibold">{t('apiAccess.adminFilter') || 'Administrator View'}:</span>
                <span className="text-black/70 dark:text-stone-300">
                  {showAllUsersKeys
                    ? t('apiAccess.showingAllKeys') || 'Showing API keys for all system users.'
                    : t('apiAccess.showingMyKeys') || 'Showing only your personal API keys.'}
                </span>
              </div>
              <button
                onClick={() => setShowAllUsersKeys(!showAllUsersKeys)}
                className="px-3 py-1 bg-[#b8864d]/20 hover:bg-[#b8864d]/30 text-[#b8864d] font-medium rounded-lg transition"
              >
                {showAllUsersKeys
                  ? t('apiAccess.filterOnlyMine') || 'Show Only Mine'
                  : t('apiAccess.filterAllUsers') || 'Show All Users'}
              </button>
            </div>
          )}

          {/* Table Container */}
          <div className="rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#0c0a09]/80 overflow-hidden shadow-sm backdrop-blur-sm">
            {loadingKeys ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-[#b8864d]" />
                <p className="text-xs text-black/50 dark:text-stone-400">
                  {t('apiAccess.loadingKeys') || 'Loading API keys...'}
                </p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="py-16 px-4 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-[#b8864d]/10 border border-[#b8864d]/20 flex items-center justify-center text-[#b8864d]">
                  <KeyRound size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-black dark:text-[#f3d5ab]">
                    {t('apiAccess.noKeysTitle') || 'No Active API Keys'}
                  </h3>
                  <p className="text-xs text-black/50 dark:text-stone-400 max-w-md mx-auto">
                    {t('apiAccess.noKeysDesc') ||
                      'Create your first API key to get programmatic access to Vane search engine and test it in the Playground.'}
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#b8864d] hover:bg-[#a87742] text-white text-xs font-semibold transition"
                >
                  <Plus size={16} />
                  <span>{t('apiAccess.createNewKey') || 'Create New Key'}</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-light-200 dark:border-[#221c16] bg-light-200/50 dark:bg-[#161310]/60 text-black/60 dark:text-stone-400">
                      <th className="py-3 px-4 font-semibold">{t('apiAccess.thName') || 'Name / Prefix'}</th>
                      {instanceMode === 'multi' && (
                        <th className="py-3 px-4 font-semibold">{t('apiAccess.thOwner') || 'Owner'}</th>
                      )}
                      <th className="py-3 px-4 font-semibold">{t('apiAccess.thWaypoint') || 'Default Waypoint'}</th>
                      <th className="py-3 px-4 font-semibold">{t('apiAccess.thLimits') || 'Limits (Req/min)'}</th>
                      <th className="py-3 px-4 font-semibold">{t('apiAccess.thStatus') || 'Status'}</th>
                      <th className="py-3 px-4 font-semibold">{t('apiAccess.thLastUsed') || 'Last Used'}</th>
                      <th className="py-3 px-4 font-semibold text-right">{t('apiAccess.thActions') || 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-200/60 dark:divide-[#1d1712]">
                    {apiKeys.map((key) => {
                      const wp = waypoints.find((w) => w.id === key.defaultWaypointId);
                      return (
                        <tr
                          key={key.id}
                          className="hover:bg-light-200/30 dark:hover:bg-[#161310]/40 transition group"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-black dark:text-stone-200 text-sm">
                                {key.name}
                              </span>
                              <div className="flex items-center space-x-1 mt-0.5">
                                <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-light-200 dark:bg-[#1b1612] text-[#b8864d] border border-transparent dark:border-[#2c2217]">
                                  {key.keyPrefix}...
                                </code>
                              </div>
                            </div>
                          </td>

                          {instanceMode === 'multi' && (
                            <td className="py-3.5 px-4 text-black/70 dark:text-stone-300">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-medium">
                                  {key.user?.displayName || key.user?.username || key.userId}
                                </span>
                                {key.user?.role === 'admin' && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#b8864d]/20 text-[#b8864d]">
                                    Admin
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          <td className="py-3.5 px-4 text-black/70 dark:text-stone-300">
                            {wp ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-light-200 dark:bg-[#1a1510] text-[#b8864d] border border-light-200 dark:border-[#2a2016]">
                                {wp.name}
                              </span>
                            ) : (
                              <span className="text-black/40 dark:text-stone-500 italic">
                                {t('apiAccess.globalScope') || 'Global'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col text-[11px] space-y-0.5">
                              <span className="text-black dark:text-stone-300 font-medium">
                                {key.rateLimitPerMin ?? key.rateLimitPerMinute ?? 60} {t('apiAccess.reqPerMin') || 'req / min'}
                              </span>
                              {(key.dailyTokenLimit ?? key.tokenLimitPerDay) ? (
                                <span className="text-black/50 dark:text-stone-400">
                                  {t('apiAccess.dailyLimit') || 'Daily'}: {(key.dailyTokenLimit ?? key.tokenLimitPerDay)?.toLocaleString()} tok.
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                                key.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
                              )}
                            >
                              {key.status === 'active'
                                ? t('apiAccess.statusActive') || 'Active'
                                : t('apiAccess.statusSuspended') || 'Suspended'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-black/60 dark:text-stone-400 text-[11px]">
                            {key.lastUsedAt ? (
                              <span title={new Date(key.lastUsedAt).toLocaleString()}>
                                {formatTimeDifference(new Date(), key.lastUsedAt, locale)}
                              </span>
                            ) : (
                              <span className="text-black/30 dark:text-stone-600">
                                {t('apiAccess.neverUsed') || 'Never'}
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => {
                                  setPlaygroundKeyId(key.id);
                                  setActiveTab('playground');
                                }}
                                title={t('apiAccess.testInPlayground') || 'Test in Playground'}
                                className="p-1.5 rounded-lg text-[#b8864d] hover:bg-[#b8864d]/10 transition"
                              >
                                <Play size={15} />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(key)}
                                title={t('apiAccess.editLimits') || 'Edit Limits'}
                                className="p-1.5 rounded-lg text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200 hover:bg-light-200 dark:hover:bg-[#1e1914] transition"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => setDeletingKey(key)}
                                title={t('apiAccess.deleteKey') || 'Delete Key'}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#0c0a09]/50 space-y-2">
              <div className="flex items-center space-x-2 text-[#b8864d] font-semibold text-xs">
                <ShieldCheck size={16} />
                <span>{t('apiAccess.securityTitle') || 'Security & Encryption'}</span>
              </div>
              <p className="text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                {t('apiAccess.securityDesc') ||
                  'Keys are generated with 256-bit cryptographic entropy and stored as SHA-256 hashes.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#0c0a09]/50 space-y-2">
              <div className="flex items-center space-x-2 text-[#b8864d] font-semibold text-xs">
                <Zap size={16} />
                <span>{t('apiAccess.rateLimitsTitle') || 'Rate Limiting'}</span>
              </div>
              <p className="text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                {t('apiAccess.rateLimitsDesc') ||
                  'Sliding-window 60 req/min limit protects your instance from overload. Returns HTTP 429 when exceeded.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/40 dark:bg-[#0c0a09]/50 space-y-2">
              <div className="flex items-center space-x-2 text-[#b8864d] font-semibold text-xs">
                <Activity size={16} />
                <span>{t('apiAccess.statsIntegrationTitle') || 'Statistics Tracking'}</span>
              </div>
              <p className="text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                {t('apiAccess.statsIntegrationDesc') ||
                  'Every API query is tracked in Model Statistics with token counts and latency metrics.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: API PLAYGROUND */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Request Configuration */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#0c0a09]/80 shadow-sm backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between border-b border-light-200 dark:border-[#221c16] pb-3">
                <div className="flex items-center space-x-2 text-[#b8864d]">
                  <Sliders size={18} />
                  <h3 className="text-sm font-bold text-black dark:text-[#f3d5ab]">
                    {t('apiAccess.playgroundConfig') || 'Query Configuration'}
                  </h3>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
                  Secure Server Execution
                </span>
              </div>

              {/* API Key Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-black dark:text-stone-300">
                  {t('apiAccess.selectKeyLabel') || 'API Key for Authorization:'}
                </label>
                {apiKeys.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                    {t('apiAccess.noKeysPlayground') || 'No API keys available. Please create one in the API Keys tab.'}
                  </div>
                ) : (
                  <select
                    value={playgroundKeyId}
                    onChange={(e) => setPlaygroundKeyId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                  >
                    {apiKeys.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.keyPrefix}...) {k.status === 'suspended' ? `[${t('apiAccess.statusSuspended') || 'Suspended'}]` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Model & Provider */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-black dark:text-stone-300">
                    {t('apiAccess.providerLabel') || 'Model Provider:'}
                  </label>
                  <select
                    value={selectedProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                  >
                    {Object.keys(modelProviders).map((p) => (
                      <option key={p} value={p}>
                        {p.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-black dark:text-stone-300">
                    {t('apiAccess.modelLabel') || 'Model:'}
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                  >
                    {selectedProvider &&
                      modelProviders[selectedProvider] &&
                      Object.entries(modelProviders[selectedProvider]).map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Focus Mode & Optimization */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-black dark:text-stone-300">
                    {t('apiAccess.focusModeLabel') || 'Search Focus Mode:'}
                  </label>
                  <select
                    value={playgroundFocusMode}
                    onChange={(e) => setPlaygroundFocusMode(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                  >
                    <option value="web">{t('focusModes.web') || 'Web Search'}</option>
                    <option value="academic">{t('focusModes.academic') || 'Academic'}</option>
                    <option value="discussions">{t('focusModes.discussions') || 'Discussions'}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-black dark:text-stone-300">
                    {t('apiAccess.optimizationLabel') || 'Optimization:'}
                  </label>
                  <select
                    value={playgroundOptimization}
                    onChange={(e) => setPlaygroundOptimization(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                  >
                    <option value="speed">{t('apiAccess.optSpeed') || 'Speed (Fast)'}</option>
                    <option value="balanced">{t('apiAccess.optBalanced') || 'Balanced'}</option>
                    <option value="quality">{t('apiAccess.optQuality') || 'Deep Quality'}</option>
                  </select>
                </div>
              </div>

              {/* Waypoint Selector (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-black dark:text-stone-300">
                  {t('apiAccess.waypointOverrideLabel') || 'Waypoint / Space (Optional):'}
                </label>
                <select
                  value={playgroundWaypointId}
                  onChange={(e) => setPlaygroundWaypointId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                >
                  <option value="">{t('apiAccess.noWaypoint') || '-- None (Use Key Default) --'}</option>
                  {waypoints.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stream Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-light-200/40 dark:bg-[#161310] border border-light-200 dark:border-[#221c16]">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-black dark:text-stone-200">
                    {t('apiAccess.streamToggle') || 'Server-Sent Events (SSE) Streaming'}
                  </div>
                  <div className="text-[10px] text-black/50 dark:text-stone-400">
                    {t('apiAccess.streamToggleDesc') || 'Receive tokens and cited sources in real time'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={playgroundStream}
                  onChange={(e) => setPlaygroundStream(e.target.checked)}
                  className="h-4 w-4 rounded text-[#b8864d] focus:ring-[#b8864d] cursor-pointer"
                />
              </div>

              {/* Prompt Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-black dark:text-stone-300">
                  {t('apiAccess.queryPrompt') || 'Query Prompt:'}
                </label>
                <textarea
                  rows={4}
                  value={playgroundQuery}
                  onChange={(e) => setPlaygroundQuery(e.target.value)}
                  placeholder={t('apiAccess.queryPlaceholder') || 'Enter your search query or question here...'}
                  className="w-full text-xs p-3 rounded-xl bg-white dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d] resize-none"
                />
              </div>

              {/* Execute / Abort Buttons */}
              <div className="flex items-center space-x-2 pt-2">
                {isRunningPlayground ? (
                  <button
                    onClick={handleStopPlayground}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition shadow-md"
                  >
                    <StopCircle size={16} />
                    <span>{t('apiAccess.stopExecution') || 'Stop Execution'}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleRunPlayground}
                    disabled={!playgroundKeyId}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#996b3a] hover:from-[#c99558] hover:to-[#a87742] disabled:opacity-50 text-white font-semibold text-xs transition shadow-md active:scale-95"
                  >
                    <Send size={15} />
                    <span>{t('apiAccess.runPlayground') || 'Send API Query'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Live Response Console & Telemetry */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#0c0a09]/80 shadow-sm backdrop-blur-sm flex flex-col h-full min-h-[500px]">
              {/* Output Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-light-200 dark:border-[#221c16] pb-3">
                <div className="flex items-center space-x-2">
                  <Terminal size={17} className="text-[#b8864d]" />
                  <span className="text-xs font-bold text-black dark:text-[#f3d5ab]">
                    {t('apiAccess.liveResponse') || 'Live Response Console'}
                  </span>
                </div>

                {/* Sub-tabs for output view */}
                <div className="flex items-center space-x-1 p-1 rounded-lg bg-light-200 dark:bg-[#161310] border border-light-200 dark:border-[#221c16]">
                  <button
                    onClick={() => setPlaygroundViewMode('formatted')}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-semibold transition',
                      playgroundViewMode === 'formatted'
                        ? 'bg-white dark:bg-[#221c15] text-[#b8864d] shadow-sm'
                        : 'text-black/50 dark:text-stone-400',
                    )}
                  >
                    {t('apiAccess.tabFormatted') || 'Formatted / Text'}
                  </button>
                  <button
                    onClick={() => setPlaygroundViewMode('sources')}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-semibold transition',
                      playgroundViewMode === 'sources'
                        ? 'bg-white dark:bg-[#221c15] text-[#b8864d] shadow-sm'
                        : 'text-black/50 dark:text-stone-400',
                    )}
                  >
                    {t('apiAccess.tabSources') || 'Sources'} ({playgroundSources.length})
                  </button>
                  <button
                    onClick={() => setPlaygroundViewMode('raw')}
                    className={cn(
                      'px-2.5 py-1 rounded text-[10px] font-semibold transition',
                      playgroundViewMode === 'raw'
                        ? 'bg-white dark:bg-[#221c15] text-[#b8864d] shadow-sm'
                        : 'text-black/50 dark:text-stone-400',
                    )}
                  >
                    {t('apiAccess.tabRawStream') || 'Raw SSE'}
                  </button>
                </div>
              </div>

              {/* Telemetry Bar */}
              {playgroundMetrics && (
                <div className="flex flex-wrap items-center gap-3 my-3 p-2.5 rounded-xl bg-light-200/50 dark:bg-[#161310]/80 border border-light-200 dark:border-[#221c16] text-[11px]">
                  <div className="flex items-center space-x-1 text-black/70 dark:text-stone-300">
                    <Clock size={13} className="text-[#b8864d]" />
                    <span>{t('apiAccess.timeLabel') || 'Time'}: <strong>{playgroundMetrics.durationMs} ms</strong></span>
                  </div>
                  <div className="flex items-center space-x-1 text-black/70 dark:text-stone-300">
                    <Activity size={13} className="text-emerald-500" />
                    <span>Status: <strong>HTTP {playgroundMetrics.status}</strong></span>
                  </div>
                  {playgroundMetrics.rateLimitRemaining && (
                    <div className="flex items-center space-x-1 text-black/70 dark:text-stone-300">
                      <Zap size={13} className="text-amber-500" />
                      <span>{t('apiAccess.rateLimitRemainingLabel') || 'RateLimit Remaining'}: <strong>{playgroundMetrics.rateLimitRemaining}</strong></span>
                    </div>
                  )}
                </div>
              )}

              {/* Output Content Area */}
              <div className="flex-1 overflow-y-auto mt-2 p-3 rounded-xl bg-white dark:bg-[#070605] border border-light-200 dark:border-[#1d1712] font-mono text-xs">
                {playgroundViewMode === 'formatted' && (
                  <div className="text-black dark:text-stone-200 font-sans leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                    {playgroundOutput ? (
                      <Markdown>{playgroundOutput}</Markdown>
                    ) : isRunningPlayground ? (
                      <div className="flex items-center space-x-2 text-black/50 dark:text-stone-500 italic not-prose">
                        <RefreshCw size={14} className="animate-spin text-[#b8864d]" />
                        <span>{t('apiAccess.generatingStream') || 'Waiting for tokens and stream from API...'}</span>
                      </div>
                    ) : (
                      <span className="text-black/30 dark:text-stone-600 italic not-prose">
                        {t('apiAccess.playgroundReady') || 'Console ready. Click "Send API Query" to run the test.'}
                      </span>
                    )}
                  </div>
                )}

                {playgroundViewMode === 'sources' && (
                  <div className="space-y-3 font-sans">
                    {playgroundSources.length === 0 ? (
                      <span className="text-black/30 dark:text-stone-600 italic">
                        {t('apiAccess.noSourcesFound') || 'No sources found for this response.'}
                      </span>
                    ) : (
                      playgroundSources.map((source, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-light-200/50 dark:bg-[#14100c] border border-light-200 dark:border-[#221c16] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-black dark:text-stone-200">
                              {source.title || source.name || `${t('apiAccess.sourceLabel') || 'Source'} #${idx + 1}`}
                            </span>
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-[#b8864d] hover:underline flex items-center space-x-0.5"
                              >
                                <span>{t('apiAccess.openSource') || 'Open'}</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                          {source.snippet && (
                            <p className="text-[11px] text-black/60 dark:text-stone-400">
                              {source.snippet}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {playgroundViewMode === 'raw' && (
                  <div className="space-y-1 text-[11px] text-emerald-600 dark:text-emerald-400 overflow-x-auto">
                    {playgroundRawChunks.length === 0 ? (
                      <span className="text-black/30 dark:text-stone-600 italic font-sans">
                        {t('apiAccess.noRawChunks') || 'No raw SSE chunks received yet.'}
                      </span>
                    ) : (
                      playgroundRawChunks.map((chunk, i) => (
                        <div key={i} className="border-b border-light-200/40 dark:border-[#1e1914] pb-1">
                          {chunk}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRATION SNIPPETS & DOCS */}
      {activeTab === 'snippets' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Snippet Selector & Code */}
            <div className="lg:col-span-8 space-y-4">
              <div className="p-5 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#0c0a09]/80 shadow-sm backdrop-blur-sm space-y-4">
                {/* Language Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-light-200 dark:border-[#221c16] pb-3">
                  <div className="flex items-center space-x-2">
                    <Code2 size={18} className="text-[#b8864d]" />
                    <span className="text-sm font-bold text-black dark:text-[#f3d5ab]">
                      {t('apiAccess.generatorTitle') || 'Integration Code Generator'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 p-1 rounded-xl bg-light-200 dark:bg-[#161310] border border-light-200 dark:border-[#221c16]">
                    {(['curl', 'python', 'javascript', 'n8n'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setSnippetLanguage(lang)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-semibold capitalize transition',
                          snippetLanguage === lang
                            ? 'bg-white dark:bg-[#221c15] text-[#b8864d] shadow-sm'
                            : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
                        )}
                      >
                        {lang === 'javascript' ? 'Node.js' : lang}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Block Container */}
                <div className="relative rounded-xl overflow-hidden border border-light-200 dark:border-[#221c16] bg-[#0c0a09]">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#161310] border-b border-[#221c16] text-[11px] text-stone-400 font-mono">
                    <span>{snippetLanguage.toUpperCase()} {t('apiAccess.snippetLabel') || 'Snippet'}</span>
                    <button
                      onClick={() => copyToClipboard(generateSnippetCode(), setCopiedSnippet)}
                      className="flex items-center space-x-1 px-2 py-1 rounded bg-[#221c15] hover:bg-[#2c2217] text-[#f3d5ab] transition"
                    >
                      {copiedSnippet ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      <span>{copiedSnippet ? (t('apiAccess.copiedToClipboard') || 'Copied!') : (t('common.copy') || t('chat.copy') || 'Copy')}</span>
                    </button>
                  </div>

                  <pre className="p-4 text-xs font-mono text-stone-200 overflow-x-auto leading-relaxed">
                    <code>{generateSnippetCode()}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Quick Reference / Docs Info */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-5 rounded-2xl border border-light-200 dark:border-[#221c16] bg-light-secondary/60 dark:bg-[#0c0a09]/80 shadow-sm backdrop-blur-sm space-y-4">
                <div className="flex items-center space-x-2 text-[#b8864d] font-bold text-sm">
                  <Database size={18} />
                  <span>{t('apiAccess.endpointSpecTitle') || 'Endpoint Specification'}</span>
                </div>

                <div className="space-y-3 text-xs text-black/70 dark:text-stone-300">
                  <div className="p-3 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#221c16] space-y-1">
                    <span className="font-semibold text-black dark:text-stone-200">POST /api/search</span>
                    <p className="text-[11px] text-black/60 dark:text-stone-400">
                      {t('apiAccess.specSummary') || 'Main entry point for AI-powered real-time web search, reasoning, and source citations.'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-black dark:text-stone-200">
                      {t('apiAccess.requiredHeadersTitle') || 'Required Headers:'}
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-black/60 dark:text-stone-400">
                      <li><code>Authorization: Bearer vane_sk_...</code> {t('apiAccess.orLabel') || 'or'} <code>x-api-key: vane_sk_...</code></li>
                      <li><code>Content-Type: application/json</code></li>
                    </ul>
                  </div>

                  <div className="space-y-1">
                    <span className="font-semibold text-black dark:text-stone-200">
                      {t('apiAccess.responseCodesTitle') || 'HTTP Response Codes:'}
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-black/60 dark:text-stone-400">
                      <li><code>200 OK</code> – {t('apiAccess.code200Desc') || 'Request processed successfully (JSON payload or SSE token stream).'}</li>
                      <li><code>401 Unauthorized</code> – {t('apiAccess.code401Desc') || 'Missing, invalid, or expired API key.'}</li>
                      <li><code>403 Forbidden</code> – {t('apiAccess.code403Desc') || 'API key is suspended, lacks permission, or access is blocked.'}</li>
                      <li><code>429 Too Many Requests</code> – {t('apiAccess.code429Desc') || 'Rate limit or daily token quota exceeded.'}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: CREATE API KEY */}
      <Transition appear show={isCreateDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsCreateDialogOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#120f0c] p-6 text-left align-middle shadow-2xl border border-light-200 dark:border-[#29221a] transition-all space-y-5">
                  <DialogTitle as="h3" className="text-base font-bold text-black dark:text-[#f3d5ab] flex items-center space-x-2">
                    <KeyRound size={20} className="text-[#b8864d]" />
                    <span>{t('apiAccess.createModalTitle') || 'New API Key'}</span>
                  </DialogTitle>

                  <form onSubmit={handleCreateKey} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-black dark:text-stone-300">
                        {t('apiAccess.keyNameLabel') || 'Key Name (e.g. n8n Automation, Python App):'} *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t('apiAccess.keyNamePlaceholder') || 'e.g. n8n Analytics Workflow'}
                        value={createForm.name}
                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-black dark:text-stone-300">
                        {t('apiAccess.defaultWaypointLabel') || 'Default Waypoint / Knowledge Space (Optional):'}
                      </label>
                      <select
                        value={createForm.defaultWaypointId}
                        onChange={(e) => setCreateForm({ ...createForm, defaultWaypointId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                      >
                        <option value="">{t('apiAccess.noDefaultWaypoint') || '-- None (Global Access) --'}</option>
                        {waypoints.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-black dark:text-stone-300">
                          {t('apiAccess.rateLimitLabel') || 'Rate Limit (req / min):'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={createForm.rateLimitPerMin}
                          onChange={(e) => setCreateForm({ ...createForm, rateLimitPerMin: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-semibold text-black dark:text-stone-300">
                          {t('apiAccess.dailyTokenLimitLabel') || 'Daily Token Limit (optional):'}
                        </label>
                        <input
                          type="number"
                          placeholder={t('apiAccess.dailyTokenLimitPlaceholder') || 'e.g. 500000 (empty = unlimited)'}
                          value={createForm.dailyTokenLimit}
                          onChange={(e) => setCreateForm({ ...createForm, dailyTokenLimit: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-4 border-t border-light-200 dark:border-[#221c16]">
                      <button
                        type="button"
                        onClick={() => setIsCreateDialogOpen(false)}
                        className="px-4 py-2 rounded-xl bg-light-200 dark:bg-[#1c1713] text-black dark:text-stone-300 hover:bg-light-200/80 transition"
                      >
                        {t('apiAccess.cancel') || 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingKey}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#996b3a] hover:from-[#c99558] text-white font-semibold shadow-md transition disabled:opacity-50"
                      >
                        {isCreatingKey ? (t('apiAccess.creating') || 'Creating...') : (t('apiAccess.createKeyButton') || 'Create Key')}
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* MODAL 2: REVEAL CREATED KEY (ONCE) */}
      <Transition appear show={!!newlyCreatedKey} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setNewlyCreatedKey(null)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#120f0c] p-6 text-left align-middle shadow-2xl border border-[#b8864d]/40 transition-all space-y-4">
                  <DialogTitle as="h3" className="text-base font-bold text-black dark:text-[#f3d5ab] flex items-center space-x-2">
                    <Sparkles size={20} className="text-[#b8864d]" />
                    <span>{t('apiAccess.keyCreatedModalTitle') || 'API Key Created Successfully!'}</span>
                  </DialogTitle>

                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start space-x-2">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">
                        {t('apiAccess.saveSecretWarning') || 'Save this key now!'}
                      </strong>
                      <span>
                        {t('apiAccess.saveSecretDesc') ||
                          'For security reasons, the raw API key is hashed and cannot be viewed again once closed.'}
                      </span>
                    </div>
                  </div>

                  {/* Key Display & Copy */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-black dark:text-stone-300">
                      {t('apiAccess.yourSecretKey') || 'Your Secret API Key:'}
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 flex items-center px-3 py-2.5 rounded-xl bg-light-200 dark:bg-[#070605] border border-light-200 dark:border-[#221c16] font-mono text-xs text-[#b8864d]">
                        <span className="flex-1 select-all break-all">
                          {showRawKeySecret
                            ? newlyCreatedKey?.rawKey
                            : '••••••••••••••••••••••••••••••••••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowRawKeySecret(!showRawKeySecret)}
                          className="ml-2 text-stone-400 hover:text-stone-200"
                        >
                          {showRawKeySecret ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>

                      <button
                        onClick={() =>
                          newlyCreatedKey &&
                          copyToClipboard(newlyCreatedKey.rawKey, setIsCopiedNewKey)
                        }
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#996b3a] hover:from-[#c99558] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md active:scale-95 transition"
                      >
                        {isCopiedNewKey ? <Check size={16} /> : <Copy size={16} />}
                        <span>{isCopiedNewKey ? (t('apiAccess.copiedToClipboard') || t('common.copied') || 'Copied!') : (t('common.copy') || t('chat.copy') || 'Copy')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      onClick={() => setNewlyCreatedKey(null)}
                      className="px-5 py-2 rounded-xl bg-light-200 dark:bg-[#221c15] text-black dark:text-[#f3d5ab] font-semibold text-xs hover:bg-light-200/80 transition"
                    >
                      {t('apiAccess.doneClose') || 'I saved it, Close'}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* MODAL 3: EDIT API KEY */}
      <Transition appear show={!!editingKey} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setEditingKey(null)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-[#120f0c] p-6 text-left align-middle shadow-2xl border border-light-200 dark:border-[#29221a] transition-all space-y-5">
                  <DialogTitle as="h3" className="text-base font-bold text-black dark:text-[#f3d5ab] flex items-center space-x-2">
                    <Edit2 size={18} className="text-[#b8864d]" />
                    <span>{t('apiAccess.editModalTitle') || 'Edit API Key'}</span>
                  </DialogTitle>

                  <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-black dark:text-stone-300">
                        {t('apiAccess.keyNameLabel') || 'Key Name:'}
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-black dark:text-stone-300">
                        {t('apiAccess.statusLabel') || 'Key Status:'}
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                      >
                        <option value="active">{t('apiAccess.statusActive') || 'Active'}</option>
                        <option value="suspended">{t('apiAccess.statusSuspended') || 'Suspended (Blocked)'}</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-semibold text-black dark:text-stone-300">
                        {t('apiAccess.defaultWaypointLabel') || 'Default Waypoint:'}
                      </label>
                      <select
                        value={editForm.defaultWaypointId}
                        onChange={(e) => setEditForm({ ...editForm, defaultWaypointId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                      >
                        <option value="">{t('apiAccess.noDefaultWaypoint') || '-- None (Global Access) --'}</option>
                        {waypoints.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-black dark:text-stone-300">
                          {t('apiAccess.rateLimitLabel') || 'Rate Limit (req / min):'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={editForm.rateLimitPerMin}
                          onChange={(e) => setEditForm({ ...editForm, rateLimitPerMin: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="font-semibold text-black dark:text-stone-300">
                          {t('apiAccess.dailyTokenLimitLabel') || 'Daily Token Limit (optional):'}
                        </label>
                        <input
                          type="number"
                          placeholder={t('apiAccess.noLimitPlaceholder') || 'Unlimited'}
                          value={editForm.dailyTokenLimit}
                          onChange={(e) => setEditForm({ ...editForm, dailyTokenLimit: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-light-200/50 dark:bg-[#161310] border border-light-200 dark:border-[#29221a] text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-4 border-t border-light-200 dark:border-[#221c16]">
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        className="px-4 py-2 rounded-xl bg-light-200 dark:bg-[#1c1713] text-black dark:text-stone-300 hover:bg-light-200/80 transition"
                      >
                        {t('apiAccess.cancel') || 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={isEditingKey}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#b8864d] to-[#996b3a] hover:from-[#c99558] text-white font-semibold shadow-md transition disabled:opacity-50"
                      >
                        {isEditingKey ? (t('apiAccess.saving') || 'Saving...') : (t('apiAccess.save') || 'Save Changes')}
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* MODAL 4: DELETE KEY CONFIRMATION */}
      <Transition appear show={!!deletingKey} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDeletingKey(null)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          </TransitionChild>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <TransitionChild
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#120f0c] p-6 text-left align-middle shadow-2xl border border-red-500/30 transition-all space-y-4">
                  <DialogTitle as="h3" className="text-base font-bold text-red-500 flex items-center space-x-2">
                    <Trash2 size={20} />
                    <span>{t('apiAccess.deleteConfirmTitle') || 'Delete API Key?'}</span>
                  </DialogTitle>

                  <p className="text-xs text-black/70 dark:text-stone-300 leading-relaxed">
                    {t('apiAccess.deleteConfirmDesc', {
                      name: deletingKey?.name || '',
                      prefix: deletingKey?.keyPrefix || '',
                    }) ||
                      `Are you sure you want to permanently delete API key ${deletingKey?.name} (${deletingKey?.keyPrefix}...)? All connected apps will immediately lose access.`}
                  </p>

                  <div className="flex items-center justify-end space-x-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setDeletingKey(null)}
                      className="px-4 py-2 rounded-xl bg-light-200 dark:bg-[#1c1713] text-black dark:text-stone-300 hover:bg-light-200/80 transition text-xs"
                    >
                      {t('apiAccess.cancel') || 'Cancel'}
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingKey}
                      onClick={handleConfirmDelete}
                      className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                    >
                      {isDeletingKey ? (t('apiAccess.deleting') || 'Deleting...') : (t('apiAccess.confirmDelete') || 'Delete')}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Login Dialog Fallback */}
      <LoginDialog
        isOpen={isLoginOpen}
        setIsOpen={setIsLoginOpen}
        currentUser={currentUser}
        onAuthChange={fetchCurrentUser}
      />
    </div>
  );
}
