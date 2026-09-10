import {
  ConfigModelProvider,
  UIConfigField,
  UIConfigSections,
} from '@/lib/config/types';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, User, Users, Globe, Lock, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import AddProvider from '../Settings/Sections/Models/AddProviderDialog';
import ModelProvider from '../Settings/Sections/Models/ModelProvider';
import ModelSelect from '@/components/Settings/Sections/Models/ModelSelect';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const SetupConfig = ({
  configSections,
  setupState,
  setSetupState,
}: {
  configSections: UIConfigSections;
  setupState: number;
  setSetupState: (state: number) => void;
}) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ConfigModelProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);

  // Step 1: Mode & Network exposure state
  const [instanceMode, setInstanceMode] = useState<'single' | 'multi'>('single');
  const [exposeToNetwork, setExposeToNetwork] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [isSavingMode, setIsSavingMode] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to fetch providers');

        const data = await res.json();
        setProviders(data.providers || []);
      } catch (error) {
        console.error('Error fetching providers:', error);
        toast.error(t('setup.loadProvidersError'));
      } finally {
        setIsLoading(false);
      }
    };

    if (setupState === 3) {
      fetchProviders();
    }
  }, [setupState, t]);

  const handleNextFromMode = async () => {
    if (instanceMode === 'multi') {
      const trimmedUser = adminUsername.trim().toLowerCase();
      if (!trimmedUser) {
        toast.error(t('setup.adminUsername') || 'Enter administrator username');
        return;
      }
      if (trimmedUser === 'admin') {
        toast.error(
          t('setup.adminUsernameAdminForbidden') ||
            'For security reasons, administrator username cannot be "admin".',
        );
        return;
      }
      if (trimmedUser.length < 3 || trimmedUser.length > 32) {
        toast.error('Username must be between 3 and 32 characters.');
        return;
      }
      if (!/^[a-z0-9_-]+$/.test(trimmedUser)) {
        toast.error('Username can only contain lowercase letters, numbers, "_" and "-".');
        return;
      }
      if (adminPassword.length < 8) {
        toast.error(t('setup.adminPasswordMinLength') || 'Administrator password must be at least 8 characters');
        return;
      }
      if (adminPassword !== confirmAdminPassword) {
        toast.error(t('setup.passwordsDoNotMatch') || 'Passwords do not match.');
        return;
      }
    } else if (exposeToNetwork || adminPassword) {
      if (adminPassword.length < 8) {
        toast.error(t('setup.adminPasswordMinLength') || 'Administrator password must be at least 8 characters');
        return;
      }
      if (confirmAdminPassword && adminPassword !== confirmAdminPassword) {
        toast.error(t('setup.passwordsDoNotMatch') || 'Passwords do not match.');
        return;
      }
    }

    try {
      setIsSavingMode(true);

      if (instanceMode === 'multi') {
        const res = await fetch('/api/users/setup-multiuser-admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: adminUsername.trim(),
            password: adminPassword,
            confirmPassword: confirmAdminPassword,
            displayName: adminUsername.trim(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Administrator setup error');
        }

        if (exposeToNetwork) {
          await fetch('/api/config/network-exposure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exposeToNetwork: true,
              expose: true,
              adminPassword,
            }),
          }).catch(() => {});
        }
      } else {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'instanceMode',
            value: 'single',
          }),
        });

        if (exposeToNetwork || adminPassword) {
          await fetch('/api/config/network-exposure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exposeToNetwork: exposeToNetwork,
              expose: exposeToNetwork,
              adminPassword: adminPassword || undefined,
            }),
          });
        }
      }

      setSetupState(3);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save mode configuration');
    } finally {
      setIsSavingMode(false);
    }
  };

  const handleFinish = async () => {
    try {
      setIsFinishing(true);
      const res = await fetch('/api/config/setup-complete', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to complete setup');

      window.location.reload();
    } catch (error) {
      console.error('Error completing setup:', error);
      toast.error(t('setup.completeSetupError'));
      setIsFinishing(false);
    }
  };

  const visibleProviders = providers.filter(
    (p) => p.name.toLowerCase() !== 'transformers',
  );
  const hasProviders =
    visibleProviders.filter((p) => p.chatModels.length > 0).length > 0;

  return (
    <div className="w-[95vw] md:w-[80vw] lg:w-[65vw] mx-auto px-2 sm:px-4 md:px-6 flex flex-col space-y-6">
      {/* STEP 1 (setupState === 2): Operating Mode & Network */}
      {setupState === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-[#0f0d0a] border border-light-200 dark:border-[#261f18] rounded-2xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-6 space-y-6">
            <div className="pb-4 border-b border-light-200 dark:border-[#221c16]">
              <h3 className="text-base sm:text-lg font-semibold text-black dark:text-stone-100">
                {t('setup.stepModeTitle') || 'Choose Operating Mode'}
              </h3>
              <p className="text-xs sm:text-sm text-black/60 dark:text-stone-400 mt-1">
                {t('setup.stepModeDesc') || 'Configure how access and authentication should be handled.'}
              </p>
            </div>

            {/* Mode selection cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Single-User Card */}
              <div
                onClick={() => setInstanceMode('single')}
                className={cn(
                  'cursor-pointer p-5 rounded-xl border transition duration-200 flex flex-col justify-between space-y-3',
                  instanceMode === 'single'
                    ? 'border-[#b8864d] bg-[#b8864d]/10'
                    : 'border-light-200 dark:border-[#261f18] hover:border-[#b8864d]/50 bg-light-secondary/40 dark:bg-[#15110d]',
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-[#b8864d]/20 text-[#b8864d]">
                    <User size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-black dark:text-stone-100">
                      {t('setup.singleUserMode') || 'Single-User (Personal)'}
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                  {t('setup.singleUserDesc') ||
                    'Direct access on localhost without passwords. Ideal for private local use.'}
                </p>
              </div>

              {/* Multi-User Card */}
              <div
                onClick={() => setInstanceMode('multi')}
                className={cn(
                  'cursor-pointer p-5 rounded-xl border transition duration-200 flex flex-col justify-between space-y-3',
                  instanceMode === 'multi'
                    ? 'border-[#b8864d] bg-[#b8864d]/10'
                    : 'border-light-200 dark:border-[#261f18] hover:border-[#b8864d]/50 bg-light-secondary/40 dark:bg-[#15110d]',
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-[#b8864d]/20 text-[#b8864d]">
                    <Users size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-black dark:text-stone-100">
                      {t('setup.multiUserMode') || 'Multi-User (Team / Organization)'}
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-black/60 dark:text-stone-400 leading-relaxed">
                  {t('setup.multiUserDesc') ||
                    'Requires admin login and allows setting up separate user accounts with specific permissions and quotas.'}
                </p>
              </div>
            </div>

            {/* Admin credentials input (required for Multi-User or Expose Network) */}
            {(instanceMode === 'multi' || exposeToNetwork) && (
              <div className="p-5 rounded-xl border border-[#b8864d]/30 bg-[#b8864d]/5 space-y-4">
                <div className="flex items-center space-x-2 text-[#b8864d]">
                  <Lock size={16} />
                  <span className="text-xs font-semibold">
                    {t('setup.adminAccount') || 'Administrator Account'}
                  </span>
                </div>

                {instanceMode === 'multi' && (
                  <div>
                    <label className="text-xs text-black/70 dark:text-stone-300">
                      {t('setup.adminUsername') || 'Administrator Username'}
                    </label>
                    <input
                      type="text"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder={
                        t('setup.adminUsernamePlaceholder') ||
                        'e.g. johndoe (cannot be "admin")'
                      }
                      className="w-full mt-1.5 px-3 py-2 rounded-xl border border-[#3d3122] bg-[#0d0b09] text-xs text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      required
                    />
                    <p className="text-[11px] text-amber-500/90 dark:text-amber-400/80 mt-1">
                      {t('setup.adminUsernameAdminForbidden') ||
                        'For security reasons, administrator username cannot be "admin".'}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-black/70 dark:text-stone-300">
                      {t('setup.adminPassword') || 'Admin Password (min. 8 chars)'}
                    </label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full mt-1.5 px-3 py-2 rounded-xl border border-[#3d3122] bg-[#0d0b09] text-xs text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-black/70 dark:text-stone-300">
                      {t('setup.confirmAdminPassword') || 'Confirm Password'}
                    </label>
                    <input
                      type="password"
                      value={confirmAdminPassword}
                      onChange={(e) => setConfirmAdminPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full mt-1.5 px-3 py-2 rounded-xl border border-[#3d3122] bg-[#0d0b09] text-xs text-stone-100 focus:outline-none focus:border-[#b8864d]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Network exposure toggle */}
            <div className="p-5 rounded-xl border border-light-200 dark:border-[#261f18] bg-light-secondary/30 dark:bg-[#14100c] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-[#b8864d]/15 text-[#b8864d]">
                  <Globe size={20} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-black dark:text-stone-100">
                    {t('setup.exposeNetworkCheckbox') || 'Expose instance to the network'}
                  </h4>
                  <p className="text-[11px] text-black/60 dark:text-stone-400 mt-0.5">
                    {t('setup.exposeNetworkNotice') ||
                      'Allows other devices on your local network to connect. Requires an admin password or API key.'}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={exposeToNetwork}
                  onChange={(e) => setExposeToNetwork(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b8864d]"></div>
              </label>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 2 (setupState === 3): Connections & Providers */}
      {setupState === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  {t('setup.manageConnections')}
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  {t('setup.manageConnectionsDesc')}
                </p>
              </div>
              <AddProvider
                modelProviders={configSections?.modelProviders || []}
                setProviders={setProviders}
              />
            </div>

            <div className="space-y-3 md:space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 md:py-12">
                  <p className="text-xs sm:text-sm text-black/50 dark:text-white/50">
                    {t('setup.loadingProviders')}
                  </p>
                </div>
              ) : visibleProviders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 md:py-12 text-center">
                  <p className="text-xs sm:text-sm font-medium text-black/70 dark:text-white/70">
                    {t('setup.noConnectionsConfigured')}
                  </p>
                  <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-1">
                    {t('setup.clickAddConnectionToStart')}
                  </p>
                </div>
              ) : (
                visibleProviders.map((provider) => (
                  <ModelProvider
                    key={`provider-${provider.id}`}
                    fields={
                      ((configSections?.modelProviders || []).find(
                        (f) => f.key === provider.type,
                      )?.fields ?? []) as UIConfigField[]
                    }
                    modelProvider={provider}
                    setProviders={setProviders}
                  />
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 3 (setupState === 4): Model Selection */}
      {setupState === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1 } }}
          className="w-full h-[calc(95vh-80px)] bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-sm flex flex-col overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-4 md:py-6">
            <div className="flex flex-row justify-between items-center mb-4 md:mb-6 pb-3 md:pb-4 border-b border-light-200 dark:border-dark-200">
              <div>
                <p className="text-xs sm:text-sm font-medium text-black dark:text-white">
                  {t('setup.selectModels')}
                </p>
                <p className="text-[10px] sm:text-xs text-black/50 dark:text-white/50 mt-0.5">
                  {t('setup.selectModelsDesc')}
                </p>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <ModelSelect providers={providers} type="chat" />
              <ModelSelect providers={providers} type="embedding" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation Buttons */}
      <div className="flex flex-row items-center justify-between pt-2">
        {setupState > 2 ? (
          <button
            onClick={() => setSetupState(setupState - 1)}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-black/60 dark:text-stone-400 hover:text-black dark:hover:text-stone-100 hover:bg-light-200 dark:hover:bg-[#1c1813] transition"
          >
            <ArrowLeft size={16} />
            <span>{t('setup.back') || 'Back'}</span>
          </button>
        ) : (
          <div />
        )}

        {setupState === 2 && (
          <motion.button
            onClick={handleNextFromMode}
            disabled={isSavingMode}
            className="flex flex-row items-center gap-2 px-5 py-2.5 rounded-xl bg-[#b8864d] text-white hover:bg-[#a37540] active:scale-95 transition-all font-semibold text-xs shadow-md"
          >
            <span>{t('setup.next')}</span>
            <ArrowRight size={16} />
          </motion.button>
        )}

        {setupState === 3 && (
          <motion.button
            onClick={() => setSetupState(4)}
            disabled={!hasProviders || isLoading}
            className="flex flex-row items-center gap-2 px-5 py-2.5 rounded-xl bg-[#b8864d] text-white hover:bg-[#a37540] active:scale-95 transition-all font-semibold text-xs shadow-md disabled:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{t('setup.next')}</span>
            <ArrowRight size={16} />
          </motion.button>
        )}

        {setupState === 4 && (
          <motion.button
            onClick={handleFinish}
            disabled={!hasProviders || isLoading || isFinishing}
            className="flex flex-row items-center gap-2 px-5 py-2.5 rounded-xl bg-[#b8864d] text-white hover:bg-[#a37540] active:scale-95 transition-all font-semibold text-xs shadow-md disabled:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{isFinishing ? t('setup.finishing') : t('setup.finish')}</span>
            <Check size={16} />
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default SetupConfig;

