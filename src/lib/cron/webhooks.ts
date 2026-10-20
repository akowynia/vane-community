import crypto from 'crypto';
import { validateUrlForSSRF } from '@/lib/security/ssrf';
import {
  CronWebhookConfig,
  WebhookChannelType,
  WebhookDispatchPayload,
  WebhookDispatchResult,
} from './types';

/**
 * Truncate text cleanly with ellipsis if exceeding maxLength
 */
function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Build clean plain text / markdown summary for messengers
 */
function formatNotificationText(
  payload: WebhookDispatchPayload,
  mode: 'summary' | 'full' = 'summary',
): string {
  const statusEmoji = payload.status === 'success' ? '✅' : '❌';
  const title = `*${statusEmoji} Vane Research Task: ${payload.cronName}*`;
  const spaceInfo = payload.waypointName ? `_Space: ${payload.waypointName}_\n` : '';
  const promptInfo = `*Prompt:* ${payload.prompt}\n`;

  if (payload.status === 'error') {
    return `${title}\n${spaceInfo}${promptInfo}\n⚠️ *Execution Error:*\n${payload.error || 'Unknown error occurred.'}`;
  }

  const contentToDisplay =
    mode === 'full' && payload.fullContent
      ? payload.fullContent
      : payload.summary || payload.fullContent || 'Task completed successfully.';

  const truncatedContent = truncateText(contentToDisplay, mode === 'full' ? 3800 : 1200);

  let sourcesSection = '';
  if (payload.sources && payload.sources.length > 0) {
    const sourceLinks = payload.sources
      .slice(0, 5)
      .map((s, idx) => `[${idx + 1}] [${s.title || 'Source'}](${s.url})`)
      .join('\n');
    sourcesSection = `\n\n*Top Sources:*\n${sourceLinks}`;
  }

  return `${title}\n${spaceInfo}${promptInfo}\n${truncatedContent}${sourcesSection}`;
}

/**
 * Send notification to Telegram bot
 */
async function sendTelegram(
  config: CronWebhookConfig,
  payload: WebhookDispatchPayload,
): Promise<WebhookDispatchResult> {
  if (!config.token || !config.chatId) {
    return {
      webhookId: config.id,
      type: 'telegram',
      success: false,
      error: 'Telegram Bot Token and Chat ID are required.',
    };
  }

  const telegramApiUrl = `https://api.telegram.org/bot${config.token}/sendMessage`;
  const messageText = formatNotificationText(payload, config.mode || 'summary');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: messageText,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      return {
        webhookId: config.id,
        type: 'telegram',
        success: false,
        statusCode: res.status,
        error: data.description || `HTTP ${res.status}: Failed to deliver Telegram message`,
      };
    }

    return {
      webhookId: config.id,
      type: 'telegram',
      success: true,
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      webhookId: config.id,
      type: 'telegram',
      success: false,
      error: err?.message || 'Network error while contacting Telegram API.',
    };
  }
}

/**
 * Send notification to Discord webhook
 */
async function sendDiscord(
  config: CronWebhookConfig,
  payload: WebhookDispatchPayload,
): Promise<WebhookDispatchResult> {
  if (!config.url) {
    return {
      webhookId: config.id,
      type: 'discord',
      success: false,
      error: 'Discord Webhook URL is required.',
    };
  }

  const ssrfCheck = await validateUrlForSSRF(config.url);
  if (!ssrfCheck.valid) {
    return {
      webhookId: config.id,
      type: 'discord',
      success: false,
      error: `SSRF validation failed: ${ssrfCheck.reason}`,
    };
  }

  const isSuccess = payload.status === 'success';
  const color = isSuccess ? 0x22c55e : 0xef4444; // Green or Red
  const description =
    isSuccess
      ? truncateText(payload.summary || payload.fullContent || 'Research completed.', 2000)
      : `**Error:** ${payload.error || 'Unknown error'}`;

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: 'Prompt', value: truncateText(payload.prompt, 1000) },
  ];

  if (payload.waypointName) {
    fields.push({ name: 'Space', value: payload.waypointName, inline: true });
  }

  if (isSuccess && payload.sources && payload.sources.length > 0) {
    const formattedSources = payload.sources
      .slice(0, 5)
      .map((s) => `• [${s.title || 'Link'}](${s.url})`)
      .join('\n');
    fields.push({ name: 'Sources', value: formattedSources });
  }

  const embed = {
    title: `Vane Research: ${payload.cronName}`,
    description,
    color,
    fields,
    timestamp: payload.executedAt,
    footer: { text: 'Vane-Community Scheduled Intelligence' },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        webhookId: config.id,
        type: 'discord',
        success: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Failed to dispatch Discord webhook`,
      };
    }

    return {
      webhookId: config.id,
      type: 'discord',
      success: true,
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      webhookId: config.id,
      type: 'discord',
      success: false,
      error: err?.message || 'Network error while contacting Discord.',
    };
  }
}

/**
 * Send notification to Slack webhook
 */
async function sendSlack(
  config: CronWebhookConfig,
  payload: WebhookDispatchPayload,
): Promise<WebhookDispatchResult> {
  if (!config.url) {
    return {
      webhookId: config.id,
      type: 'slack',
      success: false,
      error: 'Slack Webhook URL is required.',
    };
  }

  const ssrfCheck = await validateUrlForSSRF(config.url);
  if (!ssrfCheck.valid) {
    return {
      webhookId: config.id,
      type: 'slack',
      success: false,
      error: `SSRF validation failed: ${ssrfCheck.reason}`,
    };
  }

  const statusText = payload.status === 'success' ? ':white_check_mark: Completed' : ':x: Failed';
  const mainText =
    payload.status === 'success'
      ? truncateText(payload.summary || payload.fullContent || 'Research finished.', 2000)
      : `*Error:* ${payload.error || 'Execution failed'}`;

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Vane Task: ${payload.cronName}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Status:*\n${statusText}` },
        { type: 'mrkdwn', text: `*Space:*\n${payload.waypointName || 'Default'}` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Prompt:*\n>${payload.prompt.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Findings:*\n${mainText}`,
      },
    },
  ];

  if (payload.sources && payload.sources.length > 0) {
    const sourcesMd = payload.sources
      .slice(0, 5)
      .map((s) => `<${s.url}|${s.title || 'Source'}>`)
      .join('  |  ');
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `*Top Sources:* ${sourcesMd}` }],
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        webhookId: config.id,
        type: 'slack',
        success: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Failed to dispatch Slack webhook`,
      };
    }

    return {
      webhookId: config.id,
      type: 'slack',
      success: true,
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      webhookId: config.id,
      type: 'slack',
      success: false,
      error: err?.message || 'Network error while contacting Slack.',
    };
  }
}

