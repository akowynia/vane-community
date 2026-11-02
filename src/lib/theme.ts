export type ThemeCategory = 'modern' | 'retro';

export type ThemeId =
  | 'dark'
  | 'light'
  | 'cyberpunk'
  | 'nord'
  | 'retro-terminal'
  | 'synthwave'
  | 'vintage-paper'
  | 'matrix';

export interface ThemeColors {
  primaryBg: string;
  secondaryBg: string;
  surfaceBg: string;
  borderColor: string;
  accentColor: string;
  secondaryAccentColor?: string;
  textColor: string;
}

export interface ThemeMetadata {
  id: ThemeId;
  nameKey: string;
  descKey: string;
  category: ThemeCategory;
  isDark: boolean;
  colors: ThemeColors;
}

export const THEMES: ThemeMetadata[] = [
  {
    id: 'dark',
    nameKey: 'settings.themeDark',
    descKey: 'settings.themeDarkDesc',
    category: 'modern',
    isDark: true,
    colors: {
      primaryBg: '#0c0a09',
      secondaryBg: '#161412',
      surfaceBg: '#28221b',
      borderColor: '#3d342a',
      accentColor: '#b8864d',
      textColor: '#ffffff',
    },
  },
  {
    id: 'light',
    nameKey: 'settings.themeLight',
    descKey: 'settings.themeLightDesc',
    category: 'modern',
    isDark: false,
    colors: {
      primaryBg: '#ffffff',
      secondaryBg: '#f6f8fa',
      surfaceBg: '#e8edf1',
      borderColor: '#d0d7de',
      accentColor: '#b8864d',
      textColor: '#0f172a',
    },
  },
  {
    id: 'cyberpunk',
    nameKey: 'settings.themeCyberpunk',
    descKey: 'settings.themeCyberpunkDesc',
    category: 'modern',
    isDark: true,
    colors: {
      primaryBg: '#080813',
      secondaryBg: '#101026',
      surfaceBg: '#1c1a3e',
      borderColor: '#302a60',
      accentColor: '#00f0ff',
      secondaryAccentColor: '#ff007f',
      textColor: '#f0f6fc',
    },
  },
  {
    id: 'nord',
    nameKey: 'settings.themeNord',
    descKey: 'settings.themeNordDesc',
    category: 'modern',
    isDark: true,
    colors: {
      primaryBg: '#242933',
      secondaryBg: '#2e3440',
      surfaceBg: '#3b4252',
      borderColor: '#434c5e',
      accentColor: '#88c0d0',
      secondaryAccentColor: '#81a1c1',
      textColor: '#eceff4',
    },
  },
  {
    id: 'retro-terminal',
    nameKey: 'settings.themeRetroTerminal',
    descKey: 'settings.themeRetroTerminalDesc',
    category: 'retro',
    isDark: true,
    colors: {
      primaryBg: '#080e0a',
      secondaryBg: '#0d1810',
      surfaceBg: '#142619',
      borderColor: '#1c3825',
      accentColor: '#00ff66',
      secondaryAccentColor: '#33ff88',
      textColor: '#c8f7d4',
    },
  },
  {
    id: 'synthwave',
    nameKey: 'settings.themeSynthwave',
    descKey: 'settings.themeSynthwaveDesc',
    category: 'retro',
    isDark: true,
    colors: {
      primaryBg: '#120824',
      secondaryBg: '#1d0e3a',
      surfaceBg: '#2c1454',
      borderColor: '#482082',
      accentColor: '#ff2a85',
      secondaryAccentColor: '#ffb800',
      textColor: '#faedff',
    },
  },
  {
    id: 'vintage-paper',
    nameKey: 'settings.themeVintagePaper',
    descKey: 'settings.themeVintagePaperDesc',
    category: 'retro',
    isDark: false,
    colors: {
      primaryBg: '#f7f2e7',
      secondaryBg: '#eee5d3',
      surfaceBg: '#e2d5bd',
      borderColor: '#d0c0a3',
      accentColor: '#8b5a2b',
      secondaryAccentColor: '#a6723e',
      textColor: '#2d241e',
    },
  },
  {
    id: 'matrix',
    nameKey: 'settings.themeMatrix',
    descKey: 'settings.themeMatrixDesc',
    category: 'retro',
    isDark: true,
    colors: {
      primaryBg: '#050b06',
      secondaryBg: '#09150a',
      surfaceBg: '#0f2411',
      borderColor: '#18381b',
      accentColor: '#00ff41',
      secondaryAccentColor: '#00cc33',
      textColor: '#b8fbc3',
    },
  },
];

export const ALL_THEME_IDS: ThemeId[] = THEMES.map((theme) => theme.id);

export const DEFAULT_THEME: ThemeId = 'dark';

export const isThemeDark = (themeId?: string): boolean => {
  if (!themeId) return true;
  const theme = THEMES.find((item) => item.id === themeId);
  return theme ? theme.isDark : themeId !== 'light' && themeId !== 'vintage-paper';
};

export const getThemeById = (id?: string): ThemeMetadata => {
  return THEMES.find((theme) => theme.id === id) || THEMES[0];
};
