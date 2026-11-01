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
import { Loader2, Activity, AlertCircle, CheckCircle2, Check } from 'lucide-react';
import { Switch } from '@headlessui/react';
import { useTranslation } from '@/lib/i18n';
import { THEMES, ThemeCategory, ThemeId } from '@/lib/theme';

const fieldTitleKeys: Record<string, string> = {
  theme: 'settings.theme',
  language: 'settings.language',
  measureUnit: 'settings.measureUnit',
  autoMediaSearch: 'settings.autoMediaSearch',
  showWeatherWidget: 'settings.showWeatherWidget',
  showNewsWidget: 'settings.showNewsWidget',
  systemInstructions: 'settings.systemInstructions',
  searxngURL: 'settings.searxngUrl',
  enablePresentations: 'settings.betaPresentations',
  presentations: 'settings.betaPresentations',
  pdfExportStyle: 'settings.pdfExportStyle',
  pdfShowBranding: 'settings.pdfShowBranding',
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
  enablePresentations: 'settings.betaPresentationsDesc',
  presentations: 'settings.betaPresentationsDesc',
  pdfExportStyle: 'settings.pdfExportStyleDesc',
  pdfShowBranding: 'settings.pdfShowBrandingDesc',
};

const optionLabelKeys: Record<string, string> = {
  light: 'settings.themeLight',
  dark: 'settings.themeDark',
  cyberpunk: 'settings.themeCyberpunk',
  nord: 'settings.themeNord',
  'retro-terminal': 'settings.themeRetroTerminal',
  synthwave: 'settings.themeSynthwave',
  'vintage-paper': 'settings.themeVintagePaper',
  matrix: 'settings.themeMatrix',
  Imperial: 'settings.imperial',
  Metric: 'settings.metric',
  vane: 'settings.pdfExportStyleVane',
  minimal: 'settings.pdfExportStyleMinimal',
  corporate: 'settings.pdfExportStyleCorporate',
  academic: 'settings.pdfExportStyleAcademic',
};

const emitClientConfigChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('client-config-changed'));
  }
};

