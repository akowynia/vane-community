import fs from 'node:fs';
import path from 'node:path';
import vault from '../security/vault';
import configManager, { MASKED_SECRET } from '../config';

export interface SearchEngineItem {
  name: string;
  engine: string;
  disabled: boolean;
  isProblematic: boolean;
  supportsApiKey: boolean;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  apiKeyHelpUrl?: string;
  category: 'web' | 'academic' | 'social' | 'encyclopedia' | 'news' | 'other';
}

export interface SearchEnginesConfigResponse {
  engines: SearchEngineItem[];
  braveApiKeyConfigured: boolean;
  braveApiKeyMasked: string;
  apiKeysConfigured: Record<string, boolean>;
}

export interface UpdateSearchEnginesPayload {
  engines?: Record<string, boolean>; // key: engine name, value: isEnabled (boolean)
  braveApiKey?: string; // backwards compatibility
  apiKeys?: Record<string, string>; // key: engine name, value: apiKey (plaintext, masked, or empty string to remove)
}

const PROBLEMATIC_ENGINES = new Set(['duckduckgo', 'brave', 'yahoo', 'mojeek']);

export const SUPPORTED_API_ENGINES: Record<
  string,
  {
    helpUrl: string;
    descriptionKey?: string;
  }
> = {
  brave: {
    helpUrl: 'https://brave.com/search/api/',
  },
  bing: {
    helpUrl: 'https://www.microsoft.com/en-us/bing/apis/bing-web-search-api',
  },
  google: {
    helpUrl: 'https://developers.google.com/custom-search/v1/overview',
  },
  mojeek: {
    helpUrl: 'https://www.mojeek.com/services/search/api/',
  },
  pubmed: {
    helpUrl: 'https://ncbiinsights.ncbi.nlm.nih.gov/2017/11/02/new-api-keys-for-the-e-utilities/',
  },
};

const ENGINE_CATEGORIES: Record<string, SearchEngineItem['category']> = {
  google: 'web',
  bing: 'web',
  qwant: 'web',
  startpage: 'web',
  duckduckgo: 'web',
  brave: 'web',
  yahoo: 'web',
  mojeek: 'web',
  wikipedia: 'encyclopedia',
  wikidata: 'encyclopedia',
  hackernews: 'social',
  stackexchange: 'social',
  github: 'social',
  arxiv: 'academic',
  pubmed: 'academic',
  crossref: 'academic',
  'google news': 'news',
};

const DEFAULT_ENGINES: SearchEngineItem[] = [
  { name: 'google', engine: 'google', disabled: false, isProblematic: false, supportsApiKey: true, hasApiKey: false, apiKeyHelpUrl: SUPPORTED_API_ENGINES.google.helpUrl, category: 'web' },
  { name: 'bing', engine: 'bing', disabled: false, isProblematic: false, supportsApiKey: true, hasApiKey: false, apiKeyHelpUrl: SUPPORTED_API_ENGINES.bing.helpUrl, category: 'web' },
  { name: 'qwant', engine: 'qwant', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'web' },
  { name: 'startpage', engine: 'startpage', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'web' },
  { name: 'wikidata', engine: 'wikidata', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'encyclopedia' },
  { name: 'wikipedia', engine: 'wikipedia', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'encyclopedia' },
  { name: 'hackernews', engine: 'hackernews', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'social' },
  { name: 'stackexchange', engine: 'stackexchange', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'social' },
  { name: 'github', engine: 'github', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'social' },
  { name: 'arxiv', engine: 'arxiv', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'academic' },
  { name: 'pubmed', engine: 'pubmed', disabled: false, isProblematic: false, supportsApiKey: true, hasApiKey: false, apiKeyHelpUrl: SUPPORTED_API_ENGINES.pubmed.helpUrl, category: 'academic' },
  { name: 'crossref', engine: 'crossref', disabled: false, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'academic' },
  { name: 'duckduckgo', engine: 'duckduckgo', disabled: true, isProblematic: true, supportsApiKey: false, hasApiKey: false, category: 'web' },
  { name: 'brave', engine: 'brave', disabled: true, isProblematic: true, supportsApiKey: true, hasApiKey: false, apiKeyHelpUrl: SUPPORTED_API_ENGINES.brave.helpUrl, category: 'web' },
  { name: 'yahoo', engine: 'yahoo', disabled: true, isProblematic: true, supportsApiKey: false, hasApiKey: false, category: 'web' },
  { name: 'mojeek', engine: 'mojeek', disabled: true, isProblematic: true, supportsApiKey: true, hasApiKey: false, apiKeyHelpUrl: SUPPORTED_API_ENGINES.mojeek.helpUrl, category: 'web' },
  { name: 'google news', engine: 'google_news', disabled: true, isProblematic: false, supportsApiKey: false, hasApiKey: false, category: 'news' },
];

