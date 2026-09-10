import configManager from './index';
import { ConfigModelProvider } from './types';

export const getConfiguredModelProviders = (): ConfigModelProvider[] => {
  return configManager.getConfig('modelProviders', []);
};

export const getConfiguredModelProviderById = (
  id: string,
): ConfigModelProvider | undefined => {
  return getConfiguredModelProviders().find((p) => p.id === id) ?? undefined;
};

export const getSearxngURL = () => {
  const configuredUrl = configManager.getConfig('search.searxngURL', '');
  if (
    configuredUrl &&
    typeof configuredUrl === 'string' &&
    configuredUrl.trim() !== ''
  ) {
    return configuredUrl.trim().replace(/\/+$/, '');
  }
  const envUrl =
    process.env.SEARXNG_API_URL ||
    process.env.SEARXNG_URL ||
    process.env.SEARX_URL ||
    'http://127.0.0.1:8080';
  return envUrl.trim().replace(/\/+$/, '');
};