const ThemePickerCards = ({
  currentTheme,
  onSelectTheme,
  loading,
}: {
  currentTheme: string;
  onSelectTheme: (themeId: ThemeId) => void;
  loading: boolean;
}) => {
  const { t } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState<'all' | ThemeCategory>('all');

  const filteredThemes = THEMES.filter((item) => {
    if (categoryFilter === 'all') return true;
    return item.category === categoryFilter;
  });

  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center gap-1.5 pb-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
            categoryFilter === 'all'
              ? 'bg-bronze-500 text-white shadow-sm'
              : 'bg-light-200/60 dark:bg-dark-200/60 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200'
          }`}
        >
          {t('common.all') || 'All'}
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('modern')}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
            categoryFilter === 'modern'
              ? 'bg-bronze-500 text-white shadow-sm'
              : 'bg-light-200/60 dark:bg-dark-200/60 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200'
          }`}
        >
          {t('settings.themeModern' as any) || 'Modern'}
        </button>
        <button
          type="button"
          onClick={() => setCategoryFilter('retro')}
          className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
            categoryFilter === 'retro'
              ? 'bg-bronze-500 text-white shadow-sm'
              : 'bg-light-200/60 dark:bg-dark-200/60 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200'
          }`}
        >
          {t('settings.themeRetro' as any) || 'Retro'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {filteredThemes.map((item) => {
          const isSelected = (currentTheme || 'dark') === item.id;
          const themeName = t(item.nameKey as any) || item.id;
          const themeDesc = t(item.descKey as any) || '';

          return (
            <button
              key={item.id}
              type="button"
              disabled={loading}
              onClick={() => onSelectTheme(item.id)}
              className={`group relative flex flex-col justify-between text-left p-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'border-bronze-500 ring-2 ring-bronze-500/40 bg-light-secondary dark:bg-dark-secondary shadow-md scale-[1.01]'
                  : 'border-light-200 dark:border-dark-200 hover:border-light-300 dark:hover:border-dark-300 bg-light-primary dark:bg-dark-primary/60 hover:bg-light-secondary/60 dark:hover:bg-dark-secondary/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="font-semibold text-xs sm:text-sm text-black dark:text-white truncate">
                    {themeName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full ${
                        item.category === 'retro'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
                      }`}
                    >
                      {item.category === 'retro'
                        ? t('settings.themeRetro' as any) || 'Retro'
                        : t('settings.themeModern' as any) || 'Modern'}
                    </span>
                    {isSelected && (
                      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-bronze-500 text-white">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="w-full h-11 rounded-lg border p-1.5 flex items-center justify-between overflow-hidden shadow-inner mb-2"
                  style={{
                    backgroundColor: item.colors.primaryBg,
                    borderColor: item.colors.borderColor,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-7 rounded-sm"
                      style={{ backgroundColor: item.colors.secondaryBg }}
                    />
                    <div className="flex flex-col gap-1">
                      <div
                        className="w-10 h-1.5 rounded-full"
                        style={{ backgroundColor: item.colors.textColor, opacity: 0.75 }}
                      />
                      <div
                        className="w-6 h-1 rounded-full"
                        style={{ backgroundColor: item.colors.textColor, opacity: 0.4 }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pr-1">
                    <div
                      className="w-3.5 h-3.5 rounded-full shadow-sm ring-1 ring-white/10"
                      style={{ backgroundColor: item.colors.accentColor }}
                      title="Accent"
                    />
                    {item.colors.secondaryAccentColor && (
                      <div
                        className="w-2.5 h-2.5 rounded-full shadow-sm ring-1 ring-white/10"
                        style={{ backgroundColor: item.colors.secondaryAccentColor }}
                        title="Secondary Accent"
                      />
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-black/60 dark:text-white/60 line-clamp-2 leading-relaxed">
                  {themeDesc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface PdfStyleCardItem {
  id: 'vane' | 'minimal' | 'corporate' | 'academic';
  nameKey: string;
  descKey: string;
  badge: string;
  accent: string;
  bgPreview: string;
  borderPreview: string;
  headerAccent: string;
  userBorder: string;
  isSerif?: boolean;
}

const PDF_STYLE_ITEMS: PdfStyleCardItem[] = [
  {
    id: 'vane',
    nameKey: 'settings.pdfExportStyleVane',
    descKey: 'settings.pdfExportStyleVaneDesc',
    badge: 'Vane Brand',
    accent: '#b8864d',
    bgPreview: '#faf8f5',
    borderPreview: '#ede5dc',
    headerAccent: '#b8864d',
    userBorder: '#b8864d',
  },
  {
    id: 'minimal',
    nameKey: 'settings.pdfExportStyleMinimal',
    descKey: 'settings.pdfExportStyleMinimalDesc',
    badge: 'White-label',
    accent: '#64748b',
    bgPreview: '#ffffff',
    borderPreview: '#e2e8f0',
    headerAccent: '#cbd5e1',
    userBorder: '#64748b',
  },
  {
    id: 'corporate',
    nameKey: 'settings.pdfExportStyleCorporate',
    descKey: 'settings.pdfExportStyleCorporateDesc',
    badge: 'Executive',
    accent: '#1e3a8a',
    bgPreview: '#f8fafc',
    borderPreview: '#cbd5e1',
    headerAccent: '#1e3a8a',
    userBorder: '#1e3a8a',
  },
  {
    id: 'academic',
    nameKey: 'settings.pdfExportStyleAcademic',
    descKey: 'settings.pdfExportStyleAcademicDesc',
    badge: 'Formal Serif',
    accent: '#1c1917',
    bgPreview: '#fcfbfa',
    borderPreview: '#d6d3d1',
    headerAccent: '#1c1917',
    userBorder: '#1c1917',
    isSerif: true,
  },
];

const PdfExportStyleCards = ({
  currentStyle,
  onSelectStyle,
  loading,
}: {
  currentStyle: string;
  onSelectStyle: (styleId: string) => void;
  loading: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
      {PDF_STYLE_ITEMS.map((item) => {
        const isSelected = (currentStyle || 'vane') === item.id;
        const styleName = t(item.nameKey as any) || item.id;
        const styleDesc = t(item.descKey as any) || '';

        return (
          <button
            key={item.id}
            type="button"
            disabled={loading}
            onClick={() => onSelectStyle(item.id)}
            className={`group relative flex flex-col justify-between text-left p-3 rounded-xl border transition-all duration-200 ${
              isSelected
                ? 'border-bronze-500 ring-2 ring-bronze-500/40 bg-light-secondary dark:bg-dark-secondary shadow-md scale-[1.01]'
                : 'border-light-200 dark:border-dark-200 hover:border-light-300 dark:hover:border-dark-300 bg-light-primary dark:bg-dark-primary/60 hover:bg-light-secondary/60 dark:hover:bg-dark-secondary/60'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-2">
                <span
                  className={`font-semibold text-xs sm:text-sm text-black dark:text-white truncate ${
                    item.isSerif ? 'font-serif' : ''
                  }`}
                >
                  {styleName}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9.5px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-light-200 dark:bg-dark-200 text-black/70 dark:text-white/70 border border-light-300 dark:border-dark-300">
                    {item.badge}
                  </span>
                  {isSelected && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-bronze-500 text-white">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>

              {/* Miniature PDF preview mockup */}
              <div
                className="w-full h-16 rounded-lg border p-2 flex flex-col justify-between overflow-hidden shadow-inner mb-2"
                style={{
                  backgroundColor: item.bgPreview,
                  borderColor: item.borderPreview,
                }}
              >
                <div
                  className="flex items-center justify-between pb-1 border-b"
                  style={{ borderColor: item.headerAccent }}
                >
                  <div className="flex items-center gap-1">
                    {item.id === 'vane' && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.accent }}
                      />
                    )}
                    <div
                      className="w-10 h-1.5 rounded-sm"
                      style={{ backgroundColor: item.accent, opacity: 0.85 }}
                    />
                  </div>
                  <div className="w-6 h-1 rounded-sm bg-neutral-400/40" />
                </div>

                <div
                  className="px-1.5 py-0.5 rounded-sm flex items-center gap-1"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    borderLeft: `2px solid ${item.userBorder}`,
                  }}
                >
                  <div className="w-14 h-1 rounded-sm bg-neutral-700/60" />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="w-full h-1 rounded-sm bg-neutral-400/50" />
                  <div className="w-4/5 h-1 rounded-sm bg-neutral-400/30" />
                </div>
              </div>

              <p className="text-[11px] text-black/60 dark:text-white/60 line-clamp-2 leading-relaxed">
                {styleDesc}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
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
  const { theme, setTheme } = useTheme();

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

  const isThemeField = field.key === 'theme';
  const isPdfStyleField = field.key === 'pdfExportStyle';
  const activeValue = isThemeField ? (theme || value || 'dark') : value;

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white font-medium">
            {title}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {desc}
          </p>
        </div>

        {isThemeField && (
          <ThemePickerCards
            currentTheme={activeValue}
            onSelectTheme={(themeId) => handleSave(themeId)}
            loading={loading}
          />
        )}

        {isPdfStyleField && (
          <PdfExportStyleCards
            currentStyle={activeValue}
            onSelectStyle={(styleId) => handleSave(styleId)}
            loading={loading}
          />
        )}

        <div className={isThemeField || isPdfStyleField ? 'pt-2' : ''}>
          {isThemeField && (
            <label className="block text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40 mb-1.5 font-semibold">
              {t('settings.themeLabel' as any) || 'Dropdown Selection'}
            </label>
          )}
          {isPdfStyleField && (
            <label className="block text-[11px] uppercase tracking-wider text-black/40 dark:text-white/40 mb-1.5 font-semibold">
              {t('settings.pdfExportStyleDropdown' as any) || 'Select Style Variant'}
            </label>
          )}
          <Select
            value={activeValue}
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