/**
 * Return candidate filepaths for settings.yml in priority order
 */
export function getSettingsFilePaths(): string[] {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const persistentPath = path.join(dataDir, 'searxng-settings.yml');

  const paths = [
    persistentPath,
    process.env.SEARXNG_SETTINGS_PATH,
    '/etc/searxng/settings.yml',
    path.join(process.cwd(), 'searxng', 'settings.yml'),
  ].filter((p): p is string => Boolean(p && p.trim()));

  return Array.from(new Set(paths));
}

/**
 * Find the primary active settings.yml file to read from
 */
export function findActiveSettingsFilePath(): string | null {
  const candidatePaths = getSettingsFilePaths();
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Parse engines section from raw settings.yml content
 */
export function parseEnginesFromYaml(yamlContent: string): {
  engines: SearchEngineItem[];
  apiKeysFromYaml: Record<string, string>;
} {
  const engines: SearchEngineItem[] = [];
  const apiKeysFromYaml: Record<string, string> = {};

  const lines = yamlContent.split(/\r?\n/);
  let insideEngines = false;
  let currentEngine: Partial<SearchEngineItem> & { apiKey?: string } = {};

  const pushCurrentEngine = () => {
    if (currentEngine.name) {
      const name = currentEngine.name.trim();
      const lowerName = name.toLowerCase();
      const engine = currentEngine.engine?.trim() || name;
      const disabled = currentEngine.disabled === true;
      const isProblematic = PROBLEMATIC_ENGINES.has(lowerName);
      const apiInfo = SUPPORTED_API_ENGINES[lowerName];
      const supportsApiKey = Boolean(apiInfo);
      const hasApiKey = Boolean(currentEngine.apiKey && currentEngine.apiKey.trim().length > 0);
      const category = ENGINE_CATEGORIES[lowerName] || 'other';

      if (currentEngine.apiKey) {
        apiKeysFromYaml[lowerName] = currentEngine.apiKey;
      }

      engines.push({
        name,
        engine,
        disabled,
        isProblematic,
        supportsApiKey,
        hasApiKey,
        apiKeyMasked: hasApiKey ? MASKED_SECRET : '',
        apiKeyHelpUrl: apiInfo?.helpUrl,
        category,
      });
    }
    currentEngine = {};
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!insideEngines) {
      if (/^engines:\s*$/.test(trimmed)) {
        insideEngines = true;
      }
      continue;
    }

    // Next top-level section reached
    if (/^[a-zA-Z0-9_-]+:/.test(trimmed) && !trimmed.startsWith('-') && !line.startsWith(' ') && !line.startsWith('\t')) {
      pushCurrentEngine();
      break;
    }

    if (trimmed.startsWith('- ')) {
      pushCurrentEngine();
      const rest = trimmed.substring(2).trim();
      const match = rest.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const val = match[2].replace(/^['"]|['"]$/g, '').trim();
        if (key === 'name') currentEngine.name = val;
        if (key === 'engine') currentEngine.engine = val;
        if (key === 'disabled') currentEngine.disabled = val === 'true';
        if (key === 'api_key') currentEngine.apiKey = val;
      }
    } else if (trimmed.includes(':') && (line.startsWith('  ') || line.startsWith('\t'))) {
      const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const val = match[2].replace(/^['"]|['"]$/g, '').trim();
        if (key === 'name') currentEngine.name = val;
        if (key === 'engine') currentEngine.engine = val;
        if (key === 'disabled') currentEngine.disabled = val === 'true';
        if (key === 'api_key') currentEngine.apiKey = val;
      }
    }
  }

  pushCurrentEngine();

  if (engines.length === 0) {
    return { engines: [...DEFAULT_ENGINES], apiKeysFromYaml };
  }

  return { engines, apiKeysFromYaml };
}

/**
 * Get configured API key for an engine from Vault
 */
export function getStoredApiKey(engineName: string): string | null {
  const lowerName = engineName.toLowerCase();
  
  // Backwards compatibility for brave key
  if (lowerName === 'brave') {
    const encBrave = configManager.getConfig('search.braveApiKey', '');
    if (encBrave && typeof encBrave === 'string' && encBrave.trim() !== '') {
      const decrypted = vault.decrypt(encBrave);
      if (decrypted && decrypted.trim() !== '') {
        return decrypted.trim();
      }
    }
  }

  const encKey = configManager.getConfig(`search.apiKeys.${lowerName}`, '');
  if (encKey && typeof encKey === 'string' && encKey.trim() !== '') {
    const decrypted = vault.decrypt(encKey);
    if (decrypted && decrypted.trim() !== '') {
      return decrypted.trim();
    }
  }
  return null;
}

/**
 * Get current engines configuration for UI and API
 */
export function getSearchEnginesConfig(): SearchEnginesConfigResponse {
  const filePath = findActiveSettingsFilePath();
  let engines = [...DEFAULT_ENGINES];
  let apiKeysInYaml: Record<string, string> = {};

  if (filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseEnginesFromYaml(content);
      engines = parsed.engines;
      apiKeysInYaml = parsed.apiKeysFromYaml;
    } catch (err) {
      console.warn(`[EnginesManager] Could not read settings from ${filePath}:`, err);
    }
  }

  const apiKeysConfigured: Record<string, boolean> = {};

  // Hydrate each engine with stored Vault key status
  for (const eng of engines) {
    const lowerName = eng.name.toLowerCase();
    const storedKey = getStoredApiKey(lowerName) || apiKeysInYaml[lowerName];
    const isConfigured = Boolean(storedKey && storedKey.trim().length > 0);

    eng.hasApiKey = isConfigured;
    eng.apiKeyMasked = isConfigured ? MASKED_SECRET : '';
    eng.supportsApiKey = Boolean(SUPPORTED_API_ENGINES[lowerName]);
    eng.apiKeyHelpUrl = SUPPORTED_API_ENGINES[lowerName]?.helpUrl;

    apiKeysConfigured[lowerName] = isConfigured;

    // If API key is configured for a problematic engine (like Brave or Mojeek), it is stabilized
    if (isConfigured && eng.disabled && (lowerName === 'brave' || lowerName === 'mojeek')) {
      eng.disabled = false;
    }
  }

  const isBraveConfigured = Boolean(apiKeysConfigured.brave);

  return {
    engines,
    braveApiKeyConfigured: isBraveConfigured,
    braveApiKeyMasked: isBraveConfigured ? MASKED_SECRET : '',
    apiKeysConfigured,
  };
}

/**
 * Update engines in settings.yml and store API keys in Vault
 */
export async function updateSearchEnginesConfig(
  payload: UpdateSearchEnginesPayload,
): Promise<{ success: boolean; message: string }> {
  const { engines: engineToggles, braveApiKey, apiKeys: incomingApiKeys } = payload;

  const resolvedApiKeysToUpdate: Record<string, string> = {
    ...(incomingApiKeys || {}),
  };

  // Backwards compatibility for braveApiKey property
  if (braveApiKey !== undefined) {
    resolvedApiKeysToUpdate.brave = braveApiKey;
  }

  // 1. Process and save API keys to Vault
  for (const [engineName, keyVal] of Object.entries(resolvedApiKeysToUpdate)) {
    const lowerName = engineName.toLowerCase();
    const cleanKey = (keyVal || '').trim();

    if (cleanKey === '') {
      // Clear key
      await configManager.updateConfig(`search.apiKeys.${lowerName}`, '');
      if (lowerName === 'brave') {
        await configManager.updateConfig('search.braveApiKey', '');
      }
    } else if (cleanKey !== MASKED_SECRET && cleanKey !== '[CONFIGURED]') {
      // Encrypt and store key in Vault
      const encrypted = vault.encrypt(cleanKey);
      await configManager.updateConfig(`search.apiKeys.${lowerName}`, encrypted);
      if (lowerName === 'brave') {
        await configManager.updateConfig('search.braveApiKey', encrypted);
      }
    }
  }

  // 2. Read existing settings file content or fallback template
  const filePath = findActiveSettingsFilePath();
  let content = '';

  if (filePath && fs.existsSync(filePath)) {
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.warn(`[EnginesManager] Error reading ${filePath}:`, err);
    }
  }

  if (!content) {
    const fallbackPath = path.join(process.cwd(), 'searxng', 'settings.yml');
    if (fs.existsSync(fallbackPath)) {
      content = fs.readFileSync(fallbackPath, 'utf-8');
    }
  }

  // 3. Parse existing engines
  const parsed = parseEnginesFromYaml(content);
  const currentEngines = parsed.engines;

  // 4. Apply toggle updates
  if (engineToggles && typeof engineToggles === 'object') {
    for (const [name, isEnabled] of Object.entries(engineToggles)) {
      const match = currentEngines.find(
        (e) => e.name.toLowerCase() === name.toLowerCase(),
      );
      if (match) {
        match.disabled = !isEnabled;
      } else {
        const lowerName = name.toLowerCase();
        currentEngines.push({
          name,
          engine: name,
          disabled: !isEnabled,
          isProblematic: PROBLEMATIC_ENGINES.has(lowerName),
          supportsApiKey: Boolean(SUPPORTED_API_ENGINES[lowerName]),
          hasApiKey: false,
          apiKeyHelpUrl: SUPPORTED_API_ENGINES[lowerName]?.helpUrl,
          category: ENGINE_CATEGORIES[lowerName] || 'other',
        });
      }
    }
  }

  // 5. Apply API keys to current engines in list
  for (const eng of currentEngines) {
    const lowerName = eng.name.toLowerCase();
    const activeKey = getStoredApiKey(lowerName);

    if (activeKey) {
      eng.hasApiKey = true;
      if (lowerName === 'brave' || lowerName === 'mojeek') {
        eng.disabled = false;
      }
    } else if (resolvedApiKeysToUpdate[lowerName] === '') {
      eng.hasApiKey = false;
      if (lowerName === 'brave' || lowerName === 'mojeek') {
        eng.disabled = true;
      }
    }
  }

  // 6. Generate new engines YAML block
  let enginesYaml = `# ==============================================================================
# Search Engines Configuration
# ==============================================================================
engines:\n`;

  for (const eng of currentEngines) {
    const lowerName = eng.name.toLowerCase();
    const activeKey = getStoredApiKey(lowerName);

    enginesYaml += `  - name: ${eng.name}\n`;
    enginesYaml += `    engine: ${eng.engine || eng.name}\n`;
    enginesYaml += `    disabled: ${eng.disabled ? 'true' : 'false'}\n`;
    if (activeKey) {
      enginesYaml += `    api_key: "${activeKey}"\n`;
    }
  }

  // 7. Replace engines block in YAML content
  let updatedContent = '';
  if (/engines:\s*[\s\S]*$/.test(content)) {
    const splitIdx = content.indexOf('engines:');
    const commentMarker = '# ==============================================================================\n# Search Engines Configuration';
    const commentIdx = content.indexOf(commentMarker);
    if (commentIdx !== -1 && commentIdx < splitIdx) {
      updatedContent = content.substring(0, commentIdx).trimEnd() + '\n\n' + enginesYaml;
    } else {
      updatedContent = content.substring(0, splitIdx).trimEnd() + '\n\n' + enginesYaml;
    }
  } else {
    updatedContent = content.trimEnd() + '\n\n' + enginesYaml;
  }

  // 8. Write to persistent locations
  const writePaths = getSettingsFilePaths();
  let writtenAny = false;

  for (const targetPath of writePaths) {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, updatedContent, 'utf-8');
      writtenAny = true;
      console.log(`[EnginesManager] Updated SearXNG settings at ${targetPath}`);
    } catch (err: any) {
      // Ignored if path is readonly in local dev
    }
  }

  if (!writtenAny) {
    throw new Error('Failed to save the engines configuration to settings.yml.');
  }

  return {
    success: true,
    message: 'Search engines configuration was updated successfully.',
  };
}
