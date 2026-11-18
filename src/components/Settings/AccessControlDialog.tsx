'use client';

import { Dialog, DialogPanel } from '@headlessui/react';
import {
  Users,
  Shield,
  Clock,
  Globe,
  KeyRound,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Server,
  UserCheck,
  SlidersHorizontal,
  Ban,
  Check,
  CheckSquare,
  Square,
  ToggleLeft,
  ToggleRight,
  Settings2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '../ui/Loader';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import LoginDialog from '../Auth/LoginDialog';

interface UserItem {
  id: string;
  username: string;
  displayName?: string | null;
  role: 'admin' | 'member' | 'guest';
  status: 'active' | 'disabled';
  allowedProviders?: string[];
  allowedModels?: string[];
  modelLimits?: Record<
    string,
    {
      tokenLimit5h?: number | null;
      tokenLimitWeekly?: number | null;
      tokenLimitPerDay?: number | null;
      maxTokensPerRequest?: number | null;
    }
  >;
  tokenLimit5h?: number | null;
  tokenLimitWeekly?: number | null;
  tokenLimitPerDay?: number | null;
  tokenLimitPerMonth?: number | null;
  maxTokensPerRequest?: number | null;
}

interface ProviderOption {
  id: string;
  name: string;
  chatModels: { name: string; key: string }[];
}

interface GlobalLimitsState {
  tokenLimit5h: number | null;
  tokenLimitWeekly: number | null;
  tokenLimitPerDay: number | null;
  maxTokensPerRequest: number | null;
  qualityModeMaxTokens: number | null;
}

export const AccessControlDialog = ({
  isOpen,
  setIsOpen,
  initialTab,
}: {
  isOpen: boolean;
  setIsOpen: (active: boolean) => void;
  initialTab?: 'users' | 'models' | 'limits' | 'security';
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'models' | 'limits' | 'security'>(
    initialTab || 'users',
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [exposeToNetwork, setExposeToNetwork] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);

  // Global limits state
  const [globalLimits, setGlobalLimits] = useState<GlobalLimitsState>({
    tokenLimit5h: null,
    tokenLimitWeekly: null,
    tokenLimitPerDay: null,
    maxTokensPerRequest: null,
    qualityModeMaxTokens: 75000,
  });

  // Model access and per-model limits state
  const [disabledModels, setDisabledModels] = useState<string[]>([]);
  const [globalModelLimits, setGlobalModelLimits] = useState<
    Record<
      string,
      {
        tokenLimit5h?: number | null;
        tokenLimitWeekly?: number | null;
        tokenLimitPerDay?: number | null;
        maxTokensPerRequest?: number | null;
      }
    >
  >({});
  const [modelAccessScope, setModelAccessScope] = useState<'global' | 'user'>('global');
  const [selectedModelUserId, setSelectedModelUserId] = useState<string>('');
  const [openModelLimitKey, setOpenModelLimitKey] = useState<string | null>(null);
  const [isSavingModelAccess, setIsSavingModelAccess] = useState(false);

  // Solo mode admin password state
  const [isChangingSoloPassword, setIsChangingSoloPassword] = useState(false);
  const [soloAdminPassword, setSoloAdminPassword] = useState('');

  // New user form state (multi-user mode)
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'member'>('member');

  // Network exposure password prompt state
  const [showNetworkPasswordModal, setShowNetworkPasswordModal] = useState(false);
  const [networkAdminPassword, setNetworkAdminPassword] = useState('');
  const [hasAdminPassword, setHasAdminPassword] = useState(false);

  // Multi-user admin setup modal state
  const [showMultiUserSetupModal, setShowMultiUserSetupModal] = useState(false);
  const [setupAdminUsername, setSetupAdminUsername] = useState('');
  const [setupAdminPassword, setSetupAdminPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [isSubmittingMultiUserSetup, setIsSubmittingMultiUserSetup] = useState(false);

  // Authentication error state
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      // Fetch Config
      let configValues: any = {};
      const configRes = await fetch('/api/config');
      if (configRes.status === 401 || configRes.status === 403) {
        const errData = await configRes.json().catch(() => ({}));
        setAuthError(
          errData.message ||
          t('auth.loginRequiredAdmin') ||
          'Access to this panel requires logging in as an administrator.',
        );
        return;
      }
      if (configRes.ok) {
        const configData = await configRes.json();
        configValues = configData.values || configData;
        setInstanceMode(configValues.instanceMode || 'single');
        setExposeToNetwork(Boolean(configValues.network?.exposeToNetwork));

        fetch('/api/config/network-exposure')
          .then((r) => (r.ok ? r.json() : null))
          .then((netData) => {
            if (netData) {
              if (typeof netData.exposeToNetwork === 'boolean') {
                setExposeToNetwork(netData.exposeToNetwork);
              }
              if (typeof netData.hasAdminPassword === 'boolean') {
                setHasAdminPassword(netData.hasAdminPassword);
              }
            }
          })
          .catch(() => { });

        const gl = configValues.globalLimits || configValues.guestSettings || {};
        setGlobalLimits({
          tokenLimit5h: gl.tokenLimit5h ?? null,
          tokenLimitWeekly: gl.tokenLimitWeekly ?? null,
          tokenLimitPerDay: gl.tokenLimitPerDay ?? null,
          maxTokensPerRequest: gl.maxTokensPerRequest ?? null,
          qualityModeMaxTokens: gl.qualityModeMaxTokens ?? 75000,
        });

        setDisabledModels(Array.isArray(configValues.disabledModels) ? configValues.disabledModels : []);
        setGlobalModelLimits(gl.modelLimits || configValues.globalLimits?.modelLimits || {});
      }

      // Fetch Users
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const uList: UserItem[] = usersData.users || [];
        setUsersList(uList);
        if (uList.length > 0) {
          setSelectedUser((prev) => (prev ? uList.find((u) => u.id === prev.id) || uList[0] : uList[0]));
          setSelectedModelUserId((prev) => (prev && uList.some((u) => u.id === prev) ? prev : uList[0].id));
        }
      }

      // Fetch Providers & Models
      let activeList: ProviderOption[] = [];
      try {
        const provRes = await fetch('/api/providers');
        if (provRes.ok) {
          const provData = await provRes.json();
          activeList = provData.providers || [];
        }
      } catch (provErr) {
        console.warn('Could not fetch active providers:', provErr);
      }

      // Combine with configured providers from config to ensure Ollama etc. always show
      const configuredProviders = configValues.modelProviders || [];
      const combinedMap = new Map<string, ProviderOption>();

      for (const cp of configuredProviders) {
        if (!cp || !cp.id) continue;
        combinedMap.set(cp.id, {
          id: cp.id,
          name: cp.name || cp.type,
          chatModels: Array.isArray(cp.chatModels)
            ? cp.chatModels.map((m: any) => ({ name: m.name || m.key, key: m.key }))
            : [],
        });
      }

      for (const ap of activeList) {
        if (!ap || !ap.id) continue;
        combinedMap.set(ap.id, {
          id: ap.id,
          name: ap.name || ap.id,
          chatModels: ap.chatModels || [],
        });
      }

      setProviders(Array.from(combinedMap.values()));
    } catch (err) {
      console.error('Failed to load access control data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleSwitchInstanceMode = async (newMode: 'single' | 'multi') => {
    if (newMode === 'multi') {
      const hasCustomAdmin = usersList.some(
        (u) => u.role === 'admin' && u.username.toLowerCase() !== 'admin',
      );
      if (!hasCustomAdmin) {
        setShowMultiUserSetupModal(true);
        return;
      }
    }

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'instanceMode', value: newMode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('accessControl.saveError') || 'Failed to save');
      }

      setInstanceMode(newMode);
      toast.success(t('accessControl.modeSwitchSuccess') || 'Instance mode updated successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save');
    }
  };

  const handleSetupMultiUserAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = setupAdminUsername.trim().toLowerCase();

    if (!trimmedUser) {
      toast.error(t('accessControl.adminUsername') || 'Enter a username.');
      return;
    }

    if (trimmedUser === 'admin') {
      toast.error(
        t('accessControl.adminUsernameAdminForbidden') ||
        'For security reasons, administrator username cannot be "admin".',
      );
      return;
    }

    if (trimmedUser.length < 3 || trimmedUser.length > 32) {
      toast.error(
        t('accessControl.usernameLengthError') || 'Username must be between 3 and 32 characters.',
      );
      return;
    }

    if (!/^[a-z0-9_-]+$/.test(trimmedUser)) {
      toast.error(
        t('accessControl.usernameInvalidCharsError') ||
        'Username can only contain lowercase letters, digits, "_" and "-".',
      );
      return;
    }

    if (setupAdminPassword.length < 8) {
      toast.error(t('setup.adminPasswordMinLength') || 'Password must be at least 8 characters long..');
      return;
    }

    if (setupAdminPassword !== setupConfirmPassword) {
      toast.error(t('accessControl.passwordsDoNotMatch') || 'Passwords do not match.');
      return;
    }

    try {
      setIsSubmittingMultiUserSetup(true);
      const res = await fetch('/api/users/setup-multiuser-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUser,
          password: setupAdminPassword,
          confirmPassword: setupConfirmPassword,
          displayName: setupAdminUsername.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || t('accessControl.setupErrorGeneric') || 'Error setting up the administrator account');
      }

      toast.success(
        data.message || t('accessControl.multiUserSetupSuccess') ||
        'Administrator account created and Multi-User mode enabled.',
      );
      setShowMultiUserSetupModal(false);
      setSetupAdminUsername('');
      setSetupAdminPassword('');
      setSetupConfirmPassword('');
      setInstanceMode('multi');
      loadData();
    } catch (err: any) {
      toast.error(err.message || t('accessControl.setupErrorGeneric') || 'Error setting up the administrator account');
    } finally {
      setIsSubmittingMultiUserSetup(false);
    }
  };

  const handleSetSoloAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (soloAdminPassword.length < 8) {
      toast.error(t('setup.adminPasswordMinLength') || 'Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/config/admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: soloAdminPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('accessControl.saveError') || 'Failed to save');
      }

      toast.success(t('accessControl.adminPasswordSuccess') || 'Admin password updated successfully.');
      setSoloAdminPassword('');
      setIsChangingSoloPassword(false);
      setHasAdminPassword(true);
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save');
    }
  };

  const handleSaveGlobalLimits = async () => {
    try {
      const updates = [
        { key: 'globalLimits.tokenLimit5h', value: globalLimits.tokenLimit5h },
        { key: 'globalLimits.tokenLimitWeekly', value: globalLimits.tokenLimitWeekly },
        { key: 'globalLimits.tokenLimitPerDay', value: globalLimits.tokenLimitPerDay },
        { key: 'globalLimits.maxTokensPerRequest', value: globalLimits.maxTokensPerRequest },
        { key: 'globalLimits.qualityModeMaxTokens', value: globalLimits.qualityModeMaxTokens },
        { key: 'guestSettings.qualityModeMaxTokens', value: globalLimits.qualityModeMaxTokens },
      ];

      for (const item of updates) {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (!res.ok) {
          let errorMsg = '';
          try {
            const rawText = await res.text();
            try {
              const parsed = JSON.parse(rawText);
              errorMsg = parsed.message || parsed.error || rawText;
            } catch {
              errorMsg = rawText;
            }
          } catch {
            errorMsg = `HTTP ${res.status}`;
          }
          throw new Error(errorMsg || t('accessControl.saveError') || 'Failed to save');
        }
      }

      toast.success(t('accessControl.saveSuccess') || 'Global limits saved successfully.');
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error(t('accessControl.username') + ' & ' + t('accessControl.password'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('setup.adminPasswordMinLength') || 'Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          displayName: newDisplayName.trim() || undefined,
          role: newRole,
          tokenLimit5h: 50000,
          tokenLimitWeekly: 250000,
          tokenLimitPerDay: 100000,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t('accessControl.saveError') || 'Failed to save');
      }

      toast.success(t('accessControl.saveSuccess') || 'User created successfully.');
      setIsAddingUser(false);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to add user.');
    }
  };

  const handleUpdateUserLimits = async (user: UserItem) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenLimit5h: user.tokenLimit5h,
          tokenLimitWeekly: user.tokenLimitWeekly,
          tokenLimitPerDay: user.tokenLimitPerDay,
          tokenLimitPerMonth: user.tokenLimitPerMonth,
          maxTokensPerRequest: user.maxTokensPerRequest,
          allowedProviders: user.allowedProviders,
          allowedModels: user.allowedModels,
          modelLimits: user.modelLimits,
          role: user.role,
          status: user.status,
        }),
      });

      if (!res.ok) {
        let errorMsg = '';
        try {
          const rawText = await res.text();
          try {
            const parsed = JSON.parse(rawText);
            errorMsg = parsed.message || parsed.error || rawText;
          } catch {
            errorMsg = rawText;
          }
        } catch {
          errorMsg = `HTTP ${res.status}`;
        }
        throw new Error(errorMsg || t('accessControl.saveError') || 'Failed to save changes');
      }

      toast.success(t('accessControl.saveSuccess') || 'User limits saved successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save changes');
    }
  };

  const handleToggleGlobalModel = (modelKey: string) => {
    setDisabledModels((prev) =>
      prev.includes(modelKey) ? prev.filter((m) => m !== modelKey) : [...prev, modelKey],
    );
  };

  const handleSetAllModelsInProviderGlobal = (provider: ProviderOption, enable: boolean) => {
    const keys = provider.chatModels.map((m) => m.key);
    setDisabledModels((prev) => {
      if (enable) {
        return prev.filter((m) => !keys.includes(m));
      } else {
        return Array.from(new Set([...prev, ...keys]));
      }
    });
  };

  const handleToggleUserProvider = (user: UserItem, providerId: string) => {
    const allProviders = providers.map((p) => p.id);
    let currentAllowed = user.allowedProviders || ['*'];
    if (currentAllowed.includes('*')) {
      currentAllowed = allProviders;
    }
    const isCurrentlyAllowed = currentAllowed.includes(providerId);
    const updated = isCurrentlyAllowed
      ? currentAllowed.filter((id) => id !== providerId)
      : [...currentAllowed, providerId];

    const updatedUser = { ...user, allowedProviders: updated };
    setUsersList((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    if (selectedUser?.id === user.id) setSelectedUser(updatedUser);
  };

  const handleToggleUserModel = (user: UserItem, modelKey: string) => {
    const allModelKeys = providers.flatMap((p) => p.chatModels.map((m) => m.key));
    let currentModels = user.allowedModels || ['*'];
    if (currentModels.includes('*')) {
      currentModels = allModelKeys;
    }
    const isCurrentlyAllowed = currentModels.includes(modelKey);
    const updated = isCurrentlyAllowed
      ? currentModels.filter((k) => k !== modelKey)
      : [...currentModels, modelKey];

    const updatedUser = { ...user, allowedModels: updated };
    setUsersList((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    if (selectedUser?.id === user.id) setSelectedUser(updatedUser);
  };

  const handleSetAllModelsInProviderUser = (
    user: UserItem,
    provider: ProviderOption,
    enable: boolean,
  ) => {
    const allModelKeys = providers.flatMap((p) => p.chatModels.map((m) => m.key));
    const providerKeys = provider.chatModels.map((m) => m.key);
    let currentModels = user.allowedModels || ['*'];
    if (currentModels.includes('*')) {
      currentModels = allModelKeys;
    }

    let updated: string[];
    if (enable) {
      updated = Array.from(new Set([...currentModels, ...providerKeys]));
    } else {
      updated = currentModels.filter((k) => !providerKeys.includes(k));
    }

    const updatedUser = { ...user, allowedModels: updated };
    setUsersList((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    if (selectedUser?.id === user.id) setSelectedUser(updatedUser);
  };

  const handleUpdateModelLimit = (
    scope: 'global' | 'user',
    modelKey: string,
    field: 'tokenLimit5h' | 'tokenLimitPerDay',
    val: number | null,
    targetUser?: UserItem,
  ) => {
    if (scope === 'global') {
      setGlobalModelLimits((prev) => {
        const current = prev[modelKey] || {};
        return {
          ...prev,
          [modelKey]: {
            ...current,
            [field]: val,
          },
        };
      });
    } else if (targetUser) {
      const currentLimits = targetUser.modelLimits || {};
      const modelCur = currentLimits[modelKey] || {};
      const updatedUser = {
        ...targetUser,
        modelLimits: {
          ...currentLimits,
          [modelKey]: {
            ...modelCur,
            [field]: val,
          },
        },
      };
      setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? updatedUser : u)));
      if (selectedUser?.id === targetUser.id) setSelectedUser(updatedUser);
    }
  };

  const handleSaveModelAccess = async () => {
    setIsSavingModelAccess(true);
    try {
      if (instanceMode === 'single' || modelAccessScope === 'global') {
        const updates = [
          { key: 'disabledModels', value: disabledModels },
          { key: 'globalLimits.modelLimits', value: globalModelLimits },
        ];

        for (const item of updates) {
          const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || t('accessControl.saveError') || 'Failed to save');
          }
        }
        toast.success(
          t('accessControl.modelAccessSaveSuccess') ||
            'Model access permissions and limits saved successfully.',
        );
      } else {
        const curUser = usersList.find((u) => u.id === selectedModelUserId);
        if (!curUser) return;

        const res = await fetch(`/api/users/${curUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowedProviders: curUser.allowedProviders,
            allowedModels: curUser.allowedModels,
            modelLimits: curUser.modelLimits,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || t('accessControl.saveError') || 'Failed to save');
        }

        toast.success(
          t('accessControl.modelAccessSaveSuccess') ||
            'Model access permissions and limits saved successfully.',
        );
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save model access');
    } finally {
      setIsSavingModelAccess(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm(t('common.confirmDelete') || 'Are you sure you want to delete?')) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('accessControl.deleteError') || 'Failed to delete user');
      toast.success(t('accessControl.deleteSuccess') || 'User deleted');
      loadData();
    } catch (err: any) {
      toast.error(err.message || t('accessControl.deleteError') || 'Failed to delete user');
    }
  };

  const handleToggleNetworkExposure = async (expose: boolean) => {
    if (expose && instanceMode === 'single' && !hasAdminPassword) {
      setShowNetworkPasswordModal(true);
      return;
    }

    try {
      const res = await fetch('/api/config/network-exposure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exposeToNetwork: expose,
          expose,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || t('accessControl.saveError') || 'Failed to save changes');
      }

      const resData = await res.json();
      setExposeToNetwork(expose);
      if (typeof resData?.hasAdminPassword === 'boolean') {
        setHasAdminPassword(resData.hasAdminPassword);
      }
      toast.success(
        expose
          ? t('accessControl.networkExposed') || 'Network exposure enabled.'
          : t('accessControl.networkIsolated') || 'Instance accessible locally only.',
      );
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save changes');
    }
  };

  const handleConfirmNetworkExposureWithPassword = async () => {
    if (networkAdminPassword.length < 8) {
      toast.error(t('setup.adminPasswordMinLength') || 'Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/config/network-exposure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exposeToNetwork: true,
          expose: true,
          adminPassword: networkAdminPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || t('accessControl.saveError') || 'Failed to save changes');
      }

      const resData = await res.json();
      setExposeToNetwork(true);
      setHasAdminPassword(true);
      setShowNetworkPasswordModal(false);
      setNetworkAdminPassword('');
      toast.success(t('accessControl.networkExposed') || 'Network exposure enabled.');
    } catch (err: any) {
      toast.error(err.message || t('accessControl.saveError') || 'Failed to save changes');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <DialogPanel className="border border-light-200 dark:border-[#2b241c] bg-light-primary dark:bg-[#0f0d0a] rounded-2xl w-full max-w-4xl h-[680px] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/50 dark:bg-[#14110d]">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-[#b8864d]/15 text-[#b8864d]">
                  <Shield size={22} />
                </div>
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h2 className="text-base font-semibold text-black dark:text-stone-100">
                      {t('accessControl.title') || 'Access Control & Quotas'}
                    </h2>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase',
                        instanceMode === 'multi'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                          : 'bg-[#b8864d]/15 text-[#b8864d] border border-[#b8864d]/25',
                      )}
                    >
                      {instanceMode === 'multi'
                        ? t('accessControl.modeMulti') || 'Multi-User'
                        : t('accessControl.modeSingle') || 'Single-User'}
                    </span>
                  </div>
                  <p className="text-xs text-black/60 dark:text-stone-400 mt-0.5">
                    {t('accessControl.description') ||
                      'Manage users, passwords, model access, and token quotas.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Mode switch pill in header */}
                <div className="flex items-center rounded-xl bg-light-200 dark:bg-[#1f1914] p-1 border border-light-300 dark:border-[#2f251a]">
                  <button
                    type="button"
                    onClick={() => handleSwitchInstanceMode('single')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition',
                      instanceMode === 'single'
                        ? 'bg-[#b8864d] text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200',
                    )}
                  >
                    Solo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchInstanceMode('multi')}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition',
                      instanceMode === 'multi'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200',
                    )}
                  >
                    Multi-User
                  </button>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-black/50 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#221c16] transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 px-6 pt-3 border-b border-light-200 dark:border-[#221c16] bg-light-secondary/20 dark:bg-[#120f0c]">
              <button
                onClick={() => setActiveTab('users')}
                className={cn(
                  'flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium border-b-2 transition duration-150',
                  activeTab === 'users'
                    ? 'border-[#b8864d] text-[#b8864d] bg-[#b8864d]/10'
                    : 'border-transparent text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
                )}
              >
                <Users size={15} />
                <span>{t('accessControl.tabUsers') || 'Users & Passwords'}</span>
              </button>
              <button
                onClick={() => setActiveTab('models')}
                className={cn(
                  'flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium border-b-2 transition duration-150',
                  activeTab === 'models'
                    ? 'border-[#b8864d] text-[#b8864d] bg-[#b8864d]/10'
                    : 'border-transparent text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
                )}
              >
                <Shield size={15} />
                <span>{t('accessControl.tabModels') || 'Model Access'}</span>
              </button>
              <button
                onClick={() => setActiveTab('limits')}
                className={cn(
                  'flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium border-b-2 transition duration-150',
                  activeTab === 'limits'
                    ? 'border-[#b8864d] text-[#b8864d] bg-[#b8864d]/10'
                    : 'border-transparent text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
                )}
              >
                <Clock size={15} />
                <span>{t('accessControl.tabLimits') || 'Usage Quotas'}</span>
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={cn(
                  'flex items-center space-x-2 px-3.5 py-2 rounded-t-lg text-xs font-medium border-b-2 transition duration-150',
                  activeTab === 'security'
                    ? 'border-[#b8864d] text-[#b8864d] bg-[#b8864d]/10'
                    : 'border-transparent text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-200',
                )}
              >
                <Globe size={15} />
                <span>{t('accessControl.tabSecurity') || 'Network & Security'}</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader />
                </div>
              ) : authError ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-[#b8864d]/10 text-[#b8864d] border border-[#b8864d]/20">
                    <Lock size={32} />
                  </div>
                  <h3 className="text-base font-semibold text-black dark:text-stone-100">
                    {t('auth.accessRestricted') || 'Access Restricted'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm leading-relaxed">
                    {authError}
                  </p>
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-200"
                    >
                      {t('accessControl.cancel') || 'Close'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        setIsLoginOpen(true);
                      }}
                      className="px-5 py-2 rounded-xl bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-semibold shadow-md active:scale-95 transition"
                    >
                      {t('auth.login') || 'Log in as Administrator'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* TAB 1: USERS & PASSWORDS */}
                  {activeTab === 'users' && (
                    <div className="space-y-6">
                      {/* Instance Mode & Solo Admin Password Section */}
                      {instanceMode === 'single' ? (
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl border border-[#b8864d]/30 bg-[#b8864d]/5 flex items-start space-x-3">
                            <CheckCircle2 size={18} className="text-[#b8864d] mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-black dark:text-stone-200">
                                  {t('accessControl.modeSingle') || 'Single-User Mode (Local / Solo)'}
                                </p>
                                <button
                                  onClick={() => handleSwitchInstanceMode('multi')}
                                  className="text-xs text-[#b8864d] hover:underline font-medium"
                                >
                                  {t('accessControl.switchMode') || 'Switch to Multi-User'} →
                                </button>
                              </div>
                              <p className="text-xs text-black/60 dark:text-stone-400 mt-1 leading-relaxed">
                                {t('accessControl.modeSingleDesc') ||
                                  'Connections from localhost run with administrator privileges. You can configure an admin password or switch to Multi-User mode.'}
                              </p>
                            </div>
                          </div>

                          {/* Admin Password card for Solo mode */}
                          <div className="p-4 rounded-xl border border-light-200 dark:border-[#2d2419] bg-light-secondary/40 dark:bg-[#16120e] space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-[#b8864d]">
                                <KeyRound size={17} />
                                <h4 className="text-xs font-semibold uppercase tracking-wider">
                                  {t('accessControl.adminPasswordTitle') || 'Administrator Password (Solo Mode)'}
                                </h4>
                              </div>
                              {!isChangingSoloPassword && (
                                <button
                                  onClick={() => setIsChangingSoloPassword(true)}
                                  className="px-3 py-1 rounded-lg bg-[#b8864d]/15 text-[#b8864d] hover:bg-[#b8864d]/25 text-xs font-medium transition"
                                >
                                  {t('accessControl.setAdminPassword') || 'Set / Change Password'}
                                </button>
                              )}
                            </div>

                            <p className="text-xs text-stone-400">
                              {t('accessControl.adminPasswordDesc') ||
                                'Protect the administrator account with a password to guard configuration and LLM keys.'}
                            </p>

                            {isChangingSoloPassword && (
                              <form onSubmit={handleSetSoloAdminPassword} className="space-y-3 pt-2">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="password"
                                    value={soloAdminPassword}
                                    onChange={(e) => setSoloAdminPassword(e.target.value)}
                                    placeholder={
                                      t('accessControl.newAdminPassword') ||
                                      'New admin password (min. 8 chars)'
                                    }
                                    className="flex-1 px-3 py-2 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                                    required
                                    autoFocus
                                  />
                                  <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-medium transition active:scale-95"
                                  >
                                    {t('common.save') || 'Save'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsChangingSoloPassword(false);
                                      setSoloAdminPassword('');
                                    }}
                                    className="px-3 py-2 rounded-lg border border-stone-700 text-stone-400 hover:text-stone-200 text-xs transition"
                                  >
                                    {t('accessControl.cancel') || 'Cancel'}
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/5 flex items-start space-x-3">
                          <Users size={18} className="text-purple-400 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-black dark:text-stone-200">
                                {t('accessControl.modeMulti') || 'Multi-User Mode (Team / Multi-tenant)'}
                              </p>
                              <button
                                onClick={() => handleSwitchInstanceMode('single')}
                                className="text-xs text-[#b8864d] hover:underline font-medium"
                              >
                                ← {t('accessControl.switchMode') || 'Switch to Solo'}
                              </button>
                            </div>
                            <p className="text-xs text-black/60 dark:text-stone-400 mt-1 leading-relaxed">
                              {t('accessControl.modeMultiDesc') ||
                                'Requires login. Users have isolated chat sessions, custom token quotas, and granular model access.'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Users List & Add Button */}
                      <div className="flex items-center justify-between pt-2">
                        <h3 className="text-sm font-semibold text-black dark:text-stone-200">
                          {t('accessControl.accountsCount') || 'Account list'} ({usersList.length})
                        </h3>
                        <button
                          onClick={() => setIsAddingUser(true)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-medium transition active:scale-95"
                        >
                          <Plus size={14} />
                          <span>{t('accessControl.addUser') || 'Add User'}</span>
                        </button>
                      </div>

                      {/* Add User Modal / Inline Form */}
                      {isAddingUser && (
                        <form
                          onSubmit={handleCreateUser}
                          className="p-4 rounded-xl border border-light-200 dark:border-[#2d2419] bg-light-secondary/40 dark:bg-[#16120e] space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#b8864d]">
                              {t('accessControl.addUser') || 'Add User'}
                            </h4>
                            <button
                              type="button"
                              onClick={() => setIsAddingUser(false)}
                              className="text-stone-400 hover:text-stone-200 text-xs"
                            >
                              {t('accessControl.cancel') || 'Cancel'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="text-xs text-stone-400">
                                {t('accessControl.username') || 'User'}
                              </label>
                              <input
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                placeholder={t('accessControl.usernamePlaceholder') || 'e.g. johndoe'}
                                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs text-stone-400">
                                {t('accessControl.password') || 'Password'}
                              </label>
                              <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs text-stone-400">
                                {t('accessControl.role') || 'Role'}
                              </label>
                              <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as any)}
                                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                              >
                                <option value="member">
                                  {t('accessControl.member') || 'Member'}
                                </option>
                                <option value="admin">
                                  {t('accessControl.admin') || 'Administrator'}
                                </option>
                              </select>
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setIsAddingUser(false)}
                              className="px-3 py-1.5 rounded-lg border border-stone-700 text-stone-400 hover:text-stone-200 text-xs transition"
                            >
                              {t('accessControl.cancel') || 'Cancel'}
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 rounded-lg bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-medium transition"
                            >
                              {t('accessControl.saveUser') || 'Save User'}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Users Table */}
                      <div className="border border-light-200 dark:border-[#221c16] rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-light-secondary/60 dark:bg-[#14110d] text-stone-400 border-b border-light-200 dark:border-[#221c16]">
                            <tr>
                              <th className="py-2.5 px-4">{t('accessControl.username') || 'User'}</th>
                              <th className="py-2.5 px-4">{t('accessControl.role') || 'Role'}</th>
                              <th className="py-2.5 px-4">{t('accessControl.limit5h') || '5-Hour Limit'}</th>
                              <th className="py-2.5 px-4">{t('accessControl.limitWeekly') || 'Weekly Limit'}</th>
                              <th className="py-2.5 px-4 text-right">{t('common.actions') || 'Actions'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-light-200 dark:divide-[#1f1913]">
                            {usersList.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-6 text-center text-stone-500">
                                  {t('accessControl.noAccountsFound') ||
                                    'No registered user accounts found'}
                                </td>
                              </tr>
                            ) : (
                              usersList.map((u) => (
                                <tr
                                  key={u.id}
                                  className={cn(
                                    'hover:bg-light-200/40 dark:hover:bg-[#181410] transition',
                                    selectedUser?.id === u.id && 'bg-[#b8864d]/10',
                                  )}
                                >
                                  <td className="py-3 px-4 font-medium text-black dark:text-stone-200">
                                    {u.username}
                                    {u.displayName && (
                                      <span className="text-stone-400 font-normal ml-2">
                                        ({u.displayName})
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span
                                      className={cn(
                                        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                                        u.role === 'admin'
                                          ? 'bg-[#b8864d]/20 text-[#b8864d]'
                                          : 'bg-stone-200 dark:bg-[#262018] text-stone-400',
                                      )}
                                    >
                                      {u.role}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-stone-300">
                                    {u.tokenLimit5h
                                      ? `${u.tokenLimit5h.toLocaleString()} ${t('accessControl.tokens') || 'tokens'}`
                                      : t('accessControl.unlimited') || 'Unlimited'}
                                  </td>
                                  <td className="py-3 px-4 text-stone-300">
                                    {u.tokenLimitWeekly
                                      ? `${u.tokenLimitWeekly.toLocaleString()} ${t('accessControl.tokens') || 'tokens'}`
                                      : t('accessControl.unlimited') || 'Unlimited'}
                                  </td>
                                  <td className="py-3 px-4 text-right space-x-2">
                                    <button
                                      onClick={() => {
                                        setSelectedUser(u);
                                        setActiveTab('limits');
                                      }}
                                      title={t('accessControl.editUser') || 'Edit User'}
                                      className="p-1 rounded text-stone-400 hover:text-stone-100 hover:bg-[#28211a]"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    {u.username !== 'admin' && (
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        title={t('accessControl.deleteUser') || 'Delete User'}
                                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* TAB 2: MODEL ACCESS */}
                {activeTab === 'models' && (() => {
                  const activeModelUser =
                    usersList.find((u) => u.id === selectedModelUserId) || selectedUser || usersList[0];
                  const isUserScope = instanceMode === 'multi' && modelAccessScope === 'user' && Boolean(activeModelUser);

                  return (
                    <div className="space-y-6">
                      {/* Top Header & Scope Switcher */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-light-200 dark:border-[#221c16]">
                        <div>
                          <h3 className="text-sm font-semibold text-black dark:text-stone-200 flex items-center space-x-2">
                            <Shield size={16} className="text-[#b8864d]" />
                            <span>{t('accessControl.tabModels') || 'Model Access & Permissions'}</span>
                          </h3>
                          <p className="text-xs text-stone-400 mt-0.5 max-w-xl">
                            {isUserScope
                              ? t('accessControl.userModelAccessDesc') ||
                                'Configure granular model permissions and specific token budgets for this user account.'
                              : t('accessControl.globalDisabledModelsDesc') ||
                                'Disable unwanted or costly models instance-wide. Disabled models are completely hidden from the chat selector and forbidden for all users.'}
                          </p>
                        </div>

                        {instanceMode === 'multi' && (
                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="flex items-center rounded-xl bg-light-200 dark:bg-[#1b1510] p-1 border border-light-300 dark:border-[#2b2117]">
                              <button
                                type="button"
                                onClick={() => setModelAccessScope('global')}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-xs font-medium transition',
                                  modelAccessScope === 'global'
                                    ? 'bg-[#b8864d] text-white shadow-sm'
                                    : 'text-stone-400 hover:text-stone-200',
                                )}
                              >
                                {t('accessControl.modelAccessScopeGlobal') || 'All Users'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setModelAccessScope('user')}
                                className={cn(
                                  'px-2.5 py-1 rounded-lg text-xs font-medium transition',
                                  modelAccessScope === 'user'
                                    ? 'bg-purple-600 text-white shadow-sm'
                                    : 'text-stone-400 hover:text-stone-200',
                                )}
                              >
                                {t('accessControl.modelAccessScopeUser') || 'Per-User'}
                              </button>
                            </div>

                            {modelAccessScope === 'user' && usersList.length > 0 && (
                              <select
                                value={activeModelUser?.id || ''}
                                onChange={(e) => setSelectedModelUserId(e.target.value)}
                                className="px-3 py-1.5 rounded-xl border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                              >
                                {usersList.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.username} ({u.role})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>

                      {/* User Context Banner (if user scope) */}
                      {isUserScope && activeModelUser && (
                        <div className="p-3.5 rounded-xl border border-purple-500/25 bg-purple-500/5 flex items-center justify-between">
                          <div className="flex items-center space-x-2.5 text-xs">
                            <span className="font-semibold text-stone-300">
                              {t('accessControl.username') || 'Account'}:{' '}
                              <span className="text-purple-400 font-bold">{activeModelUser.username}</span>
                              {activeModelUser.displayName && (
                                <span className="text-stone-400 font-normal ml-1">
                                  ({activeModelUser.displayName})
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase',
                                activeModelUser.role === 'admin'
                                  ? 'bg-[#b8864d]/20 text-[#b8864d]'
                                  : 'bg-stone-700 text-stone-300',
                              )}
                            >
                              {activeModelUser.role}
                            </span>
                          </div>
                          {activeModelUser.role === 'admin' && (
                            <span className="text-[11px] text-[#b8864d]">
                              {t('accessControl.adminFullAccess') ||
                                'Administrator has unrestricted access to all active models (*).'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Providers & Models List */}
                      {providers.length === 0 ? (
                        <p className="text-xs text-stone-400 text-center py-8">
                          {t('settings.noModelsInSystem') || 'No models configured in the system.'}
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {providers.map((p) => {
                            const userAllowedProviders = activeModelUser?.allowedProviders || ['*'];
                            const isProviderPermittedForUser =
                              !isUserScope ||
                              activeModelUser?.role === 'admin' ||
                              userAllowedProviders.includes('*') ||
                              userAllowedProviders.includes(p.id);

                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  'p-4 rounded-xl border transition',
                                  isUserScope && !isProviderPermittedForUser
                                    ? 'border-red-900/40 bg-red-950/10'
                                    : 'border-light-200 dark:border-[#29221a] bg-light-secondary/40 dark:bg-[#16120e]',
                                )}
                              >
                                {/* Provider Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-light-200 dark:border-[#221c16] gap-2">
                                  <div className="flex items-center space-x-2.5">
                                    <div className="p-1.5 rounded-lg bg-[#b8864d]/15 text-[#b8864d]">
                                      <Server size={15} />
                                    </div>
                                    <span className="text-xs font-semibold text-black dark:text-stone-200">
                                      {p.name}
                                    </span>
                                    <span className="text-[10px] text-stone-500 font-mono">({p.id})</span>
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    {isUserScope && activeModelUser?.role !== 'admin' && (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleUserProvider(activeModelUser, p.id)}
                                        className={cn(
                                          'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition',
                                          isProviderPermittedForUser
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                            : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20',
                                        )}
                                      >
                                        {isProviderPermittedForUser
                                          ? t('accessControl.allowed') || 'Provider Allowed'
                                          : t('accessControl.blocked') || 'Provider Blocked'}
                                      </button>
                                    )}

                                    {/* Quick Bulk Actions for Provider Models */}
                                    {p.chatModels.length > 0 && (
                                      <div className="flex items-center space-x-1.5 pl-2 border-l border-light-200 dark:border-[#2b2218]">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isUserScope && activeModelUser) {
                                              handleSetAllModelsInProviderUser(activeModelUser, p, true);
                                            } else {
                                              handleSetAllModelsInProviderGlobal(p, true);
                                            }
                                          }}
                                          className="px-2 py-0.5 rounded text-[10px] text-stone-400 hover:text-stone-200 bg-black/20 hover:bg-black/40 border border-stone-800 transition"
                                        >
                                          {t('accessControl.allowAllInProvider') || 'Enable All'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isUserScope && activeModelUser) {
                                              handleSetAllModelsInProviderUser(activeModelUser, p, false);
                                            } else {
                                              handleSetAllModelsInProviderGlobal(p, false);
                                            }
                                          }}
                                          className="px-2 py-0.5 rounded text-[10px] text-stone-400 hover:text-stone-200 bg-black/20 hover:bg-black/40 border border-stone-800 transition"
                                        >
                                          {t('accessControl.blockAllInProvider') || 'Disable All'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Models List under Provider */}
                                <div className="mt-3.5 space-y-2">
                                  {p.chatModels.length === 0 ? (
                                    <p className="text-[11px] text-stone-500 italic py-2">
                                      {t('settings.providerActive') || 'Provider active, no chat models loaded.'}
                                    </p>
                                  ) : (
                                    p.chatModels.map((m) => {
                                      const isGloballyDisabled = disabledModels.includes(m.key);
                                      const userAllowedModels = activeModelUser?.allowedModels || ['*'];
                                      const isAllowedForUser =
                                        !isGloballyDisabled &&
                                        (activeModelUser?.role === 'admin' ||
                                          userAllowedModels.includes('*') ||
                                          userAllowedModels.includes(m.key));

                                      const isLimitsOpen = openModelLimitKey === m.key;

                                      // Retrieve active limits for this model
                                      const currentModelLimits = isUserScope
                                        ? activeModelUser?.modelLimits?.[m.key] || {}
                                        : globalModelLimits[m.key] || {};

                                      return (
                                        <div
                                          key={m.key}
                                          className={cn(
                                            'rounded-xl border transition p-3 space-y-2.5',
                                            isGloballyDisabled
                                              ? 'border-red-900/30 bg-red-950/15'
                                              : isUserScope && !isAllowedForUser
                                                ? 'border-stone-800 bg-black/30 opacity-75'
                                                : 'border-light-200 dark:border-[#2f251a] bg-light-primary dark:bg-[#0e0c09]',
                                          )}
                                        >
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex items-center space-x-2.5">
                                              {/* Action Icon / Checkbox button */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (isUserScope && activeModelUser) {
                                                    if (activeModelUser.role !== 'admin' && !isGloballyDisabled) {
                                                      handleToggleUserModel(activeModelUser, m.key);
                                                    }
                                                  } else {
                                                    handleToggleGlobalModel(m.key);
                                                  }
                                                }}
                                                disabled={isUserScope && (activeModelUser?.role === 'admin' || isGloballyDisabled)}
                                                className="shrink-0 transition active:scale-95 disabled:cursor-not-allowed"
                                                title={
                                                  isUserScope
                                                    ? isAllowedForUser
                                                      ? 'Disable for user'
                                                      : 'Enable for user'
                                                    : isGloballyDisabled
                                                      ? 'Enable in system'
                                                      : 'Disable in system'
                                                }
                                              >
                                                {isUserScope ? (
                                                  isGloballyDisabled ? (
                                                    <Ban size={16} className="text-stone-600" />
                                                  ) : isAllowedForUser ? (
                                                    <CheckSquare size={16} className="text-emerald-400" />
                                                  ) : (
                                                    <Square size={16} className="text-stone-600" />
                                                  )
                                                ) : isGloballyDisabled ? (
                                                  <Square size={16} className="text-red-500/70" />
                                                ) : (
                                                  <CheckSquare size={16} className="text-emerald-400" />
                                                )}
                                              </button>

                                              <div>
                                                <div className="flex items-center space-x-2">
                                                  <span className="text-xs font-medium text-black dark:text-stone-200">
                                                    {m.name || m.key}
                                                  </span>
                                                  {m.name && m.name !== m.key && (
                                                    <span className="text-[10px] text-stone-500 font-mono">
                                                      ({m.key})
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Mini tags for active model quotas */}
                                                {(currentModelLimits.tokenLimit5h ||
                                                  currentModelLimits.tokenLimitPerDay) && (
                                                  <div className="flex items-center space-x-1.5 mt-1">
                                                    {currentModelLimits.tokenLimit5h && (
                                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#b8864d]/10 text-[#f3d5ab] border border-[#b8864d]/20">
                                                        5h: {currentModelLimits.tokenLimit5h.toLocaleString()} tok
                                                      </span>
                                                    )}
                                                    {currentModelLimits.tokenLimitPerDay && (
                                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                        Day: {currentModelLimits.tokenLimitPerDay.toLocaleString()} tok
                                                      </span>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            </div>

                                            {/* Status Badge & Limit Toggle */}
                                            <div className="flex items-center space-x-2">
                                              {/* Model Access Toggle Badge */}
                                              {isUserScope ? (
                                                isGloballyDisabled ? (
                                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/40 text-red-400 border border-red-800/40">
                                                    {t('accessControl.modelDisabled') || 'Disabled globally'}
                                                  </span>
                                                ) : (
                                                  <button
                                                    type="button"
                                                    disabled={activeModelUser?.role === 'admin'}
                                                    onClick={() =>
                                                      handleToggleUserModel(activeModelUser, m.key)
                                                    }
                                                    className={cn(
                                                      'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition border',
                                                      isAllowedForUser
                                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                                                        : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700',
                                                      activeModelUser?.role === 'admin' && 'cursor-default opacity-80',
                                                    )}
                                                  >
                                                    {isAllowedForUser
                                                      ? t('accessControl.allowed') || 'Allowed'
                                                      : t('accessControl.blocked') || 'Blocked'}
                                                  </button>
                                                )
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleGlobalModel(m.key)}
                                                  className={cn(
                                                    'px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition border',
                                                    isGloballyDisabled
                                                      ? 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
                                                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25',
                                                  )}
                                                >
                                                  {isGloballyDisabled
                                                    ? t('accessControl.modelDisabled') || 'Disabled'
                                                    : t('accessControl.modelActive') || 'Active'}
                                                </button>
                                              )}

                                              {/* Open Limits Button */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setOpenModelLimitKey(isLimitsOpen ? null : m.key)
                                                }
                                                className={cn(
                                                  'p-1.5 rounded-lg border transition',
                                                  isLimitsOpen
                                                    ? 'bg-[#b8864d] text-white border-[#b8864d]'
                                                    : 'border-light-200 dark:border-[#33291d] text-stone-400 hover:text-stone-200 hover:bg-light-200 dark:hover:bg-[#1f1913]',
                                                )}
                                                title={t('accessControl.modelLimitsTitle') || 'Model Quotas'}
                                              >
                                                <SlidersHorizontal size={13} />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Collapsible Model Limits Sub-panel */}
                                          {isLimitsOpen && (
                                            <div className="pt-2.5 mt-2 border-t border-light-200 dark:border-[#221c15] grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/20 p-2.5 rounded-lg">
                                              <div>
                                                <label className="text-[10px] font-semibold text-[#f3d5ab] block mb-1">
                                                  {t('accessControl.modelLimit5hLabel') || '5-Hour Token Limit'}
                                                </label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="1"
                                                  value={currentModelLimits.tokenLimit5h ?? ''}
                                                  onChange={(e) => {
                                                    const v = e.target.value.trim();
                                                    const val = parseInt(v, 10);
                                                    handleUpdateModelLimit(
                                                      isUserScope ? 'user' : 'global',
                                                      m.key,
                                                      'tokenLimit5h',
                                                      v === '' || isNaN(val) ? null : Math.max(0, val),
                                                      activeModelUser,
                                                    );
                                                  }}
                                                  placeholder={t('accessControl.modelLimitPlaceholder') || 'empty = unlimited'}
                                                  className="w-full px-2.5 py-1.5 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                                                />
                                              </div>
                                              <div>
                                                <label className="text-[10px] font-semibold text-[#f3d5ab] block mb-1">
                                                  {t('accessControl.modelLimitDailyLabel') || 'Daily Token Limit (24h)'}
                                                </label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="1"
                                                  value={currentModelLimits.tokenLimitPerDay ?? ''}
                                                  onChange={(e) => {
                                                    const v = e.target.value.trim();
                                                    const val = parseInt(v, 10);
                                                    handleUpdateModelLimit(
                                                      isUserScope ? 'user' : 'global',
                                                      m.key,
                                                      'tokenLimitPerDay',
                                                      v === '' || isNaN(val) ? null : Math.max(0, val),
                                                      activeModelUser,
                                                    );
                                                  }}
                                                  placeholder={t('accessControl.modelLimitPlaceholder') || 'empty = unlimited'}
                                                  className="w-full px-2.5 py-1.5 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Footer Actions: Save Model Access */}
                      <div className="flex items-center justify-between pt-4 border-t border-light-200 dark:border-[#221c16]">
                        <span className="text-xs text-stone-400">
                          {isUserScope
                            ? `${activeModelUser?.username} — ${activeModelUser?.role}`
                            : `${disabledModels.length} ${t('accessControl.modelDisabled') || 'disabled models'}`}
                        </span>

                        <button
                          type="button"
                          disabled={isSavingModelAccess}
                          onClick={handleSaveModelAccess}
                          className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-semibold shadow-md active:scale-95 transition disabled:opacity-50"
                        >
                          <Check size={14} />
                          <span>
                            {isSavingModelAccess
                              ? '...'
                              : t('accessControl.modelAccessSave') || 'Save Model Access'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })()}

                  {/* TAB 3: USAGE LIMITS (GLOBAL & PER-USER) */}
                  {activeTab === 'limits' && (
                    <div className="space-y-6">
                      {/* SECTION 1: GLOBAL LIMITS (Always visible) */}
                      <div className="p-5 rounded-xl border border-[#b8864d]/30 bg-[#b8864d]/5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-[#b8864d]/20">
                          <div>
                            <h3 className="text-sm font-semibold text-[#f3d5ab] flex items-center space-x-2">
                              <Clock size={16} className="text-[#b8864d]" />
                              <span>
                                {t('accessControl.globalLimitsTitle') ||
                                  'Global Usage Limits (Instance-wide)'}
                              </span>
                            </h3>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {t('accessControl.globalLimitsDesc') ||
                                'Define token quotas applied across the entire instance.'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Limit 5h Global */}
                          <div className="p-3.5 rounded-lg border border-[#3d3122] bg-[#0d0b09] space-y-1.5">
                            <label className="text-xs font-semibold text-[#f3d5ab]">
                              {t('accessControl.limit5h') || '5-Hour Limit (Sliding Window)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={globalLimits.tokenLimit5h ?? ''}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const val = parseInt(v, 10);
                                setGlobalLimits({
                                  ...globalLimits,
                                  tokenLimit5h: v === '' || isNaN(val) ? null : Math.max(0, val),
                                });
                              }}
                              placeholder={t('accessControl.limit5hPlaceholder') || 'e.g. 50000 (empty = unlimited)'}
                              className="w-full px-3 py-2 rounded-lg border border-[#382d20] bg-black text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                            />
                            <p className="text-[10px] text-stone-400">
                              {t('accessControl.rolling5hNotice') ||
                                'Total tokens consumed in the last 5 hours rolling window.'}
                            </p>
                          </div>

                          {/* Limit Weekly Global */}
                          <div className="p-3.5 rounded-lg border border-[#3d3122] bg-[#0d0b09] space-y-1.5">
                            <label className="text-xs font-semibold text-[#f3d5ab]">
                              {t('accessControl.limitWeekly') || 'Weekly Limit (7 days)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={globalLimits.tokenLimitWeekly ?? ''}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const val = parseInt(v, 10);
                                setGlobalLimits({
                                  ...globalLimits,
                                  tokenLimitWeekly: v === '' || isNaN(val) ? null : Math.max(0, val),
                                });
                              }}
                              placeholder={t('accessControl.limitWeeklyPlaceholder') || 'e.g. 250000 (empty = unlimited)'}
                              className="w-full px-3 py-2 rounded-lg border border-[#382d20] bg-black text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                            />
                            <p className="text-[10px] text-stone-400">
                              {t('accessControl.rolling7dNotice') ||
                                'Total tokens consumed in the last 7 days.'}
                            </p>
                          </div>

                          {/* Limit Daily Global */}
                          <div className="p-3.5 rounded-lg border border-[#3d3122] bg-[#0d0b09] space-y-1.5">
                            <label className="text-xs font-semibold text-stone-300">
                              {t('accessControl.limitDaily') || 'Daily Limit (24h)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={globalLimits.tokenLimitPerDay ?? ''}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const val = parseInt(v, 10);
                                setGlobalLimits({
                                  ...globalLimits,
                                  tokenLimitPerDay: v === '' || isNaN(val) ? null : Math.max(0, val),
                                });
                              }}
                              placeholder={t('accessControl.limitDailyPlaceholder') || 'e.g. 100000 (empty = unlimited)'}
                              className="w-full px-3 py-2 rounded-lg border border-[#382d20] bg-black text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                            />
                          </div>

                          {/* Max Tokens Per Request Global */}
                          <div className="p-3.5 rounded-lg border border-[#3d3122] bg-[#0d0b09] space-y-1.5">
                            <label className="text-xs font-semibold text-stone-300">
                              {t('accessControl.maxPerRequest') || 'Max tokens / request'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={globalLimits.maxTokensPerRequest ?? ''}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const val = parseInt(v, 10);
                                setGlobalLimits({
                                  ...globalLimits,
                                  maxTokensPerRequest: v === '' || isNaN(val) ? null : Math.max(0, val),
                                });
                              }}
                              placeholder={t('accessControl.maxPerRequestPlaceholder') || 'e.g. 4096 (empty = unlimited)'}
                              className="w-full px-3 py-2 rounded-lg border border-[#382d20] bg-black text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                            />
                          </div>

                          {/* Quality Mode Max Tokens Global */}
                          <div className="p-3.5 rounded-lg border border-[#3d3122] bg-[#0d0b09] space-y-1.5 md:col-span-2">
                            <label className="text-xs font-semibold text-[#f3d5ab]">
                              {t('accessControl.qualityModeLimit') || 'Quality Mode Token Limit (Deep Research)'}
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={globalLimits.qualityModeMaxTokens ?? ''}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                const val = parseInt(v, 10);
                                setGlobalLimits({
                                  ...globalLimits,
                                  qualityModeMaxTokens: v === '' || isNaN(val) ? null : Math.max(0, val),
                                });
                              }}
                              placeholder={t('accessControl.qualityModeLimitPlaceholder') || 'e.g. 75000 (default 75,000)'}
                              className="w-full px-3 py-2 rounded-lg border border-[#382d20] bg-black text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                            />
                            <p className="text-[10px] text-stone-400">
                              {t('accessControl.qualityModeLimitDesc') ||
                                'Hard token limit for Quality mode per query to control multi-iteration research costs.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleSaveGlobalLimits}
                            className="px-4 py-2 rounded-lg bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-semibold transition active:scale-95 shadow-sm"
                          >
                            {t('accessControl.saveGlobalLimits') || 'Save Global Limits'}
                          </button>
                        </div>
                      </div>

                      {/* SECTION 2: PER-USER LIMITS (In multi-user mode) */}
                      {instanceMode === 'multi' && (
                        <div className="p-5 rounded-xl border border-light-200 dark:border-[#221c16] bg-light-secondary/20 dark:bg-[#120f0c] space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-[#221c16]">
                            <div>
                              <h3 className="text-sm font-semibold text-black dark:text-stone-200">
                                {t('accessControl.userLimitsTitle') || 'User Quotas'}
                              </h3>
                              <p className="text-xs text-stone-400 mt-0.5">
                                {t('accessControl.userLimitsDesc') ||
                                  'Individual token budgets per user account.'}
                              </p>
                            </div>

                            {usersList.length > 0 && (
                              <select
                                value={selectedUser?.id || ''}
                                onChange={(e) => {
                                  const found = usersList.find((u) => u.id === e.target.value);
                                  if (found) setSelectedUser(found);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none"
                              >
                                {usersList.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.username} ({u.role})
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {selectedUser ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs text-stone-300">
                                    {t('accessControl.limit5h') || '5-Hour Limit'}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={selectedUser.tokenLimit5h ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value.trim();
                                      const val = parseInt(v, 10);
                                      setSelectedUser({
                                        ...selectedUser,
                                        tokenLimit5h: v === '' || isNaN(val) ? null : Math.max(0, val),
                                      });
                                    }}
                                    placeholder={t('accessControl.limitPlaceholderEmpty') || 'empty = unlimited'}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-stone-300">
                                    {t('accessControl.limitWeekly') || 'Weekly Limit (7 days)'}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={selectedUser.tokenLimitWeekly ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value.trim();
                                      const val = parseInt(v, 10);
                                      setSelectedUser({
                                        ...selectedUser,
                                        tokenLimitWeekly: v === '' || isNaN(val) ? null : Math.max(0, val),
                                      });
                                    }}
                                    placeholder={t('accessControl.limitPlaceholderEmpty') || 'empty = unlimited'}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-stone-300">
                                    {t('accessControl.limitDaily') || 'Daily Limit (24h)'}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={selectedUser.tokenLimitPerDay ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value.trim();
                                      const val = parseInt(v, 10);
                                      setSelectedUser({
                                        ...selectedUser,
                                        tokenLimitPerDay: v === '' || isNaN(val) ? null : Math.max(0, val),
                                      });
                                    }}
                                    placeholder={t('accessControl.limitPlaceholderEmpty') || 'empty = unlimited'}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-stone-300">
                                    {t('accessControl.maxPerRequest') || 'Max tokens / request'}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={selectedUser.maxTokensPerRequest ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value.trim();
                                      const val = parseInt(v, 10);
                                      setSelectedUser({
                                        ...selectedUser,
                                        maxTokensPerRequest: v === '' || isNaN(val) ? null : Math.max(0, val),
                                      });
                                    }}
                                    placeholder={t('accessControl.limitPlaceholderEmpty') || 'empty = unlimited'}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-light-200 dark:border-[#382d20] bg-light-primary dark:bg-[#0c0a08] text-xs text-stone-200 focus:outline-none"
                                  />
                                </div>
                              </div>

                              <div className="flex justify-end pt-2">
                                <button
                                  onClick={() => handleUpdateUserLimits(selectedUser)}
                                  className="px-4 py-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-white text-xs font-semibold transition"
                                >
                                  {t('accessControl.saveLimitsFor') || 'Save limits for'}{' '}
                                  {selectedUser.username}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400">
                              {t('accessControl.selectUserPrompt') ||
                                'Select a user to edit limits.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: NETWORK & VAULT */}
                  {activeTab === 'security' && (
                    <div className="space-y-6">
                      {/* Ollama-style network exposure */}
                      <div className="p-5 rounded-xl border border-light-200 dark:border-[#261f18] bg-light-secondary/30 dark:bg-[#14100c] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 rounded-xl bg-[#b8864d]/15 text-[#b8864d]">
                              <Globe size={20} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-black dark:text-stone-100">
                                {t('accessControl.exposeToNetwork') || 'Expose instance to network'}
                              </h4>
                              <p className="text-xs text-stone-400 mt-0.5">
                                {t('accessControl.exposeToNetworkDesc') ||
                                  'Allows connections from other devices on local network.'}
                              </p>
                            </div>
                          </div>

                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exposeToNetwork}
                              onChange={(e) => handleToggleNetworkExposure(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b8864d]"></div>
                          </label>
                        </div>

                        <div className="text-xs text-stone-400 bg-black/20 p-3 rounded-lg border border-black/30">
                          {exposeToNetwork ? (
                            <span className="text-emerald-400 font-medium">
                              {t('accessControl.networkExposed') ||
                                '✓ Instance is accessible over the network with authentication.'}
                            </span>
                          ) : (
                            <span className="text-stone-400">
                              {t('accessControl.networkIsolated') ||
                                '🔒 Instance is isolated and listens only to localhost.'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Vault status */}
                      <div className="p-5 rounded-xl border border-light-200 dark:border-[#261f18] bg-light-secondary/30 dark:bg-[#14100c] space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                            <Lock size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-black dark:text-stone-100">
                              {t('accessControl.vaultStatus') || 'Encrypted Credential Vault (AES-256-GCM)'}
                            </h4>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {t('accessControl.vaultProtected') ||
                                'All API keys and provider credentials are automatically encrypted.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 text-xs text-emerald-400 font-mono bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-lg">
                          <CheckCircle2 size={15} />
                          <span>
                            {t('accessControl.vaultMasterKeyActive') ||
                              'Vault master key active (data/vault.key - 0600)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogPanel>
        </motion.div>

        {/* Network Admin Password Modal */}
        {showNetworkPasswordModal && (
          <Dialog
            open={showNetworkPasswordModal}
            onClose={() => setShowNetworkPasswordModal(false)}
            className="relative z-50"
          >
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-[#14110d] border border-[#3a2f22] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
                <div className="flex items-center space-x-3 text-[#b8864d]">
                  <KeyRound size={22} />
                  <h3 className="text-sm font-semibold text-stone-100">
                    {t('accessControl.adminPasswordRequired') || 'Admin password required'}
                  </h3>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  {t('accessControl.adminPasswordPrompt') ||
                    'Enabling network exposure in Single-User mode requires setting an admin password.'}
                </p>
                <input
                  type="password"
                  value={networkAdminPassword}
                  onChange={(e) => setNetworkAdminPassword(e.target.value)}
                  placeholder={
                    t('accessControl.newAdminPassword') ||
                    'New admin password (min. 8 chars)'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#382d20] bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                />
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNetworkPasswordModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200"
                  >
                    {t('accessControl.cancel') || 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmNetworkExposureWithPassword}
                    className="px-4 py-1.5 rounded-lg bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-semibold"
                  >
                    {t('accessControl.confirmAndEnable') || 'Confirm & Enable'}
                  </button>
                </div>
              </div>
            </div>
          </Dialog>
        )}

        {/* Multi-User Setup Admin Modal */}
        {showMultiUserSetupModal && (
          <Dialog
            open={showMultiUserSetupModal}
            onClose={() => setShowMultiUserSetupModal(false)}
            className="relative z-50"
          >
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <form
                onSubmit={handleSetupMultiUserAdmin}
                className="bg-[#14110d] border border-[#3a2f22] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl"
              >
                <div className="flex items-center space-x-3 text-[#b8864d]">
                  <Shield size={22} />
                  <h3 className="text-sm font-semibold text-stone-100">
                    {t('accessControl.multiUserSetupTitle') ||
                      'Admin Account Setup for Multi-User Mode'}
                  </h3>
                </div>
                <p className="text-xs text-stone-400 leading-relaxed">
                  {t('accessControl.multiUserSetupDesc') ||
                    'Before switching to Multi-User mode, you must configure an administrator account.'}
                </p>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">
                    {t('accessControl.adminUsername') || 'Administrator Username'}
                  </label>
                  <input
                    type="text"
                    value={setupAdminUsername}
                    onChange={(e) => setSetupAdminUsername(e.target.value)}
                    placeholder={
                      t('accessControl.adminUsernamePlaceholder') ||
                      'e.g. johndoe (cannot be "admin")'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#382d20] bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-amber-500/90 dark:text-amber-400/80 mt-1">
                    {t('accessControl.adminUsernameAdminForbidden') ||
                      'For security reasons, administrator username cannot be "admin".'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">
                    {t('accessControl.password') || 'Password'}
                  </label>
                  <input
                    type="password"
                    value={setupAdminPassword}
                    onChange={(e) => setSetupAdminPassword(e.target.value)}
                    placeholder={
                      t('accessControl.newAdminPassword') ||
                      'New admin password (min. 8 chars)'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#382d20] bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-stone-300 mb-1">
                    {t('accessControl.confirmPassword') || 'Confirm Password'}
                  </label>
                  <input
                    type="password"
                    value={setupConfirmPassword}
                    onChange={(e) => setSetupConfirmPassword(e.target.value)}
                    placeholder={
                      t('accessControl.confirmPassword') || 'Re-enter password'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#382d20] bg-[#0c0a08] text-xs text-stone-200 focus:outline-none focus:border-[#b8864d]"
                    required
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowMultiUserSetupModal(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200"
                  >
                    {t('accessControl.cancel') || 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingMultiUserSetup}
                    className="px-4 py-1.5 rounded-lg bg-[#b8864d] hover:bg-[#a37540] text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {isSubmittingMultiUserSetup
                      ? '...'
                      : t('accessControl.setupAdminAndSwitch') ||
                      'Create Account & Enable Multi-User'}
                  </button>
                </div>
              </form>
            </div>
          </Dialog>
        )}
      </Dialog>
      {isLoginOpen && (
        <LoginDialog
          isOpen={isLoginOpen}
          setIsOpen={setIsLoginOpen}
          currentUser={null}
          onAuthChange={() => {
            setIsLoginOpen(false);
            loadData();
          }}
        />
      )}
    </>
  );
};

export default AccessControlDialog;
