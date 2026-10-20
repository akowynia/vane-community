'use client';

import React, { useState, useEffect } from 'react';
import {
  Plug,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Globe,
  Copy,
  Check,
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { MCPServerConfig, MCPServerStatus } from '@/lib/mcp/types';
import { MCPLogRecord } from '@/lib/db/schema';
import { MCPUsageStats } from '@/lib/mcp/logger';

const MCPSection = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'servers' | 'logs'>('servers');

  // Servers state
  const [servers, setServers] = useState<MCPServerConfig[]>([]);
  const [statuses, setStatuses] = useState<Record<string, MCPServerStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTransport, setFormTransport] = useState<'stdio' | 'sse'>('stdio');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formAutoApprove, setFormAutoApprove] = useState(true);

  // Logs and Stats state
  const [logs, setLogs] = useState<MCPLogRecord[]>([]);
  const [stats, setStats] = useState<MCPUsageStats | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Log filters
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/mcp/servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        const statusMap: Record<string, MCPServerStatus> = {};
        for (const st of data.statuses || []) {
          statusMap[st.serverId] = st;
        }
        setStatuses(statusMap);
      }
    } catch (err: any) {
      console.error('Error loading MCP servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setIsLogsLoading(true);
      const params = new URLSearchParams();
      if (directionFilter !== 'all') params.set('direction', directionFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '60');

      const res = await fetch(`/api/mcp/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setStats(data.stats || null);
        setTotalLogs(data.total || 0);
      }
    } catch (err: any) {
      console.error('Error loading MCP logs:', err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'servers') {
      loadServers();
    } else {
      loadLogs();
    }
  }, [activeTab, directionFilter, statusFilter]);

  const handleClearLogs = async () => {
    if (!window.confirm(t('mcp.clearLogsConfirm') || 'Are you sure you want to clear all MCP activity logs?')) {
      return;
    }
    try {
      const res = await fetch('/api/mcp/logs', { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('mcp.logsCleared') || 'Activity logs cleared');
        loadLogs();
      } else {
        toast.error('Failed to clear logs');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to clear logs');
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error(t('mcp.nameRequired') || 'Server name is required');
      return;
    }

    const payload: Partial<MCPServerConfig> = {
      name: formName.trim(),
      transport: formTransport,
      command: formTransport === 'stdio' ? formCommand.trim() : undefined,
      args: formTransport === 'stdio' && formArgs.trim() ? formArgs.split(' ') : undefined,
      url: formTransport === 'sse' ? formUrl.trim() : undefined,
      autoApprove: formAutoApprove,
      enabled: true,
    };

    try {
      const res = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(t('mcp.serverAdded') || 'MCP server added successfully');
        setIsAddOpen(false);
        setFormName('');
        setFormCommand('');
        setFormArgs('');
        setFormUrl('');
        loadServers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || 'Failed to add MCP server');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add MCP server');
    }
  };

  const handleDeleteServer = async (id: string) => {
    try {
      const res = await fetch(`/api/mcp/servers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(t('mcp.serverDeleted') || 'MCP server deleted');
        setServers(servers.filter((s) => s.id !== id));
      } else {
        toast.error('Failed to delete server');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete server');
    }
  };

  const handleToggleServer = async (server: MCPServerConfig) => {
    try {
      const res = await fetch(`/api/mcp/servers/${server.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !server.enabled }),
      });
      if (res.ok) {
        setServers(
          servers.map((s) => (s.id === server.id ? { ...s, enabled: !s.enabled } : s)),
        );
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update server');
    }
  };

  const copyServerUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/api/mcp`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedEndpoint(true);
    toast.success(t('mcp.endpointCopied') || 'MCP Server endpoint copied to clipboard');
    setTimeout(() => setCopiedEndpoint(false), 2000);
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      {/* Banner */}
      <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent p-4 sm:p-5 flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-500 shrink-0">
          <Plug className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('settings.mcpBannerTitle') || 'Model Context Protocol (MCP) Ecosystem'}
            </h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold uppercase tracking-wider">
              MCP
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
            {t('settings.mcpBannerDesc') ||
              'Connect external tools (filesystems, databases, GitHub, CLI commands) directly to the AI research agent, or expose Vane search as an MCP server for external clients.'}
          </p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-light-200 dark:border-[#2d251d] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('servers')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
            activeTab === 'servers'
              ? 'bg-[#b8864d] text-white shadow-sm'
              : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Plug size={14} />
          <span>{t('mcp.tabServers') || 'Servers & Tools'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 dark:bg-white/10">
            {servers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition ${
            activeTab === 'logs'
              ? 'bg-[#b8864d] text-white shadow-sm'
              : 'text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Activity size={14} />
          <span>{t('mcp.tabLogs') || 'Activity Log & Usage'}</span>
          {stats && stats.totalCalls > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 dark:bg-white/10">
              {stats.totalCalls}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'servers' ? (
        <>
          {/* Vane MCP Server Info Card */}
          <div className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/40 dark:bg-[#181411] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-black dark:text-stone-200">
                {t('mcp.serverEndpointTitle') || 'Vane MCP Server Endpoint'}
              </span>
              <p className="text-[11px] text-black/50 dark:text-stone-400 mt-0.5">
                {t('mcp.serverEndpointDesc') || 'Use this URL in Claude Desktop or Cursor to access Vane search.'}
              </p>
            </div>
            <button
              type="button"
              onClick={copyServerUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-light-200 dark:border-[#2d251d] bg-light-primary dark:bg-[#201a15] text-xs font-mono text-[#b8864d] hover:bg-[#b8864d]/10 transition"
            >
              {copiedEndpoint ? <Check size={13} /> : <Copy size={13} />}
              <span>/api/mcp</span>
            </button>
          </div>

          {/* Header & Add Button */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <h3 className="text-sm font-semibold text-black dark:text-stone-100">
                {t('mcp.connectedServers') || 'Configured MCP Servers'}
              </h3>
              <p className="text-xs text-black/50 dark:text-stone-400">
                {t('mcp.connectedServersDesc') || 'Manage external tool providers and transport connections.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#b8864d] hover:bg-[#a6743b] rounded-xl transition shadow-sm"
            >
              <Plus size={14} />
              <span>{t('mcp.addServer') || 'Add Server'}</span>
            </button>
          </div>

          {/* Servers List */}
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-black/40 dark:text-stone-500">
              <RefreshCw className="w-5 h-5 animate-spin mb-2" />
              <span className="text-xs">{t('common.loading') || 'Loading...'}</span>
            </div>
          ) : servers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-light-200 dark:border-[#2d251d] p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-light-secondary dark:bg-[#201a15] flex items-center justify-center mx-auto mb-3 text-black/40 dark:text-stone-500">
                <Plug size={18} />
              </div>
              <p className="text-xs text-black/60 dark:text-stone-400 max-w-sm mx-auto">
                {t('mcp.noServers') || 'No MCP servers configured yet. Add your first server to connect tools.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {servers.map((server) => {
                const status = statuses[server.id];
                return (
                  <div
                    key={server.id}
                    className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/30 dark:bg-[#181411] p-4 flex items-center justify-between gap-4 transition hover:border-[#b8864d]/40"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="p-2.5 rounded-xl bg-light-primary dark:bg-[#201a15] border border-light-200 dark:border-[#2d251d] text-black/70 dark:text-stone-300 shrink-0">
                        {server.transport === 'stdio' ? <Terminal size={16} /> : <Globe size={16} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-black dark:text-stone-100 truncate">
                            {server.name}
                          </h4>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 text-black/60 dark:text-stone-400 uppercase">
                            {server.transport}
                          </span>
                        </div>
                        <p className="text-[11px] text-black/50 dark:text-stone-400 font-mono mt-0.5 truncate max-w-md">
                          {server.transport === 'stdio'
                            ? `${server.command} ${(server.args || []).join(' ')}`
                            : server.url}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {status?.status === 'connected' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 size={12} />
                              <span>{status.toolsCount} {t('mcp.toolsAvailable') || 'tools'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                              <AlertCircle size={12} />
                              <span>{status?.error || t('mcp.disconnected') || 'Unavailable'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleServer(server)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                          server.enabled
                            ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                            : 'border-black/10 dark:border-white/10 text-black/40 dark:text-stone-500 bg-black/5 dark:bg-white/5'
                        }`}
                      >
                        {server.enabled ? t('common.enabled') || 'Active' : t('common.disabled') || 'Disabled'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteServer(server.id)}
                        className="p-1.5 text-black/40 dark:text-stone-500 hover:text-red-500 rounded-lg transition"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ================= ACTIVITY LOGS & USAGE TAB ================= */
        <div className="space-y-6">
          {/* Aggregate Metrics Cards */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Calls */}
              <div className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/40 dark:bg-[#181411] p-3.5">
                <div className="flex items-center justify-between text-black/50 dark:text-stone-400 mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    {t('mcp.totalCalls') || 'Total Invocations'}
                  </span>
                  <Activity size={14} className="text-[#b8864d]" />
                </div>
                <div className="text-xl font-bold text-black dark:text-stone-100">
                  {stats.totalCalls}
                </div>
                <div className="text-[10px] text-black/40 dark:text-stone-500 mt-1">
                  ↓ {stats.inboundCalls} {t('mcp.directionInbound') || 'Inbound'} • ↑ {stats.outboundCalls} {t('mcp.directionOutbound') || 'Outbound'}
                </div>
              </div>

              {/* Success Rate */}
              <div className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/40 dark:bg-[#181411] p-3.5">
                <div className="flex items-center justify-between text-black/50 dark:text-stone-400 mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    {t('mcp.successRate') || 'Success Rate'}
                  </span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="text-xl font-bold text-black dark:text-stone-100">
                  {stats.successRate}%
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.successCount} {t('common.success') || 'OK'} / {stats.errorCount} {t('common.error') || 'Errors'}
                </div>
              </div>

              {/* Avg Latency */}
              <div className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/40 dark:bg-[#181411] p-3.5">
                <div className="flex items-center justify-between text-black/50 dark:text-stone-400 mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    {t('mcp.avgLatency') || 'Average Latency'}
                  </span>
                  <Clock size={14} className="text-sky-500" />
                </div>
                <div className="text-xl font-bold text-black dark:text-stone-100">
                  {stats.avgDurationMs} <span className="text-xs font-normal text-black/50 dark:text-stone-400">ms</span>
                </div>
                <div className="text-[10px] text-black/40 dark:text-stone-500 mt-1">
                  {t('mcp.durationLabel') || 'Duration per call'}
                </div>
              </div>

              {/* Top Caller & Tool */}
              <div className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/40 dark:bg-[#181411] p-3.5">
                <div className="flex items-center justify-between text-black/50 dark:text-stone-400 mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    {t('mcp.callerLabel') || 'Top Caller'}
                  </span>
                  <Users size={14} className="text-amber-500" />
                </div>
                <div className="text-sm font-semibold text-black dark:text-stone-100 truncate">
                  {stats.topCallers[0]?.name || 'N/A'}
                </div>
                <div className="text-[10px] text-black/50 dark:text-stone-400 mt-1 truncate">
                  Top tool: <span className="font-mono text-[#b8864d]">{stats.topTools[0]?.name || 'None'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Filters & Actions Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* Direction Filter */}
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#181411] text-xs text-black/70 dark:text-stone-300 focus:outline-none focus:border-[#b8864d]"
              >
                <option value="all">{t('mcp.filterAll') || 'All Directions'}</option>
                <option value="inbound">{t('mcp.filterInbound') || 'Inbound (Server)'}</option>
                <option value="outbound">{t('mcp.filterOutbound') || 'Outbound (Tools)'}</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#181411] text-xs text-black/70 dark:text-stone-300 focus:outline-none focus:border-[#b8864d]"
              >
                <option value="all">{t('mcp.filterStatusAll') || 'All Statuses'}</option>
                <option value="success">{t('mcp.filterStatusSuccess') || 'Success only'}</option>
                <option value="error">{t('mcp.filterStatusError') || 'Errors only'}</option>
              </select>

              {/* Search Bar */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-stone-500" />
                <input
                  type="text"
                  placeholder={t('common.search') || 'Search logs...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                  className="pl-8 pr-3 py-1.5 rounded-lg border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#181411] text-xs text-black dark:text-stone-200 focus:outline-none focus:border-[#b8864d] w-48 sm:w-56"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadLogs}
                disabled={isLogsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-light-200 dark:border-[#2d251d] bg-light-secondary dark:bg-[#201a15] text-xs text-black/70 dark:text-stone-300 hover:text-[#b8864d] transition"
              >
                <RefreshCw size={13} className={isLogsLoading ? 'animate-spin' : ''} />
                <span>{t('mcp.refreshLogs') || 'Refresh'}</span>
              </button>

              <button
                type="button"
                onClick={handleClearLogs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 text-xs transition"
              >
                <Trash2 size={13} />
                <span>{t('mcp.clearLogs') || 'Clear Logs'}</span>
              </button>
            </div>
          </div>

          {/* Activity Logs List */}
          {isLogsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-black/40 dark:text-stone-500">
              <RefreshCw className="w-5 h-5 animate-spin mb-2" />
              <span className="text-xs">{t('common.loading') || 'Loading logs...'}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-light-200 dark:border-[#2d251d] p-8 text-center">
              <Activity className="w-8 h-8 text-black/30 dark:text-stone-600 mx-auto mb-2" />
              <p className="text-xs text-black/60 dark:text-stone-400">
                {t('mcp.noLogs') || 'No MCP activity recorded yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const formattedDate = new Date(log.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/30 dark:bg-[#181411] transition hover:border-[#b8864d]/30 overflow-hidden"
                  >
                    <div
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Direction Badge */}
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            log.direction === 'inbound'
                              ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30'
                              : 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
                          }`}
                        >
                          {log.direction === 'inbound' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-black dark:text-stone-100 font-mono">
                              {log.toolName || log.method}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full ${
                                log.direction === 'inbound'
                                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                  : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              {log.direction}
                            </span>
                            <span className="text-[10px] text-black/50 dark:text-stone-400 font-mono">
                              {log.serverName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-black/50 dark:text-stone-400 mt-1 flex-wrap">
                            <span>{t('mcp.callerLabel') || 'Caller'}: <strong className="text-black/80 dark:text-stone-300">{log.apiKeyName || log.callerUser || 'Anonymous'}</strong></span>
                            {log.clientIp && <span>• IP: {log.clientIp}</span>}
                            {log.userAgent && (
                              <span className="truncate max-w-[200px]" title={log.userAgent}>
                                • {log.userAgent}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <span className="text-[11px] text-black/40 dark:text-stone-500">
                          {formattedDate}
                        </span>

                        <span className="text-xs font-mono text-black/60 dark:text-stone-400">
                          {log.durationMs}ms
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            log.status === 'success'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                          }`}
                        >
                          {log.status === 'success' ? 'OK' : 'ERROR'}
                        </span>

                        {isExpanded ? <ChevronUp size={14} className="text-black/40 dark:text-stone-500" /> : <ChevronDown size={14} className="text-black/40 dark:text-stone-500" />}
                      </div>
                    </div>

                    {/* Expanded Payload & Result details */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-light-200 dark:border-[#2d251d] bg-black/[0.02] dark:bg-black/20 space-y-3">
                        {/* Output or Error Summary */}
                        {log.outputSummary && (
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-black/50 dark:text-stone-400 block mb-1">
                              {t('mcp.outputResult') || 'Result / Output'}
                            </span>
                            <div className="p-2.5 rounded-lg bg-light-primary dark:bg-[#130f0c] border border-light-200 dark:border-[#2d251d] text-xs font-mono text-black/80 dark:text-stone-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {log.outputSummary}
                            </div>
                          </div>
                        )}

                        {log.errorMessage && (
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-red-500 block mb-1">
                              {t('common.error') || 'Error Message'}
                            </span>
                            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-600 dark:text-red-400 whitespace-pre-wrap">
                              {log.errorMessage}
                            </div>
                          </div>
                        )}

                        {/* Input Arguments */}
                        {log.inputPayload && (
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-black/50 dark:text-stone-400 block mb-1">
                              {t('mcp.inputArgs') || 'Input Arguments'}
                            </span>
                            <pre className="p-2.5 rounded-lg bg-light-primary dark:bg-[#130f0c] border border-light-200 dark:border-[#2d251d] text-xs font-mono text-black/80 dark:text-stone-300 overflow-x-auto max-h-48">
                              {JSON.stringify(log.inputPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Server Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-light-200 dark:border-[#2d251d] bg-light-primary dark:bg-[#181411] shadow-2xl p-6">
            <h3 className="text-sm font-semibold text-black dark:text-stone-100 mb-4">
              {t('mcp.addServerModalTitle') || 'Connect New MCP Server'}
            </h3>

            <form onSubmit={handleAddServer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1">
                  {t('mcp.serverName') || 'Server Name'} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Filesystem, GitHub, Postgres"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1">
                  {t('mcp.transport') || 'Transport Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTransport('stdio')}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium transition ${
                      formTransport === 'stdio'
                        ? 'border-[#b8864d] bg-[#b8864d]/10 text-[#b8864d]'
                        : 'border-light-200 dark:border-[#2d251d] text-black/60 dark:text-stone-400'
                    }`}
                  >
                    stdio (Local Process)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTransport('sse')}
                    className={`px-3 py-2 rounded-xl border text-xs font-medium transition ${
                      formTransport === 'sse'
                        ? 'border-[#b8864d] bg-[#b8864d]/10 text-[#b8864d]'
                        : 'border-light-200 dark:border-[#2d251d] text-black/60 dark:text-stone-400'
                    }`}
                  >
                    SSE (Remote HTTP)
                  </button>
                </div>
              </div>

              {formTransport === 'stdio' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1">
                      {t('mcp.command') || 'Executable Command'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. npx, uvx, python3, /usr/local/bin/my-tool"
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs font-mono text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1">
                      {t('mcp.args') || 'Arguments (space-separated)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. -y @modelcontextprotocol/server-filesystem /path"
                      value={formArgs}
                      onChange={(e) => setFormArgs(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs font-mono text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#b8864d] mb-1">
                    {t('mcp.url') || 'SSE Server URL'} *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://mcp-server.example.com/sse"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-light-200 dark:border-[#2d251d] bg-light-secondary/60 dark:bg-[#1b1713] text-xs text-black dark:text-stone-100 focus:outline-none focus:border-[#b8864d]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-light-200 dark:border-[#2d251d]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-light-200 dark:border-[#2d251d] text-xs font-medium text-black/70 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/5 transition"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-[#b8864d] hover:bg-[#a6743b] text-xs font-medium text-white transition shadow-sm"
                >
                  {t('common.save') || 'Save Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPSection;
