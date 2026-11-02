export interface BatchSourceResult {
  title: string;
  url: string;
  content?: string;
}

export interface BatchQueryItem {
  id: string;
  number: string;
  query: string;
  sources: string[];
  optimizationMode: 'speed' | 'balanced' | 'quality';
  modelKey?: string;
  providerId?: string;
  selected: boolean;
  status: 'pending' | 'searching' | 'completed' | 'error';
  response?: string;
  sourcesList?: BatchSourceResult[];
  error?: string;
  durationMs?: number;
}

export type HeaderFormatType = 'query_number' | 'number_query';

export interface BatchSearchGlobalConfig {
  defaultSources: string[];
  defaultOptimizationMode: 'speed' | 'balanced' | 'quality';
  defaultModelKey?: string;
  defaultProviderId?: string;
  headerFormat: HeaderFormatType;
  includeSources: boolean;
}
