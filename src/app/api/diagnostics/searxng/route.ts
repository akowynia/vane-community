import { NextRequest, NextResponse } from 'next/server';
import { getSearxngURL } from '@/lib/config/serverRegistry';
import { validateSearxngURL } from '@/lib/security/ssrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = async (req: NextRequest) => {
  let targetUrl = '';
  try {
    const body = await req.json().catch(() => ({}));
    targetUrl = (typeof body?.url === 'string' && body.url.trim())
      ? body.url.trim()
      : getSearxngURL();
  } catch {
    targetUrl = getSearxngURL();
  }

  if (!targetUrl) {
    targetUrl =
      process.env.SEARXNG_API_URL ||
      process.env.SEARXNG_URL ||
      process.env.SEARX_URL ||
      'http://127.0.0.1:8080';
  }

  targetUrl = targetUrl.trim().replace(/\/+$/, '');
  targetUrl = targetUrl.replace(
    /^http:\/\/localhost(?::(\d+))?/,
    (_match, port) => {
      return port ? `http://127.0.0.1:${port}` : 'http://127.0.0.1';
    },
  );

  const validation = await validateSearxngURL(targetUrl);
  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        error: `SSRF Validation: ${validation.reason}`,
        url: targetUrl,
      },
      { status: 400 },
    );
  }

  const testUrl = new URL(`${targetUrl}/search?format=json&q=test`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  const startTime = Date.now();

  try {
    const res = await fetch(testUrl, {
      headers: {
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        latencyMs,
        error: `HTTP Error ${res.status}: ${res.statusText || 'SearXNG returned non-200 status'}`,
        url: targetUrl,
      });
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return NextResponse.json({
        success: false,
        latencyMs,
        error: 'SearXNG responded, but the output was not valid JSON.',
        url: targetUrl,
      });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({
        success: false,
        latencyMs,
        error: 'SearXNG returned unexpected data format.',
        url: targetUrl,
      });
    }

    const resultsCount = Array.isArray(data.results) ? data.results.length : 0;
    const unresponsiveCount = Array.isArray(data.unresponsive_engines)
      ? data.unresponsive_engines.length
      : 0;

    return NextResponse.json({
      success: true,
      latencyMs,
      resultsCount,
      unresponsiveCount,
      url: targetUrl,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      err.name === 'AbortError'
        ? 'Connection timed out after 7000ms.'
        : err.message || 'Unknown network error occurred while connecting to SearXNG.';

    return NextResponse.json({
      success: false,
      latencyMs,
      error: errorMessage,
      url: targetUrl,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};
