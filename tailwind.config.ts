import type { Config } from 'tailwindcss';
import type { DefaultColors } from 'tailwindcss/types/generated/colors';

const themeDark = {
  50: 'rgb(var(--color-dark-50, 12 10 9) / <alpha-value>)',
  100: 'rgb(var(--color-dark-100, 22 20 18) / <alpha-value>)',
  200: 'rgb(var(--color-dark-200, 40 34 27) / <alpha-value>)',
  300: 'rgb(var(--color-dark-300, 61 52 42) / <alpha-value>)',
};

const themeLight = {
  50: 'rgb(var(--color-light-50, 255 255 255) / <alpha-value>)',
  100: 'rgb(var(--color-light-100, 246 248 250) / <alpha-value>)',
  200: 'rgb(var(--color-light-200, 232 237 241) / <alpha-value>)',
  300: 'rgb(var(--color-light-300, 208 215 222) / <alpha-value>)',
};

const themeBronze = {
  50: 'rgb(var(--color-bronze-50, 251 248 244) / <alpha-value>)',
  100: 'rgb(var(--color-bronze-100, 245 239 230) / <alpha-value>)',
  200: 'rgb(var(--color-bronze-200, 233 220 206) / <alpha-value>)',
  300: 'rgb(var(--color-bronze-300, 215 192 169) / <alpha-value>)',
  400: 'rgb(var(--color-bronze-400, 197 159 125) / <alpha-value>)',
  500: 'rgb(var(--color-bronze-500, 184 134 77) / <alpha-value>)',
  600: 'rgb(var(--color-bronze-600, 157 110 58) / <alpha-value>)',
  700: 'rgb(var(--color-bronze-700, 122 84 42) / <alpha-value>)',
  800: 'rgb(var(--color-bronze-800, 83 55 26) / <alpha-value>)',
  900: 'rgb(var(--color-bronze-900, 46 29 13) / <alpha-value>)',
};

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: [
    'class',
    ':is(.dark, .cyberpunk, .nord, .retro-terminal, .synthwave, .matrix, [data-theme="dark"], [data-theme="cyberpunk"], [data-theme="nord"], [data-theme="retro-terminal"], [data-theme="synthwave"], [data-theme="matrix"])',
  ],
  theme: {
    extend: {
      borderColor: () => {
        return {
          light: themeLight,
          dark: themeDark,
        };
      },
      colors: () => {
        return {
          bronze: themeBronze,
          dark: {
            primary: themeDark[50],
            secondary: themeDark[100],
            ...themeDark,
          },
          light: {
            primary: themeLight[50],
            secondary: themeLight[100],
            ...themeLight,
          },
        };
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@headlessui/tailwindcss')({ prefix: 'headless' }),
  ],
};
export default config;
