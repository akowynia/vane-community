'use client';

const getClientConfig = (key: string, defaultVal?: any) => {
  return localStorage.getItem(key) ?? defaultVal ?? undefined;
};

export const getTheme = () => getClientConfig('theme', 'dark');

export const getLanguage = () => getClientConfig('language', 'en');

export const getAutoMediaSearch = () =>
  getClientConfig('autoMediaSearch', 'true') === 'true';

export const getSystemInstructions = () =>
  getClientConfig('systemInstructions', '');

export const getShowWeatherWidget = () =>
  getClientConfig('showWeatherWidget', 'true') === 'true';

export const getShowNewsWidget = () =>
  getClientConfig('showNewsWidget', 'true') === 'true';

export const getEnablePresentations = () =>
  getClientConfig('enablePresentations', 'false') === 'true';

export const getMeasurementUnit = () => {
  const value =
    getClientConfig('measureUnit') ??
    getClientConfig('measurementUnit', 'metric');

  if (typeof value !== 'string') return 'metric';

  return value.toLowerCase();
};

export type PdfExportStyle = 'vane' | 'minimal' | 'corporate' | 'academic';

export const getPdfExportStyle = (): PdfExportStyle => {
  const val = getClientConfig('pdfExportStyle', 'vane');
  if (['vane', 'minimal', 'corporate', 'academic'].includes(val)) {
    return val as PdfExportStyle;
  }
  return 'vane';
};

export const getPdfShowBranding = (): boolean => {
  return getClientConfig('pdfShowBranding', 'true') === 'true';
};
