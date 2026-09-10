import { Dialog, DialogPanel, Switch } from '@headlessui/react';
import { Loader2, Pencil, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ConfigModelProvider,
  StringUIConfigField,
  UIConfigField,
} from '@/lib/config/types';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

const UpdateProvider = ({
  modelProvider,
  fields,
  setProviders,
}: {
  fields: UIConfigField[];
  modelProvider: ConfigModelProvider;
  setProviders: React.Dispatch<React.SetStateAction<ConfigModelProvider[]>>;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [name, setName] = useState(modelProvider.name);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const initialConfig: Record<string, any> = {
      name: modelProvider?.name || '',
    };

    const provConfig = modelProvider?.config || {};

    (fields || []).forEach((field) => {
      if (field && field.key) {
        initialConfig[field.key] =
          provConfig[field.key] ?? field.default ?? '';
      }
    });

    setConfig(initialConfig);
    setName(modelProvider?.name || '');
  }, [fields, modelProvider, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/providers/${modelProvider.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          config: config,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update provider');
      }

      const data: ConfigModelProvider = (await res.json()).provider;

      setProviders((prev) => {
        return prev.map((p) => {
          if (p.id === modelProvider.id) {
            return data;
          }

          return p;
        });
      });

      toast.success(t('settings.connectionUpdateSuccess'));
    } catch (error) {
      console.error('Error updating provider:', error);
      toast.error(t('settings.connectionUpdateError'));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/diagnostics/provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: modelProvider.id,
          type: modelProvider.type,
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="group p-1.5 rounded-md hover:bg-light-200 hover:dark:bg-dark-200 transition-colors group"
      >
        <Pencil
          size={14}
          className="text-black/60 dark:text-white/60 group-hover:text-black group-hover:dark:text-white"
        />
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
                    {t('settings.updateConnection')}
                  </h3>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="p-6">
                    <div className="flex flex-col space-y-4">
                      <div
                        key="name"
                        className="flex flex-col items-start space-y-2"
                      >
                        <label className="text-xs text-black/70 dark:text-white/70">
                          {t('settings.connectionName')}*
                        </label>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 pr-10 text-sm text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder={t('settings.connectionName')}
                          type="text"
                          required={true}
                        />
                      </div>

                      {fields.map((field: UIConfigField) => {
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
                      disabled={testing || loading}
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
                        t('settings.updateConnection')
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

export default UpdateProvider;
