import Select from '@/components/ui/Select';
import { ConfigModelProvider } from '@/lib/config/types';
import { useChat } from '@/lib/hooks/useChat';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';

const ModelSelect = ({
  providers,
  type,
}: {
  providers: ConfigModelProvider[];
  type: 'chat' | 'embedding';
}) => {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const pid = localStorage.getItem(
      type === 'chat' ? 'chatModelProviderId' : 'embeddingModelProviderId',
    );
    const key = localStorage.getItem(
      type === 'chat' ? 'chatModelKey' : 'embeddingModelKey',
    );
    return pid && key ? `${pid}/${key}` : '';
  });
  const [loading, setLoading] = useState(false);
  const { setChatModelProvider, setEmbeddingModelProvider } = useChat();

  const options = useMemo(() => {
    return type === 'chat'
      ? (providers || []).flatMap((provider) =>
          (provider?.chatModels || [])
            .filter((model) => model && model.key && model.key !== 'error')
            .map((model) => ({
              value: `${provider.id}/${model.key}`,
              label: `${provider.name} - ${model.name || model.key}`,
            })),
        )
      : (providers || []).flatMap((provider) =>
          (provider?.embeddingModels || [])
            .filter((model) => model && model.key && model.key !== 'error')
            .map((model) => ({
              value: `${provider.id}/${model.key}`,
              label: `${provider.name} - ${model.name || model.key}`,
            })),
        );
  }, [providers, type]);

  const handleSave = async (newValue: string) => {
    setLoading(true);
    setSelectedModel(newValue);

    try {
      if (!newValue) {
        if (type === 'chat') {
          localStorage.removeItem('chatModelProviderId');
          localStorage.removeItem('chatModelKey');
          setChatModelProvider({ providerId: '', key: '' });
        } else {
          localStorage.removeItem('embeddingModelProviderId');
          localStorage.removeItem('embeddingModelKey');
          setEmbeddingModelProvider({ providerId: '', key: '' });
        }
        return;
      }

      if (type === 'chat') {
        const providerId = newValue.split('/')[0];
        const modelKey = newValue.split('/').slice(1).join('/');

        localStorage.setItem('chatModelProviderId', providerId);
        localStorage.setItem('chatModelKey', modelKey);

        setChatModelProvider({
          providerId: providerId,
          key: modelKey,
        });
      } else {
        const providerId = newValue.split('/')[0];
        const modelKey = newValue.split('/').slice(1).join('/');

        localStorage.setItem('embeddingModelProviderId', providerId);
        localStorage.setItem('embeddingModelKey', modelKey);

        setEmbeddingModelProvider({
          providerId: providerId,
          key: modelKey,
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error(t('settings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options.length === 0) {
      if (selectedModel !== '') {
        handleSave('');
      }
      return;
    }

    const exists = options.some((opt) => opt.value === selectedModel);
    if (!exists) {
      const fallback = options[0].value;
      handleSave(fallback);
    }
  }, [options]);

  return (
    <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
      <div className="space-y-3 lg:space-y-5">
        <div>
          <h4 className="text-sm lg:text-sm text-black dark:text-white">
            {type === 'chat' ? t('settings.selectChatModel') : t('settings.selectEmbeddingModel')}
          </h4>
          <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
            {type === 'chat'
              ? t('settings.selectChatModelDesc')
              : t('settings.selectEmbeddingModelDesc')}
          </p>
        </div>
        <Select
          value={selectedModel}
          onChange={(event) => handleSave(event.target.value)}
          options={options}
          className="!text-xs lg:!text-[13px]"
          loading={loading}
          disabled={loading}
        />
      </div>
    </section>
  );
};

export default ModelSelect;
