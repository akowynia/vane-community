import {
  Description,
  Dialog,
  DialogPanel,
  DialogTitle,
  Switch,
} from '@headlessui/react';
import { Loader2, Plus, Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ConfigModelProvider,
  ModelProviderUISection,
  StringUIConfigField,
  UIConfigField,
} from '@/lib/config/types';
import Select from '@/components/ui/Select';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

const AddProvider = ({
  modelProviders,
  setProviders,
}: {
  modelProviders: ModelProviderUISection[];
  setProviders: React.Dispatch<React.SetStateAction<ConfigModelProvider[]>>;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<null | string>(
    modelProviders?.[0]?.key || null,
  );
  const [config, setConfig] = useState<Record<string, any>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  const providerConfigMap = useMemo(() => {
    const map: Record<string, { name: string; fields: UIConfigField[] }> = {};

    (modelProviders || []).forEach((p) => {
      if (p && p.key) {
        map[p.key] = {
          name: p.name,
          fields: p.fields || [],
        };
      }
    });

    return map;
  }, [modelProviders]);

  const selectedProviderFields = useMemo(() => {
    if (!selectedProvider) return [];
    const providerFields = providerConfigMap[selectedProvider]?.fields || [];
    const config: Record<string, any> = {};

    providerFields.forEach((field) => {
      if (field && field.key) {
        config[field.key] =
          field.default ||
          (selectedProvider === 'ollama' && field.key === 'baseURL'
            ? 'http://host.docker.internal:11434'
            : '');
      }
    });

    setConfig(config);

    return providerFields;
  }, [selectedProvider, providerConfigMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedProvider,
          name: name,
          config: config,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to add provider');
      }

      const data: ConfigModelProvider = (await res.json()).provider;

      setProviders((prev) => [...prev, data]);

      toast.success(t('settings.connectionAddSuccess'));
    } catch (error) {
      console.error('Error adding provider:', error);
      toast.error(t('settings.connectionAddError'));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    setTesting(true);
    try {
      const res = await fetch('/api/diagnostics/provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedProvider,
          config: config,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          t('settings.connectionSuccessful', { latency: data.latencyMs }) +
            ` (${data.chatModelsCount} chat, ${data.embeddingModelsCount} embedding)`,
        );
      } else {
        toast.error(
          `${t('settings.connectionFailed')}: ${data.error || 'Unknown error'}`,
        );
      }
    } catch (err: any) {
      toast.error(
        `${t('settings.connectionFailed')}: ${err?.message || err}`,
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs sm:text-xs border border-light-200 dark:border-dark-200 text-black dark:text-white bg-light-secondary/50 dark:bg-dark-secondary/50 hover:bg-light-secondary hover:dark:bg-dark-secondary hover:border-light-300 hover:dark:border-dark-300 flex flex-row items-center space-x-1 active:scale-95 transition duration-200"
      >
        <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
        <span>{t('settings.addConnection')}</span>
      </button>
      <AnimatePresence>
        {open && (
          <Dialog
            static
            open={open}
            onClose={() => setOpen(false)}
            className="relative z-50"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="fixed inset-0 bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex items-center justify-center p-4"
            >
              <DialogPanel className="w-full max-w-md rounded-xl bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 shadow-xl overflow-hidden">
                <div className="px-6 pt-5 pb-1">
                  <h3 className="text-base text-black dark:text-white font-medium">
                    {t('settings.addNewConnection')}
                  </h3>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="p-6">
                    <div className="flex flex-col space-y-4">
                      <div
                        key="provider"
                        className="flex flex-col items-start space-y-2"
                      >
                        <label className="text-xs text-black/70 dark:text-white/70">
                          {t('settings.selectConnectionType')}*
                        </label>
                        <Select
                          value={selectedProvider ?? ''}
                          onChange={(e) => {
                            setSelectedProvider(e.target.value);
                            setConfig({});
                          }}
                          options={Object.entries(providerConfigMap).map(
                            ([key, val]) => {
                              return {
                                label: val.name,
                                value: key,
                              };
                            },
                          )}
                        />
                      </div>

                      <div
                        key="name"
                        className="flex flex-col items-start space-y-2"
                      >
                        <label className="text-xs text-black/70 dark:text-white/70">
                          {t('settings.connectionName')}*
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 pr-10 text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder={t('settings.connectionNamePlaceholder')}
                          type="text"
                          required={true}
                        />
                      </div>

                      {selectedProviderFields.map((field: UIConfigField) => {
                        if (field.type === 'switch') {
                          const isChecked =
                            config[field.key] !== undefined
                              ? config[field.key] === true ||
                                config[field.key] === 'true'
                              : field.default !== undefined
                                ? field.default
                                : true;

                          return (
                            <div
                              key={field.key}
                              className="flex flex-row items-center justify-between p-3 rounded-lg border border-light-200 dark:border-dark-200 bg-light-secondary/40 dark:bg-dark-secondary/40"
                            >
                              <div className="flex flex-col pr-3">
                                <label className="text-xs font-medium text-black/80 dark:text-white/80">
                                  {field.name}
                                </label>
                                {field.description && (
                                  <p className="text-[11px] text-black/50 dark:text-white/50 leading-tight mt-0.5">
                                    {field.description}
                                  </p>
                                )}
                              </div>
                              <Switch
                                checked={Boolean(isChecked)}
                                onChange={(val: boolean) =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    [field.key]: val,
                                  }))
                                }
                                className="group relative flex h-6 w-12 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-1 duration-200 ease-in-out focus:outline-none transition-colors data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
                              >
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-6"
                                />
                              </Switch>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={field.key}
                            className="flex flex-col items-start space-y-2"
                          >
                            <label className="text-xs text-black/70 dark:text-white/70">
                              {field.name}
                              {field.required && '*'}
                            </label>
                            <input
                              value={config[field.key] ?? field.default ?? ''}
                              onChange={(event) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  [field.key]: event.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 pr-10 text-[13px] text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                              placeholder={
                                (field as StringUIConfigField).placeholder
                              }
                              type={
                                field.type === 'password'
                                  ? 'password'
                                  : 'text'
                              }
                              required={field.required}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="border-t border-light-200 dark:border-dark-200" />
                  <div className="px-6 py-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testing || loading || !selectedProvider}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary hover:dark:bg-dark-200 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white border border-light-200 dark:border-dark-200 transition-colors disabled:opacity-50"
                    >
                      {testing ? (
                        <Loader2 className="animate-spin text-sky-500" size={14} />
                      ) : (
                        <Activity className="text-sky-500" size={14} />
                      )}
                      <span>
                        {testing
                          ? t('settings.testingConnection')
                          : t('settings.testConnection')}
                      </span>
                    </button>
                    <button
                      type="submit"
                      disabled={loading || testing}
                      className="px-4 py-2 rounded-lg text-[13px] bg-sky-500 text-white font-medium disabled:opacity-85 hover:opacity-85 active:scale-95 transition duration-200"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        t('settings.addConnection')
                      )}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </motion.div>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddProvider;
