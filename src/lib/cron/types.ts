export type WebhookChannelType = 'telegram' | 'discord' | 'slack' | 'generic' | 'email';

export interface CronWebhookConfig {
  id: string;
  type: WebhookChannelType;
  enabled: boolean;
  name?: string;
  url?: string;
  token?: string;
  chatId?: string;
  email?: string;
  secret?: string;
  mode?: 'summary' | 'full';
  events?: ('success' | 'error')[];
}

export interface WebhookDispatchPayload {
  cronId: string;
  cronName: string;
  waypointName?: string;
  chatId?: string;
  status: 'success' | 'error';
  prompt: string;
  summary?: string;
  fullContent?: string;
  sources?: Array<{ title?: string; url?: string }>;
  error?: string;
  executedAt: string;
}

export interface WebhookDispatchResult {
  webhookId: string;
  type: WebhookChannelType;
  success: boolean;
  statusCode?: number;
  error?: string;
}

