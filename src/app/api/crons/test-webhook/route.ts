export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { resolveRequestUser } from '@/lib/security/rbac';
import configManager from '@/lib/config';
import { dispatchSingleWebhook } from '@/lib/cron/webhooks';
import { CronWebhookConfig, WebhookDispatchPayload } from '@/lib/cron/types';

export const POST = async (req: Request) => {
  try {
    const user = await resolveRequestUser(req as NextRequest);
    const instanceMode = configManager.getConfig('instanceMode', 'single');

    if (instanceMode === 'multi' && !user) {
      return Response.json(
        { message: 'Authentication required to test webhooks.' },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.webhook) {
      return Response.json(
        { message: 'Invalid payload: webhook configuration is required.' },
        { status: 400 },
      );
    }

    const webhook: CronWebhookConfig = body.webhook;
    const testPayload: WebhookDispatchPayload = {
      cronId: 'test-cron',
      cronName: webhook.name || 'Test Scheduled Task',
      waypointName: 'Test Space',
      status: 'success',
      prompt: 'What are the latest advances in AI?',
      summary: 'This is a test notification confirming that your Vane-Community webhook integration is configured properly and delivering alerts successfully.',
      fullContent: 'This is a test notification confirming that your Vane-Community webhook integration is configured properly and delivering alerts successfully.\n\nEverything is working as expected!',
      sources: [
        { title: 'Vane Community Hub', url: 'https://github.com/akowynia/vane-community' },
      ],
      executedAt: new Date().toISOString(),
    };

    const result = await dispatchSingleWebhook(webhook, testPayload);

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error: result.error || 'Failed to dispatch test notification.',
          statusCode: result.statusCode,
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        success: true,
        message: 'Test notification sent successfully!',
        statusCode: result.statusCode,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('Error testing webhook:', err);
    return Response.json(
      {
        success: false,
        error: err?.message || 'Unexpected server error while testing webhook.',
      },
      { status: 500 },
    );
  }
};

