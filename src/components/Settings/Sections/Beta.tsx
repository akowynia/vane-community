'use client';

import React from 'react';
import { UIConfigField } from '@/lib/config/types';
import SettingsField from '../SettingsField';
import { FlaskConical } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

const Beta = ({
  fields,
  values,
}: {
  fields: UIConfigField[];
  values: Record<string, any>;
}) => {
  const { t } = useTranslation();

  const effectiveFields: UIConfigField[] =
    fields && fields.length > 0
      ? fields
      : [
          {
            name: 'AI Presentations',
            key: 'enablePresentations',
            type: 'switch',
            required: false,
            description:
              'Enable experimental AI Presentation Generator with Deep Research in Scratchpad.',
            default: false,
            scope: 'client',
          },
        ];

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 shrink-0">
          <FlaskConical className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('settings.betaBannerTitle') || 'Laboratory & Beta Features'}
            </h4>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
              {t('common.beta') || 'BETA'}
            </span>
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 leading-relaxed">
            {t('settings.betaBannerDesc') ||
              'Features in this section are in active development and experimentation. Toggle them to test the latest capabilities.'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {effectiveFields
          .filter((field) => field && field.key)
          .map((field) => (
            <SettingsField
              key={field.key}
              field={field}
              value={
                (field.scope === 'client'
                  ? localStorage.getItem(field.key)
                  : values?.[field.key]) ?? field.default
              }
              dataAdd="beta"
            />
          ))}
      </div>
    </div>
  );
};

export default Beta;
