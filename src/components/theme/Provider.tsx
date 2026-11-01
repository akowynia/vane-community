'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { useEffect } from 'react';
import { ALL_THEME_IDS, isThemeDark } from '@/lib/theme';

const ThemeSynchronizer = () => {
  const { theme } = useTheme();

  useEffect(() => {
    if (!theme || typeof document === 'undefined') return;

    const root = document.documentElement;
    const isDark = isThemeDark(theme);

    // Synchronize dark/light class for Tailwind darkMode: 'class'
    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }

    // Synchronize theme identifier class name for custom CSS overrides
    ALL_THEME_IDS.forEach((id) => {
      if (id === theme) {
        root.classList.add(id);
      } else {
        root.classList.remove(id);
      }
    });

    root.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
};

const ThemeProviderComponent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <ThemeProvider
      attribute="data-theme"
      enableSystem={false}
      defaultTheme="dark"
      themes={ALL_THEME_IDS}
    >
      <ThemeSynchronizer />
      {children}
    </ThemeProvider>
  );
};

export default ThemeProviderComponent;
