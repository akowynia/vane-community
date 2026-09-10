import path from 'node:path';
import fs from 'fs';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { Config, ConfigModelProvider, UIConfigSections } from './types';
import { hashObj } from '../utils/hash';
import { getModelProvidersUIConfigSection } from '../models/providers';
import {
  validateHttpUrl,
  isBlockedHostname,
  isCloudMetadataIP,
  validateSearxngURL,
} from '../security/ssrf';
import vault from '../security/vault';
import { hashPassword } from '../security/password';

export const MASKED_SECRET = '••••••••';

const ALLOWED_CONFIG_KEYS = new Set([
  'preferences.theme',
  'preferences.language',
  'preferences.measureUnit',
  'preferences.autoMediaSearch',
  'preferences.showWeatherWidget',
  'preferences.showNewsWidget',
  'personalization.systemInstructions',
  'search.searxngURL',
  'search.braveApiKey',
  'search.enabledEngines',
  'search.apiKeys.brave',
  'search.apiKeys.bing',
  'search.apiKeys.google',
  'search.apiKeys.mojeek',
  'search.apiKeys.pubmed',
  'instanceMode',
  'network.exposeToNetwork',
  'guestSettings.allowGuestAccess',
  'guestSettings.tokenLimit5h',
  'guestSettings.tokenLimitWeekly',
  'guestSettings.tokenLimitPerDay',
  'guestSettings.tokenLimitPerMonth',
  'guestSettings.maxTokensPerRequest',
  'guestSettings.qualityModeMaxTokens',
  'globalLimits.tokenLimit5h',
  'globalLimits.tokenLimitWeekly',
  'globalLimits.tokenLimitPerDay',
  'globalLimits.tokenLimitPerMonth',
  'globalLimits.maxTokensPerRequest',
  'globalLimits.qualityModeMaxTokens',
  'auth.adminPassword',
]);

const ALLOWED_LANGUAGES = new Set([
  'en',
  'pl',
  'es',
  'de',
  'fr',
  'it',
  'pt',
  'ru',
  'uk',
  'zh',
  'ja',
  'ko',
]);

const ENV_ALIASES: Record<string, string[]> = {
  OLLAMA_BASE_URL: ['OLLAMA_API_URL', 'OLLAMA_URL', 'OLLAMA_HOST'],
  LM_STUDIO_BASE_URL: ['LM_STUDIO_URL', 'LM_STUDIO_API_URL'],
  OPENAI_BASE_URL: ['OPENAI_API_BASE', 'OPENAI_URL'],
  SEARXNG_API_URL: ['SEARXNG_URL', 'SEARX_URL'],
};

function getEnvWithAliases(envKey?: string): string | undefined {
  if (!envKey) return undefined;
  if (process.env[envKey] && process.env[envKey]!.trim() !== '') {
    return process.env[envKey]!.trim();
  }
  const aliases = ENV_ALIASES[envKey];
  if (aliases) {
    for (const alias of aliases) {
      if (process.env[alias] && process.env[alias]!.trim() !== '') {
        return process.env[alias]!.trim();
      }
    }
  }
  return undefined;
}

function parseLegacyToml(
  content: string,
): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = 'GLOBAL';
  result[currentSection] = {};

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().toUpperCase();
      if (!result[currentSection]) {
        result[currentSection] = {};
      }
      continue;
    }

    const kvMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim().toUpperCase();
      let rawVal = kvMatch[2].trim();
      const commentIdx = rawVal.indexOf('#');
      if (commentIdx !== -1) {
        rawVal = rawVal.substring(0, commentIdx).trim();
      }
      if (
        (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
        (rawVal.startsWith("'") && rawVal.endsWith("'"))
      ) {
        rawVal = rawVal.slice(1, -1);
      }
      result[currentSection][key] = rawVal;
    }
  }
  return result;
}

