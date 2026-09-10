import {
  SelectUIConfigField,
  StringUIConfigField,
  SwitchUIConfigField,
  TextareaUIConfigField,
  UIConfigField,
} from '@/lib/config/types';
import { useState } from 'react';
import Select from '../ui/Select';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { Loader2, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Switch } from '@headlessui/react';
import { useTranslation } from '@/lib/i18n';

const fieldTitleKeys: Record<string, string> = {
  theme: 'settings.theme',
  language: 'settings.language',
  measureUnit: 'settings.measureUnit',
  autoMediaSearch: 'settings.autoMediaSearch',
  showWeatherWidget: 'settings.showWeatherWidget',
  showNewsWidget: 'settings.showNewsWidget',
  systemInstructions: 'settings.systemInstructions',
  searxngURL: 'settings.searxngUrl',
};

const fieldDescKeys: Record<string, string> = {
  theme: 'settings.themeDesc',
  language: 'settings.languageDesc',
  measureUnit: 'settings.measureUnitDesc',
  autoMediaSearch: 'settings.autoMediaSearchDesc',
  showWeatherWidget: 'settings.showWeatherWidgetDesc',
  showNewsWidget: 'settings.showNewsWidgetDesc',
  systemInstructions: 'settings.systemInstructionsDesc',
  searxngURL: 'settings.searxngUrlDesc',
};

const optionLabelKeys: Record<string, string> = {
  light: 'settings.light',
  dark: 'settings.dark',
  Imperial: 'settings.imperial',
  Metric: 'settings.metric',
};

const emitClientConfigChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('client-config-changed'));
  }
};

const SettingsSelect = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: SelectUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { setTheme } = useTheme();

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        if (field.key === 'theme') {
          setTheme(newValue);
        }
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  const title = fieldTitleKeys[field.key] ? t(fieldTitleKeys[field.key] as any) : field.name;
  const desc = fieldDescKeys[field.key] ? t(fieldDescKeys[field.key] as any) : field.description;

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {title}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {desc}
          </p>
        </div>
        <Select
          value={value}
          onChange={(event) => handleSave(event.target.value)}
          options={field.options.map((option) => ({
            value: option.value,
            label: optionLabelKeys[option.value] ? t(optionLabelKeys[option.value] as any) : option.name,
          }))}
          className="!text-xs lg:!text-sm"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

const SettingsInput = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: StringUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  const handleTestSearxng = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/diagnostics/searxng', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: value ?? field.default ?? '' }),
      });
      const data = await res.json();
      if (data.success) {
        const successMsg = t('settings.connectionSuccessful', {
          latency: data.latencyMs,
        });
        setTestResult({
          success: true,
          message: successMsg,
          latencyMs: data.latencyMs,
        });
        toast.success(successMsg);
      } else {
        const errorMsg = data.error || t('settings.connectionFailed');
        setTestResult({
          success: false,
          message: errorMsg,
        });
        toast.error(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || t('settings.connectionFailed');
      setTestResult({
        success: false,
        message: errorMsg,
      });
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const title = fieldTitleKeys[field.key] ? t(fieldTitleKeys[field.key] as any) : field.name;
  const desc = fieldDescKeys[field.key] ? t(fieldDescKeys[field.key] as any) : field.description;

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {title}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {desc}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="relative">
            <input
              value={value ?? field.default ?? ''}
              onChange={(event) => {
                setValue(event.target.value);
                setTestResult(null);
              }}
              onBlur={(event) => handleSave(event.target.value)}
              className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 lg:px-4 lg:py-3 pr-10 !text-xs lg:!text-[13px] text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={field.placeholder}
              type="text"
              disabled={loading}
            />
            {loading && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
            )}
          </div>

          {field.key === 'searxngURL' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSearxng}
                disabled={testing || loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-light-secondary hover:bg-light-200 dark:bg-dark-secondary hover:dark:bg-dark-200 text-black/70 dark:text-white/70 hover:text-black hover:dark:text-white border border-light-200 dark:border-dark-200 transition-colors disabled:opacity-50"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />
                ) : (
                  <Activity className="h-3.5 w-3.5 text-sky-500" />
                )}
                <span>
                  {testing
                    ? t('settings.testingConnection')
                    : t('settings.testConnection')}
                </span>
              </button>

              {testResult && (
                <div
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border ${
                    testResult.success
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate max-w-[320px]">
                    {testResult.message}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

const SettingsTextarea = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: TextareaUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: any) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, newValue);
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  const title = fieldTitleKeys[field.key] ? t(fieldTitleKeys[field.key] as any) : field.name;
  const desc = fieldDescKeys[field.key] ? t(fieldDescKeys[field.key] as any) : field.description;
  const placeholder = field.key === 'systemInstructions'
    ? t('settings.systemInstructionsPlaceholder')
    : field.placeholder;

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {title}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {desc}
          </p>
        </div>
        <div className="relative">
          <textarea
            value={value ?? field.default ?? ''}
            onChange={(event) => setValue(event.target.value)}
            onBlur={(event) => handleSave(event.target.value)}
            className="w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-3 py-2 lg:px-4 lg:py-3 pr-10 !text-xs lg:!text-[13px] text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none focus-visible:border-light-300 dark:focus-visible:border-dark-300 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            placeholder={placeholder}
            rows={4}
            disabled={loading}
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 translate-y-3 text-black/40 dark:text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

const SettingsSwitch = ({
  field,
  value,
  setValue,
  dataAdd,
}: {
  field: SwitchUIConfigField;
  value?: any;
  setValue: (value: any) => void;
  dataAdd: string;
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSave = async (newValue: boolean) => {
    setLoading(true);
    setValue(newValue);
    try {
      if (field.scope === 'client') {
        localStorage.setItem(field.key, String(newValue));
        emitClientConfigChanged();
      } else {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: `${dataAdd}.${field.key}`,
            value: newValue,
          }),
        });

        if (!res.ok) {
          console.error('Failed to save config:', await res.text());
          throw new Error('Failed to save configuration');
        }
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setTimeout(() => setLoading(false), 150);
    }
  };

  const title = fieldTitleKeys[field.key] ? t(fieldTitleKeys[field.key] as any) : field.name;
  const desc = fieldDescKeys[field.key] ? t(fieldDescKeys[field.key] as any) : field.description;
  const isChecked = value === true || value === 'true';

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="flex flex-row items-center space-x-3 lg:space-x-5 w-full justify-between">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {title}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {desc}
          </p>
        </div>
        <Switch
          checked={isChecked}
          onChange={handleSave}
          disabled={loading}
          className="group relative flex h-6 w-12 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-1 duration-200 ease-in-out focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed data-[checked]:bg-sky-500 dark:data-[checked]:bg-sky-500"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-6"
          />
        </Switch>
      </div>
    </section>
  );
};

const SettingsField = ({
  field,
  value,
  dataAdd,
}: {
  field: UIConfigField;
  value: any;
  dataAdd: string;
}) => {
  const [val, setVal] = useState(value);

  switch (field.type) {
    case 'select':
      return (
        <SettingsSelect
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'string':
      return (
        <SettingsInput
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'textarea':
      return (
        <SettingsTextarea
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    case 'switch':
      return (
        <SettingsSwitch
          field={field}
          value={val}
          setValue={setVal}
          dataAdd={dataAdd}
        />
      );
    default:
      return <div>Unsupported field type: {field.type}</div>;
  }
};

export default SettingsField;
