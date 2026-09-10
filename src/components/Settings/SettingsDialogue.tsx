import { Dialog, DialogPanel } from '@headlessui/react';
import {
  ArrowLeft,
  BrainCog,
  ChevronLeft,
  ExternalLink,
  Search,
  Sliders,
  ToggleRight,
  Lock,
} from 'lucide-react';
import Preferences from './Sections/Preferences';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Loader from '../ui/Loader';
import { cn } from '@/lib/utils';
import Models from './Sections/Models/Section';
import SearchSection from './Sections/Search';
import Select from '@/components/ui/Select';
import Personalization from './Sections/Personalization';
import { useTranslation } from '@/lib/i18n';
import { LoginDialog } from '@/components/Auth/LoginDialog';

const SettingsDialogue = ({
  isOpen,
  setIsOpen,
  initialSection,
}: {
  isOpen: boolean;
  setIsOpen: (active: boolean) => void;
  initialSection?: string;
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const sections = [
    {
      key: 'preferences',
      name: t('settings.preferences'),
      description: t('settings.preferencesDesc'),
      icon: Sliders,
      component: Preferences,
      dataAdd: 'preferences',
    },
    {
      key: 'personalization',
      name: t('settings.personalization'),
      description: t('settings.personalizationDesc'),
      icon: ToggleRight,
      component: Personalization,
      dataAdd: 'personalization',
    },
    {
      key: 'models',
      name: t('settings.models'),
      description: t('settings.modelsDesc'),
      icon: BrainCog,
      component: Models,
      dataAdd: 'modelProviders',
    },
    {
      key: 'search',
      name: t('settings.search'),
      description: t('settings.searchDesc'),
      icon: Search,
      component: SearchSection,
      dataAdd: 'search',
    },
  ];

  const [activeSection, setActiveSection] = useState<string>(
    initialSection || sections[0].key,
  );
  const [selectedSection, setSelectedSection] = useState(sections[0]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    setSelectedSection(sections.find((s) => s.key === activeSection) || sections[0]);
  }, [activeSection, sections]);

  useEffect(() => {
    if (isOpen) {
      const fetchConfig = async () => {
        try {
          setIsLoading(true);
          setAuthError(null);
          const res = await fetch('/api/config', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });

            if (res.status === 401 || res.status === 403) {
            const errData = await res.json().catch(() => ({}));
            setAuthError(
              errData.message ||
                t('auth.loginRequiredAdmin') ||
                'Admin login required to access settings.',
            );
            setConfig(null);
            return;
          }

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const data = await res.json();
          if (!data || !data.fields || !data.values) {
            throw new Error('Invalid configuration payload');
          }

          setConfig(data);
        } catch (error) {
          console.error('Error fetching config:', error);
          toast.error(t('settings.loadError'));
          setConfig(null);
        } finally {
          setIsLoading(false);
        }
      };

      fetchConfig();
    }
  }, [isOpen, t]);

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="relative z-50"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/30 backdrop-blur-sm h-screen"
        >
          <DialogPanel className="space-y-4 border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary backdrop-blur-lg rounded-xl h-[calc(100vh-2%)] w-[calc(100vw-2%)] md:h-[calc(100vh-7%)] md:w-[calc(100vw-7%)] lg:h-[calc(100vh-20%)] lg:w-[calc(100vw-30%)] overflow-hidden flex flex-col">
            {isLoading ? (
              <div className="flex items-center justify-center h-full w-full">
                <Loader />
              </div>
            ) : authError ? (
              <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center space-y-4">
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
                    className="px-4 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-200 transition"
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
                    {t('auth.login') || 'Log In'}
                  </button>
                </div>
              </div>
            ) : !config || !config.fields || !config.values ? (
              <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center space-y-4">
                <p className="text-xs text-stone-400">
                  {t('settings.loadError') || 'Failed to load configuration.'}
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-200"
                  >
                    {t('accessControl.cancel') || 'Close'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 inset-0 h-full overflow-hidden">
                <div className="hidden lg:flex flex-col justify-between w-[240px] border-r border-white-200 dark:border-dark-200 h-full px-3 pt-3 overflow-y-auto">
                  <div className="flex flex-col">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="group flex flex-row items-center hover:bg-light-200 hover:dark:bg-dark-200 p-2 rounded-lg"
                    >
                      <ChevronLeft
                        size={18}
                        className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70"
                      />
                      <p className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70 text-[14px]">
                        {t('common.back')}
                      </p>
                    </button>

                    <div className="flex flex-col items-start space-y-1 mt-8">
                      {sections.map((section) => (
                        <button
                          key={section.dataAdd}
                          className={cn(
                            `flex flex-row items-center space-x-2 px-2 py-1.5 rounded-lg w-full text-sm hover:bg-light-200 hover:dark:bg-dark-200 transition duration-200 active:scale-95`,
                            activeSection === section.key
                              ? 'bg-light-200 dark:bg-dark-200 text-black/90 dark:text-white/90'
                              : ' text-black/70 dark:text-white/70',
                          )}
                          onClick={() => setActiveSection(section.key)}
                        >
                          <section.icon size={17} />
                          <p>{section.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1 py-[18px] px-2">
                    <p className="text-xs text-black/70 dark:text-white/70">
                      {t('common.version')}: {process.env.NEXT_PUBLIC_VERSION} (
                      {t('common.basedOnVane')?.replace('{version}', '1.12.2') || 'Based on Vane v1.12.2'})
                    </p>
                    <a
                      href="https://github.com/akowynia/vane-community"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-black/70 dark:text-white/70 flex flex-row space-x-1 items-center transition duration-200 hover:text-black/90 hover:dark:text-white/90"
                    >
                      <span>GitHub</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <div className="w-full flex flex-col overflow-hidden">
                  <div className="flex flex-row lg:hidden w-full justify-between px-[20px] my-4 flex-shrink-0">
                    <button
                      onClick={() => setIsOpen(false)}
                      className="group flex flex-row items-center hover:bg-light-200 hover:dark:bg-dark-200 rounded-lg mr-[40%]"
                    >
                      <ArrowLeft
                        size={18}
                        className="text-black/50 dark:text-white/50 group-hover:text-black/70 group-hover:dark:text-white/70"
                      />
                    </button>
                    <Select
                      options={sections.map((section) => {
                        return {
                          value: section.key,
                          key: section.key,
                          label: section.name,
                        };
                      })}
                      value={activeSection}
                      onChange={(e) => {
                        setActiveSection(e.target.value);
                      }}
                      className="!text-xs lg:!text-sm"
                    />
                  </div>
                  {selectedSection.component && config?.fields && config?.values && (
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <div className="border-b border-light-200/60 px-6 pb-6 lg:pt-6 dark:border-dark-200/60 flex-shrink-0">
                        <div className="flex flex-col">
                          <h4 className="font-medium text-black dark:text-white text-sm lg:text-sm">
                            {selectedSection.name}
                          </h4>
                          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
                            {selectedSection.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <selectedSection.component
                          fields={config.fields[selectedSection.dataAdd] || []}
                          values={config.values[selectedSection.dataAdd] || {}}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogPanel>
        </motion.div>
      </Dialog>
      {isLoginOpen && (
        <LoginDialog
          isOpen={isLoginOpen}
          setIsOpen={setIsLoginOpen}
          currentUser={null}
          onAuthChange={() => {
            setIsLoginOpen(false);
            setIsOpen(true);
          }}
        />
      )}
    </>
  );
};

export default SettingsDialogue;