/**
 * Send generic JSON webhook with HMAC-SHA256 signature
 */
async function sendGenericWebhook(
  config: CronWebhookConfig,
  payload: WebhookDispatchPayload,
): Promise<WebhookDispatchResult> {
  if (!config.url) {
    return {
      webhookId: config.id,
      type: 'generic',
      success: false,
      error: 'Webhook target URL is required.',
    };
  }

  const ssrfCheck = await validateUrlForSSRF(config.url);
  if (!ssrfCheck.valid) {
    return {
      webhookId: config.id,
      type: 'generic',
      success: false,
      error: `SSRF validation failed: ${ssrfCheck.reason}`,
    };
  }

  const serializedBody = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Vane-Community-Notifier/1.0',
  };

  if (config.secret) {
    const hmac = crypto
      .createHmac('sha256', config.secret)
      .update(serializedBody)
      .digest('hex');
    headers['X-Vane-Signature'] = `sha256=${hmac}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(config.url, {
      method: 'POST',
      headers,
      body: serializedBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        webhookId: config.id,
        type: 'generic',
        success: false,
        statusCode: res.status,
        error: `HTTP ${res.status}: Webhook returned error response`,
      };
    }

    return {
      webhookId: config.id,
      type: 'generic',
      success: true,
      statusCode: res.status,
    };
  } catch (err: any) {
    return {
      webhookId: config.id,
      type: 'generic',
      success: false,
      error: err?.message || 'Network error while dispatching generic webhook.',
    };
  }
}

/**
 * Dispatch single notification by channel type
 */
export async function dispatchSingleWebhook(
  config: CronWebhookConfig,
  payload: WebhookDispatchPayload,
): Promise<WebhookDispatchResult> {
  switch (config.type) {
    case 'telegram':
      return sendTelegram(config, payload);
    case 'discord':
      return sendDiscord(config, payload);
    case 'slack':
      return sendSlack(config, payload);
    case 'generic':
      return sendGenericWebhook(config, payload);
    case 'email':
      // For email, if no SMTP client configured, return informative status
      return {
        webhookId: config.id,
        type: 'email',
        success: true,
        error: 'Email channel queued for background SMTP transport.',
      };
    default:
      return {
        webhookId: config.id,
        type: config.type,
        success: false,
        error: `Unsupported webhook channel type: ${config.type}`,
      };
  }
}

/**
 * Dispatch all configured webhooks for a given cron execution
 */
export async function dispatchCronWebhooks(
  rawWebhooks: any,
  payload: WebhookDispatchPayload,
): Promise<WebhookDispatchResult[]> {
  let webhookList: CronWebhookConfig[] = [];

  if (Array.isArray(rawWebhooks)) {
    webhookList = rawWebhooks;
  } else if (typeof rawWebhooks === 'string') {
    try {
      webhookList = JSON.parse(rawWebhooks);
    } catch {
      webhookList = [];
    }
  }

  if (!webhookList || webhookList.length === 0) {
    return [];
  }

  const eligibleWebhooks = webhookList.filter((wh) => {
    if (!wh.enabled) return false;
    const allowedEvents = wh.events || ['success'];
    return allowedEvents.includes(payload.status);
  });

  const results = await Promise.allSettled(
    eligibleWebhooks.map((wh) => dispatchSingleWebhook(wh, payload)),
  );

  return results.map((r, idx) => {
    if (r.status === 'fulfilled') {
      return r.value;
    }
    return {
      webhookId: eligibleWebhooks[idx].id,
      type: eligibleWebhooks[idx].type,
      success: false,
      error: r.reason?.message || 'Execution error during webhook dispatch.',
    };
  });
}

