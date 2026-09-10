import { Model } from '../models/types';

type BaseUIConfigField = {
  name: string;
  key: string;
  required: boolean;
  description: string;
  scope: 'client' | 'server';
  env?: string;
};

type StringUIConfigField = BaseUIConfigField & {
  type: 'string';
  placeholder?: string;
  default?: string;
};

type SelectUIConfigFieldOptions = {
  name: string;
  value: string;
};

type SelectUIConfigField = BaseUIConfigField & {
  type: 'select';
  default?: string;
  options: SelectUIConfigFieldOptions[];
};

type PasswordUIConfigField = BaseUIConfigField & {
  type: 'password';
  placeholder?: string;
  default?: string;
};

type TextareaUIConfigField = BaseUIConfigField & {
  type: 'textarea';
  placeholder?: string;
  default?: string;
};

type SwitchUIConfigField = BaseUIConfigField & {
  type: 'switch';
  default?: boolean;
};

type UIConfigField =
  | StringUIConfigField
  | SelectUIConfigField
  | PasswordUIConfigField
  | TextareaUIConfigField
  | SwitchUIConfigField;

type ConfigModelProvider = {
  id: string;
  name: string;
  type: string;
  chatModels: Model[];
  embeddingModels: Model[];
  config: { [key: string]: any };
  hash: string;
};

type Config = {
  version: number;
  setupComplete: boolean;
  instanceMode?: 'single' | 'multi';
  auth?: {
    adminPasswordHash?: string;
    jwtSecret?: string;
  };
  network?: {
    exposeToNetwork?: boolean;
    trustedProxies?: string[];
  };
  guestSettings?: {
    allowGuestAccess?: boolean;
    tokenLimit5h?: number;
    tokenLimitWeekly?: number;
    tokenLimitPerDay?: number;
    tokenLimitPerMonth?: number;
    maxTokensPerRequest?: number;
    qualityModeMaxTokens?: number | null;
    allowedProviders?: string[];
    allowedModels?: string[];
  };
  globalLimits?: {
    tokenLimit5h?: number | null;
    tokenLimitWeekly?: number | null;
    tokenLimitPerDay?: number | null;
    tokenLimitPerMonth?: number | null;
    maxTokensPerRequest?: number | null;
    qualityModeMaxTokens?: number | null;
  };
  preferences: {
    [key: string]: any;
  };
  personalization: {
    [key: string]: any;
  };
  modelProviders: ConfigModelProvider[];
  search: {
    [key: string]: any;
  };
};

type EnvMap = {
  [key: string]: {
    fieldKey: string;
    providerKey: string;
  };
};

type ModelProviderUISection = {
  name: string;
  key: string;
  fields: UIConfigField[];
};

type UIConfigSections = {
  preferences: UIConfigField[];
  personalization: UIConfigField[];
  modelProviders: ModelProviderUISection[];
  search: UIConfigField[];
};

export type {
  UIConfigField,
  Config,
  EnvMap,
  UIConfigSections,
  SelectUIConfigField,
  StringUIConfigField,
  ModelProviderUISection,
  ConfigModelProvider,
  TextareaUIConfigField,
  SwitchUIConfigField,
};
