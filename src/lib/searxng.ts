import { getSearxngURL } from './config/serverRegistry';
import { validateSearxngURL } from './security/ssrf';

export interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export interface SearxngUnresponsiveEngine {
  engine: string;
  error: string;
  type: 'captcha' | 'rate_limit' | 'blocked' | 'error';
}

export interface SearxngResponse {
  results: SearxngSearchResult[];
  suggestions: string[];
  unresponsiveEngines: SearxngUnresponsiveEngine[];
}

export const classifyEngineError = (
  error: string,
): 'captcha' | 'rate_limit' | 'blocked' | 'error' => {
  const lower = error.toLowerCase();
  if (lower.includes('captcha')) {
    return 'captcha';
  }
  if (
    lower.includes('too many request') ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('ratelimit')
  ) {
    return 'rate_limit';
  }
  if (
    lower.includes('403') ||
    lower.includes('access denied') ||
    lower.includes('forbidden') ||
    lower.includes('blocked')
  ) {
    return 'blocked';
  }
  return 'error';
};

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
): Promise<SearxngResponse> => {
  let searxngURL = getSearxngURL();
  if (!searxngURL || searxngURL.trim() === '') {
    searxngURL =
      process.env.SEARXNG_API_URL ||
      process.env.SEARXNG_URL ||
      process.env.SEARX_URL ||
      'http://127.0.0.1:8080';
  }

  searxngURL = searxngURL.trim().replace(/\/+$/, '');
  // Replace localhost with 127.0.0.1 to avoid dual-stack IPv6 (::1) issues in Node.js fetch
  searxngURL = searxngURL.replace(
    /^http:\/\/localhost(?::(\d+))?/,
    (_match, port) => {
      return port ? `http://127.0.0.1:${port}` : 'http://127.0.0.1';
    },
  );

  // Defense-in-depth: validate the SearXNG URL before connecting
  const validation = await validateSearxngURL(searxngURL);
  if (!validation.valid) {
    throw new Error(
      `SSRF Protection: SearXNG URL is invalid or points to restricted destination: ${validation.reason}`,
    );
  }

  const url = new URL(`${searxngURL}/search?format=json`);
  url.searchParams.append('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(','));
        return;
      }
      url.searchParams.append(key, value as string);
    });
  }

  const timeoutMs = parseInt(process.env.SEARXNG_TIMEOUT || '15000', 10) || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  console.log(
    `[SearXNG] Sending search request to: ${url.origin}${url.pathname} for query: "${query}"`,
  );

  try {
    const res = await fetch(url, {
      headers: {
        'X-Forwarded-For': '127.0.0.1',
        'X-Real-IP': '127.0.0.1',
      },
      signal: controller.signal,
    });

    const elapsed = Date.now() - startTime;

    if (!res.ok) {
      console.error(
        `[SearXNG] HTTP error ${res.status} (${res.statusText}) from ${url.origin} for query "${query}" in ${elapsed}ms`,
      );
      throw new Error(`SearXNG error: HTTP ${res.status}`);
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      console.error(
        `[SearXNG] Received invalid JSON response from ${url.origin} for query "${query}" in ${elapsed}ms`,
      );
      throw new Error('SearXNG returned an invalid response format.');
    }

    if (!data || typeof data !== 'object') {
      console.error(
        `[SearXNG] Unexpected data format from ${url.origin} for query "${query}" in ${elapsed}ms`,
      );
      throw new Error('SearXNG returned unexpected data format.');
    }

    const results: SearxngSearchResult[] = Array.isArray(data.results)
      ? data.results
      : [];
    const suggestions: string[] = Array.isArray(data.suggestions)
      ? data.suggestions
      : [];

    const unresponsiveEngines: SearxngUnresponsiveEngine[] = [];

    if (Array.isArray(data.unresponsive_engines)) {
      for (const item of data.unresponsive_engines) {
        if (Array.isArray(item) && item.length >= 2) {
          const engine = String(item[0]);
          const errorMsg = String(item[1]);
          unresponsiveEngines.push({
            engine,
            error: errorMsg,
            type: classifyEngineError(errorMsg),
          });
        } else if (item && typeof item === 'object') {
          const engine = String(item.engine || item.name || 'unknown');
          const errorMsg = String(item.error || item.message || '');
          unresponsiveEngines.push({
            engine,
            error: errorMsg,
            type: classifyEngineError(errorMsg),
          });
        }
      }
    }

    console.log(
      `[SearXNG] Completed search for "${query}" in ${elapsed}ms. Results: ${results.length}, Unresponsive engines: ${unresponsiveEngines.length}`,
    );

    if (unresponsiveEngines.length > 0) {
      console.warn(
        `[SearXNG] Unresponsive engines for "${query}": ${unresponsiveEngines
          .map((e) => `${e.engine} (${e.type}): ${e.error}`)
          .join('; ')}`,
      );
    }

    return { results, suggestions, unresponsiveEngines };
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    if (err.name === 'AbortError') {
      console.error(
        `[SearXNG] Search timed out after ${timeoutMs}ms for query "${query}" (URL: ${url.origin})`,
      );
      throw new Error(`SearXNG search timed out after ${timeoutMs}ms`);
    }
    if (err.message && err.message.startsWith('SSRF Protection:')) {
      console.error(`[SearXNG] SSRF Protection triggered: ${err.message}`);
      throw err;
    }
    console.error(
      `[SearXNG] Search failed after ${elapsed}ms for query "${query}" (URL: ${url.origin}):`,
      err.message || err,
    );
    throw new Error(err.message || 'SearXNG search failed.');
  } finally {
    clearTimeout(timeoutId);
  }
};