class ConfigManager {
  configPath: string = path.join(
    process.env.DATA_DIR || process.cwd(),
    '/data/config.json',
  );
  configVersion = 1;
  currentConfig: Config = {
    version: this.configVersion,
    setupComplete: false,
    preferences: {},
    personalization: {},
    modelProviders: [],
    search: {
      searxngURL: '',
    },
  };
  uiConfigSections: UIConfigSections = {
    preferences: [
      {
        name: 'Theme',
        key: 'theme',
        type: 'select',
        options: [
          {
            name: 'Light',
            value: 'light',
          },
          {
            name: 'Dark',
            value: 'dark',
          },
        ],
        required: false,
        description: 'Choose between light and dark layouts for the app.',
        default: 'dark',
        scope: 'client',
      },
      {
        name: 'Language',
        key: 'language',
        type: 'select',
        options: [
          { name: 'English', value: 'en' },
          { name: 'Polski (Polish)', value: 'pl' },
          { name: 'Español (Spanish)', value: 'es' },
          { name: 'Deutsch (German)', value: 'de' },
          { name: 'Français (French)', value: 'fr' },
          { name: 'Italiano (Italian)', value: 'it' },
          { name: 'Português (Portuguese)', value: 'pt' },
          { name: 'Русский (Russian)', value: 'ru' },
          { name: 'Українська (Ukrainian)', value: 'uk' },
          { name: '中文 (Chinese)', value: 'zh' },
          { name: '日本語 (Japanese)', value: 'ja' },
          { name: '한국어 (Korean)', value: 'ko' },
        ],
        required: false,
        description:
          'Choose your preferred display language for the application.',
        default: 'en',
        scope: 'client',
      },
      {
        name: 'Measurement Unit',
        key: 'measureUnit',
        type: 'select',
        options: [
          {
            name: 'Imperial',
            value: 'Imperial',
          },
          {
            name: 'Metric',
            value: 'Metric',
          },
        ],
        required: false,
        description: 'Choose between Metric  and Imperial measurement unit.',
        default: 'Metric',
        scope: 'client',
      },
      {
        name: 'Auto video & image search',
        key: 'autoMediaSearch',
        type: 'switch',
        required: false,
        description: 'Automatically search for relevant images and videos.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show weather widget',
        key: 'showWeatherWidget',
        type: 'switch',
        required: false,
        description: 'Display the weather card on the home screen.',
        default: true,
        scope: 'client',
      },
      {
        name: 'Show news widget',
        key: 'showNewsWidget',
        type: 'switch',
        required: false,
        description: 'Display the recent news card on the home screen.',
        default: true,
        scope: 'client',
      },
    ],
    personalization: [
      {
        name: 'System Instructions',
        key: 'systemInstructions',
        type: 'textarea',
        required: false,
        description: 'Add custom behavior or tone for the model.',
        placeholder:
          'e.g., "Respond in a friendly and concise tone" or "Use British English and format answers as bullet points."',
        scope: 'client',
      },
    ],
    modelProviders: [],
    search: [
      {
        name: 'SearXNG URL',
        key: 'searxngURL',
        type: 'string',
        required: false,
        description: 'The URL of your SearXNG instance',
        placeholder: 'http://127.0.0.1:8080',
        default: '',
        scope: 'server',
        env: 'SEARXNG_API_URL',
      },
    ],
  };

