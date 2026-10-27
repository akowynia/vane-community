'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import { THEMES, ThemeId } from '@/lib/theme';
import { useTranslation } from '@/lib/i18n';

const ThemeSwitcher = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const handleThemeSwitch = (newTheme: ThemeId) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      window.dispatchEvent(new Event('client-config-changed'));
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const options = THEMES.map((item) => ({
    value: item.id,
    label: t(item.nameKey as any) || item.id,
  }));

  return (
    <Select
      className={className}
      value={theme}
      onChange={(e) => handleThemeSwitch(e.target.value as ThemeId)}
      options={options}
    />
  );
};

export default ThemeSwitcher;