  constructor() {
    // `next build` collects page data by importing every route module in several
    // parallel worker processes. Each import would otherwise re-run this file-system
    // initialization concurrently, racing on reads/writes to data/config.json. None of
    // that build-time analysis actually serves a request, so it's safe to skip entirely
    // and let the first real request (`yarn start` / Docker) initialize it once.
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
      this.initialize();
    }
  }

  private initialize() {
    this.initializeConfig();
    this.initializeFromEnv();
  }

  private saveConfig() {
    const diskConfig = JSON.parse(JSON.stringify(this.currentConfig));
    if (Array.isArray(diskConfig.modelProviders)) {
      diskConfig.modelProviders.forEach((p: ConfigModelProvider) => {
        if (p.config) {
          for (const [k, v] of Object.entries(p.config)) {
            if (
              this.isSensitiveField(k, p.type) &&
              typeof v === 'string' &&
              v &&
              v !== MASKED_SECRET &&
              !vault.isEncrypted(v)
            ) {
              p.config[k] = vault.encrypt(v);
            }
          }
        }
      });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(diskConfig, null, 2));
  }

  private tryImportLegacyToml() {
    const possibleTomlPaths = [
      process.env.CONFIG_PATH,
      path.join(process.cwd(), 'config.toml'),
      path.join(process.env.DATA_DIR || '', 'config.toml'),
      '/home/perplexica/config.toml',
      '/home/vane-community/config.toml',
    ].filter((p): p is string => Boolean(p && p.trim()));

    for (const tomlPath of possibleTomlPaths) {
      try {
        if (fs.existsSync(tomlPath)) {
          const content = fs.readFileSync(tomlPath, 'utf-8');
          const parsed = parseLegacyToml(content);

          console.log(
            `[CONFIG] Migrating legacy configuration from ${tomlPath}...`,
          );

          // 1. SearXNG
          const searxUrl =
            parsed['API_ENDPOINTS']?.['SEARXNG'] ||
            parsed['GENERAL']?.['SEARXNG_URL'];
          if (searxUrl && !this.currentConfig.search.searxngURL) {
            this.currentConfig.search.searxngURL = searxUrl
              .trim()
              .replace(/\/+$/, '');
          }

          // 2. Ollama
          const ollamaUrl =
            parsed['MODELS.OLLAMA']?.['API_URL'] ||
            parsed['MODELS.OLLAMA']?.['BASE_URL'] ||
            parsed['API_ENDPOINTS']?.['OLLAMA'];
          if (ollamaUrl) {
            const cleanUrl = ollamaUrl.trim().replace(/\/+$/, '');
            const existing = this.currentConfig.modelProviders.find(
              (p) => p.type === 'ollama',
            );
            if (existing) {
              existing.config = { ...existing.config, baseURL: cleanUrl };
              existing.hash = hashObj(existing.config);
            } else {
              this.currentConfig.modelProviders.push({
                id: crypto.randomUUID(),
                name: 'Ollama',
                type: 'ollama',
                chatModels: [],
                embeddingModels: [],
                config: { baseURL: cleanUrl },
                hash: hashObj({ baseURL: cleanUrl }),
              });
            }
          }

          // 3. OpenAI
          const openaiKey = parsed['MODELS.OPENAI']?.['API_KEY'];
          if (openaiKey) {
            this.currentConfig.modelProviders.push({
              id: crypto.randomUUID(),
              name: 'OpenAI',
              type: 'openai',
              chatModels: [],
              embeddingModels: [],
              config: { apiKey: openaiKey.trim() },
              hash: hashObj({ apiKey: openaiKey.trim() }),
            });
          }

          // 4. Groq
          const groqKey = parsed['MODELS.GROQ']?.['API_KEY'];
          if (groqKey) {
            this.currentConfig.modelProviders.push({
              id: crypto.randomUUID(),
              name: 'Groq',
              type: 'groq',
              chatModels: [],
              embeddingModels: [],
              config: { apiKey: groqKey.trim() },
              hash: hashObj({ apiKey: groqKey.trim() }),
            });
          }

          // 5. Anthropic
          const anthropicKey = parsed['MODELS.ANTHROPIC']?.['API_KEY'];
          if (anthropicKey) {
            this.currentConfig.modelProviders.push({
              id: crypto.randomUUID(),
              name: 'Anthropic',
              type: 'anthropic',
              chatModels: [],
              embeddingModels: [],
              config: { apiKey: anthropicKey.trim() },
              hash: hashObj({ apiKey: anthropicKey.trim() }),
            });
          }

          // 6. Gemini
          const geminiKey = parsed['MODELS.GEMINI']?.['API_KEY'];
          if (geminiKey) {
            this.currentConfig.modelProviders.push({
              id: crypto.randomUUID(),
              name: 'Gemini',
              type: 'gemini',
              chatModels: [],
              embeddingModels: [],
              config: { apiKey: geminiKey.trim() },
              hash: hashObj({ apiKey: geminiKey.trim() }),
            });
          }

          // 7. LM Studio
          const lmStudioUrl =
            parsed['MODELS.LM_STUDIO']?.['API_URL'] ||
            parsed['MODELS.LM_STUDIO']?.['BASE_URL'];
          if (lmStudioUrl) {
            const cleanUrl = lmStudioUrl.trim().replace(/\/+$/, '');
            this.currentConfig.modelProviders.push({
              id: crypto.randomUUID(),
              name: 'LM Studio',
              type: 'lmstudio',
              chatModels: [],
              embeddingModels: [],
              config: { baseURL: cleanUrl },
              hash: hashObj({ baseURL: cleanUrl }),
            });
          }

          break;
        }
      } catch (err) {
        console.warn(
          `[CONFIG] Error migrating legacy config from ${tomlPath}:`,
          err,
        );
      }
    }
  }

  private initializeConfig() {
    const exists = fs.existsSync(this.configPath);
    if (!exists) {
      this.tryImportLegacyToml();
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.currentConfig, null, 2),
      );
    } else {
      try {
        this.currentConfig = JSON.parse(
          fs.readFileSync(this.configPath, 'utf-8'),
        );
      } catch (err) {
        if (err instanceof SyntaxError) {
          const backupPath = `${this.configPath}.corrupted-${Date.now()}.bak`;
          console.error(
            `Error parsing config file at ${this.configPath}:`,
            err,
          );
          try {
            fs.renameSync(this.configPath, backupPath);
            console.error(
              `Moved unreadable config file to ${backupPath} for manual recovery, and started a fresh default config. Restore the backup by hand if it contains data you need.`,
            );
          } catch (backupErr) {
            console.error(
              `Failed to back up unreadable config file at ${this.configPath}; refusing to overwrite it. Fix or remove it manually.`,
              backupErr,
            );
            return;
          }
          fs.writeFileSync(
            this.configPath,
            JSON.stringify(this.currentConfig, null, 2),
          );
          return;
        } else {
          console.log('Unknown error reading config file:', err);
        }
      }

      this.currentConfig = this.migrateConfig(this.currentConfig);

      if (Array.isArray(this.currentConfig.modelProviders)) {
        this.currentConfig.modelProviders.forEach((p) => {
          if (p.config) {
            for (const [k, v] of Object.entries(p.config)) {
              if (typeof v === 'string' && vault.isEncrypted(v)) {
                p.config[k] = vault.decrypt(v);
              }
            }
          }
          if (!p.hash && p.config) {
            p.hash = hashObj(p.config);
          }
          if (!Array.isArray(p.chatModels)) {
            p.chatModels = [];
          }
          if (!Array.isArray(p.embeddingModels)) {
            p.embeddingModels = [];
          }
        });
      } else {
        this.currentConfig.modelProviders = [];
      }
    }
  }

  private migrateConfig(config: Config): Config {
    /* TODO: Add migrations */
    return config;
  }

  private initializeFromEnv() {
    /* providers section*/
    const providerConfigSections = getModelProvidersUIConfigSection();

    this.uiConfigSections.modelProviders = providerConfigSections;

    const newProviders: ConfigModelProvider[] = [];

    providerConfigSections.forEach((provider) => {
      const newProvider: ConfigModelProvider & { required?: string[] } = {
        id: crypto.randomUUID(),
        name: `${provider.name}`,
        type: provider.key,
        chatModels: [],
        embeddingModels: [],
        config: {},
        required: [],
        hash: '',
      };

      provider.fields.forEach((field) => {
        let val =
          getEnvWithAliases(field.env) ||
          field.default ||
          ''; /* Env var must exist for providers */
        if (
          (field.key === 'baseURL' ||
            field.key.toLowerCase().includes('url')) &&
          typeof val === 'string'
        ) {
          val = val.replace(/\/+$/, '');
        }
        newProvider.config[field.key] = val;

        if (field.required) newProvider.required?.push(field.key);
      });

      let configured = true;

      newProvider.required?.forEach((r) => {
        if (!newProvider.config[r]) {
          configured = false;
        }
      });

      if (configured) {
        const hash = hashObj(newProvider.config);
        newProvider.hash = hash;
        delete newProvider.required;

        const existingProvider = this.currentConfig.modelProviders.find(
          (p) =>
            p.hash === hash ||
            (p.type === provider.key && hashObj(p.config || {}) === hash),
        );

        if (!existingProvider) {
          const sameTypeProvider = this.currentConfig.modelProviders.find(
            (p) => p.type === provider.key,
          );
          if (sameTypeProvider) {
            sameTypeProvider.config = {
              ...sameTypeProvider.config,
              ...newProvider.config,
            };
            sameTypeProvider.hash = hashObj(sameTypeProvider.config);
          } else {
            newProviders.push(newProvider);
          }
        } else {
          existingProvider.hash = hash;
        }
      }
    });

    this.currentConfig.modelProviders.push(...newProviders);

    /* search section */
    this.uiConfigSections.search.forEach((f) => {
      if (f.env && !this.currentConfig.search[f.key]) {
        let envVal = getEnvWithAliases(f.env) ?? f.default ?? '';
        if (typeof envVal === 'string') {
          envVal = envVal.replace(/\/+$/, '');
        }
        this.currentConfig.search[f.key] = envVal;
      }
    });

    this.saveConfig();
  }

  /**
   * Check if a config field is considered sensitive (e.g., apiKey, token, password, secret)
   */
  public isSensitiveField(key: string, providerType?: string): boolean {
    if (!key) return false;

    // Check if the provider field definition marks it as password
    if (providerType) {
      const section = this.uiConfigSections.modelProviders.find(
        (p) => p.key === providerType,
      );
      const field = section?.fields.find((f) => f.key === key);
      if (field && field.type === 'password') {
        return true;
      }
    }

    // Heuristic check for sensitive field names
    const lowerKey = key.toLowerCase();
    return (
      lowerKey.includes('apikey') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('credentials') ||
      lowerKey.includes('auth') ||
      lowerKey === 'key'
    );
  }

  /**
   * Return a sanitized copy of a model provider with sensitive values masked
   */
  public sanitizeModelProvider(
    provider: ConfigModelProvider,
  ): ConfigModelProvider {
    const sanitizedConfig: Record<string, any> = {};

    for (const [k, v] of Object.entries(provider.config || {})) {
      if (this.isSensitiveField(k, provider.type)) {
        if (v !== undefined && v !== null && v !== '') {
          sanitizedConfig[k] = MASKED_SECRET;
        } else {
          sanitizedConfig[k] = '';
        }
      } else {
        sanitizedConfig[k] = v;
      }
    }

    return {
      ...provider,
      config: sanitizedConfig,
    };
  }

  /**
   * Return a sanitized copy of the full configuration safe to send to the client
   */
  public getSanitizedConfig(): Config {
    const clone: Config = JSON.parse(JSON.stringify(this.currentConfig));

    clone.modelProviders = clone.modelProviders.map((p) =>
      this.sanitizeModelProvider(p),
    );

    return clone;
  }

  public getConfig(key: string, defaultValue?: any): any {
    const nested = key.split('.');
    let obj: any = this.currentConfig;

    for (let i = 0; i < nested.length; i++) {
      const part = nested[i];
      if (obj == null) return defaultValue;

      obj = obj[part];
    }

    return obj === undefined ? defaultValue : obj;
  }

  /**
   * Update configuration with key whitelist and strict input validation
   */
  public async updateConfig(key: string, val: any): Promise<void> {
    if (!key || typeof key !== 'string') {
      throw new Error('Config key must be a non-empty string.');
    }

    // Whitelist check: only allowed UI configuration keys can be updated
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      throw new Error(
        `Updating key "${key}" is not permitted via generic config update.`,
      );
    }

    // Strict type and value validation per config key
    if (key === 'preferences.theme') {
      if (val !== 'light' && val !== 'dark') {
        throw new Error('Theme must be either "light" or "dark".');
      }
    } else if (key === 'preferences.language') {
      if (typeof val !== 'string' || !ALLOWED_LANGUAGES.has(val)) {
        throw new Error(`Unsupported language code: "${val}".`);
      }
    } else if (key === 'preferences.measureUnit') {
      if (val !== 'Metric' && val !== 'Imperial') {
        throw new Error(
          'Measurement unit must be either "Metric" or "Imperial".',
        );
      }
    } else if (
      key === 'preferences.autoMediaSearch' ||
      key === 'preferences.showWeatherWidget' ||
      key === 'preferences.showNewsWidget'
    ) {
      if (typeof val !== 'boolean') {
        throw new Error(`Value for "${key}" must be a boolean.`);
      }
    } else if (key === 'personalization.systemInstructions') {
      if (typeof val !== 'string') {
        throw new Error('System instructions must be a string.');
      }
      if (val.length > 5000) {
        throw new Error(
          'System instructions exceed maximum allowed length of 5000 characters.',
        );
      }
    } else if (key === 'search.searxngURL') {
      if (typeof val !== 'string') {
        throw new Error('SearXNG URL must be a string.');
      }
      const trimmed = val.trim();
      if (trimmed !== '') {
        const validation = await validateSearxngURL(trimmed);
        if (!validation.valid) {
          throw new Error(
            `SSRF Protection: Invalid SearXNG URL - ${validation.reason}`,
          );
        }
      }
    } else if (
      key === 'search.braveApiKey' ||
      key.startsWith('search.apiKeys.')
    ) {
      if (typeof val !== 'string') {
        throw new Error('API Key must be a string.');
      }
      val = val.trim();
    } else if (key === 'instanceMode') {
      if (val !== 'single' && val !== 'multi') {
        throw new Error('Instance mode must be either "single" or "multi".');
      }
    } else if (key === 'auth.adminPassword') {
      if (typeof val !== 'string' || val.length < 8) {
        throw new Error('Administrator password must be at least 8 characters long.');
      }
      if (!this.currentConfig.auth) this.currentConfig.auth = {};
      this.currentConfig.auth.adminPasswordHash = hashPassword(val);
      this.saveConfig();
      return;
    } else if (
      key.startsWith('globalLimits.') ||
      key.startsWith('guestSettings.')
    ) {
      if (key === 'guestSettings.allowGuestAccess') {
        if (typeof val !== 'boolean') {
          throw new Error('allowGuestAccess must be a boolean.');
        }
      } else if (
        val !== null &&
        (typeof val !== 'number' || isNaN(val) || val < 0)
      ) {
        throw new Error(
          `Value for "${key}" must be a positive number or empty (null).`,
        );
      }
    }

    const parts = key.split('.');
    if (parts.length === 0) return;

    let target: any = this.currentConfig;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      // Prevent prototype pollution
      if (
        part === '__proto__' ||
        part === 'constructor' ||
        part === 'prototype'
      ) {
        throw new Error('Invalid key path');
      }
      if (target[part] === null || typeof target[part] !== 'object') {
        target[part] = {};
      }

      target = target[part];
    }

    const finalKey = parts[parts.length - 1];
    if (
      finalKey === '__proto__' ||
      finalKey === 'constructor' ||
      finalKey === 'prototype'
    ) {
      throw new Error('Invalid key path');
    }

    target[finalKey] = val;

    this.saveConfig();
  }

  public addModelProvider(type: string, name: string, config: any) {
    const newModelProvider: ConfigModelProvider = {
      id: crypto.randomUUID(),
      name,
      type,
      config,
      chatModels: [],
      embeddingModels: [],
      hash: hashObj(config),
    };

    this.currentConfig.modelProviders.push(newModelProvider);
    this.saveConfig();

    return newModelProvider;
  }

  public removeModelProvider(id: string) {
    const index = this.currentConfig.modelProviders.findIndex(
      (p) => p.id === id,
    );

    if (index === -1) return;

    this.currentConfig.modelProviders =
      this.currentConfig.modelProviders.filter((p) => p.id !== id);

    this.saveConfig();
  }

  public async updateModelProvider(id: string, name: string, config: any) {
    const provider = this.currentConfig.modelProviders.find((p) => {
      return p.id === id;
    });

    if (!provider) throw new Error('Provider not found');

    // Merge config preserving existing secrets if masked values were submitted
    const mergedConfig: Record<string, any> = { ...(config || {}) };

    for (const key of Object.keys(provider.config || {})) {
      if (this.isSensitiveField(key, provider.type)) {
        const incomingVal = mergedConfig[key];
        // If the incoming value is masked, empty, or placeholder, retain the existing stored secret
        if (
          incomingVal === MASKED_SECRET ||
          incomingVal === '[CONFIGURED]' ||
          (incomingVal === '' && provider.config[key])
        ) {
          mergedConfig[key] = provider.config[key];
        }
      }
    }

    provider.name = name;
    provider.config = mergedConfig;
    provider.hash = hashObj(mergedConfig);

    this.saveConfig();

    return provider;
  }

  public addProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    model: any,
  ) {
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    delete model.type;

    if (type === 'chat') {
      provider.chatModels.push(model);
    } else {
      provider.embeddingModels.push(model);
    }

    this.saveConfig();

    return model;
  }

  public removeProviderModel(
    providerId: string,
    type: 'embedding' | 'chat',
    modelKey: string,
  ) {
    const provider = this.currentConfig.modelProviders.find(
      (p) => p.id === providerId,
    );

    if (!provider) throw new Error('Invalid provider id');

    if (type === 'chat') {
      provider.chatModels = provider.chatModels.filter(
        (m) => m.key !== modelKey,
      );
    } else {
      provider.embeddingModels = provider.embeddingModels.filter(
        (m) => m.key != modelKey,
      );
    }

    this.saveConfig();
  }

  public isSetupComplete() {
    return this.currentConfig.setupComplete;
  }

  public markSetupComplete() {
    if (!this.currentConfig.setupComplete) {
      this.currentConfig.setupComplete = true;
    }

    this.saveConfig();
  }

  public getUIConfigSections(): UIConfigSections {
    return this.uiConfigSections;
  }

  public getCurrentConfig(): Config {
    return JSON.parse(JSON.stringify(this.currentConfig));
  }

  public async setNetworkExposure(
    expose: boolean,
    authConfig?: { adminPassword?: string },
  ): Promise<void> {
    if (expose) {
      const hasEnvApiKey = Boolean(
        process.env.API_KEY ||
        process.env.AUTH_SECRET ||
        process.env.VANE_API_KEY,
      );
      const hasAdminPassword = Boolean(
        this.currentConfig.auth?.adminPasswordHash || authConfig?.adminPassword,
      );
      const isMultiUser = this.currentConfig.instanceMode === 'multi';

      if (!hasEnvApiKey && !hasAdminPassword && !isMultiUser) {
        throw new Error(
          'Enabling network exposure requires setting an administrator password or an API_KEY.',
        );
      }

      if (authConfig?.adminPassword) {
        if (authConfig.adminPassword.length < 8) {
          throw new Error(
            'Administrator password must contain at least 8 characters.',
          );
        }
        if (!this.currentConfig.auth) this.currentConfig.auth = {};
        this.currentConfig.auth.adminPasswordHash = hashPassword(
          authConfig.adminPassword,
        );
      }
    }

    if (!this.currentConfig.network) this.currentConfig.network = {};
    this.currentConfig.network.exposeToNetwork = Boolean(expose);
    this.saveConfig();
  }

  public setInstanceMode(mode: 'single' | 'multi') {
    this.currentConfig.instanceMode = mode;
    this.saveConfig();
  }

  public setGuestSettings(settings: any) {
    this.currentConfig.guestSettings = {
      ...(this.currentConfig.guestSettings || {}),
      ...settings,
    };
    this.saveConfig();
  }

  public setAdminPassword(password: string) {
    if (!password || password.length < 8) {
      throw new Error('Administrator password must contain at least 8 characters.');
    }
    if (!this.currentConfig.auth) this.currentConfig.auth = {};
    this.currentConfig.auth.adminPasswordHash = hashPassword(password);
    this.saveConfig();
  }

  public setGlobalLimits(limits: any) {
    this.currentConfig.globalLimits = {
      ...(this.currentConfig.globalLimits || {}),
      ...limits,
    };
    this.saveConfig();
  }
}

const configManager = new ConfigManager();

export default configManager;
