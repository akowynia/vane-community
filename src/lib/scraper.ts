import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';
import { validateUrlForSSRF } from './security/ssrf';
import { recordScrapeMetric } from './stats/tracker';
import { PDFParse } from 'pdf-parse';
import { CanvasFactory } from 'pdf-parse/worker';

export interface ScrapeSuccessResult {
  content: string;
  title: string;
  error?: undefined;
  length: number;
  extractor:
    | 'readability'
    | 'fallback_selectors'
    | 'fallback_paragraphs'
    | 'fast_fetch_readability'
    | 'fast_fetch_pdf'
    | 'fast_fetch_selectors'
    | 'fast_fetch_paragraphs'
    | 'mcp_firecrawl'
    | 'mcp_crawl4ai'
    | string;
  attemptedMcp?: string;
  mcpError?: string;
}

export interface ScrapeErrorResult {
  content: null;
  title: string;
  error:
    | 'ssrf_blocked'
    | 'navigation_failed'
    | 'content_too_short'
    | 'empty_content'
    | 'extraction_failed'
    | string;
  length: number;
  extractor?: undefined;
  attemptedMcp?: string;
  mcpError?: string;
}

export type ScrapeResult = ScrapeSuccessResult | ScrapeErrorResult;

export const getScraperEngineLabel = (extractor?: string): string => {
  if (!extractor) return 'Built-in';
  if (extractor === 'mcp_firecrawl' || extractor.includes('firecrawl')) return 'Firecrawl (MCP)';
  if (extractor === 'mcp_crawl4ai' || extractor.includes('crawl4ai')) return 'Crawl4AI (MCP)';
  if (extractor.startsWith('mcp_')) {
    const raw = extractor.replace(/^mcp_/, '').replace(/_/g, ' ');
    return `${raw.charAt(0).toUpperCase() + raw.slice(1)} (MCP)`;
  }
  if (extractor.includes('pdf')) return 'PDF Parser';
  if (extractor.includes('readability')) return 'Readability';
  if (extractor.includes('selectors') || extractor.includes('paragraphs')) return 'Semantic Fallback';
  if (extractor.includes('fast_fetch')) return 'Fast Fetch';
  return 'Built-in';
};

export const isMcpExtractor = (extractor?: string): boolean => {
  return Boolean(extractor && (extractor.startsWith('mcp_') || extractor.includes('(MCP)')));
};

export interface ScrapeOptions {
  minLength?: number;
  chatId?: string;
  messageId?: string;
  userId?: string;
  optimizationMode?: string;
}

class Scraper {
  private static browser: any | undefined;
  public static DEFAULT_MIN_CONTENT_LENGTH = 200;
  private static IDLE_KILL_TIMEOUT = 30000;
  private static NAVIGATION_TIMEOUT = 20000;
  private static FAST_FETCH_TIMEOUT = 8000;
  private static idleTimeout: NodeJS.Timeout | undefined;
  private static browserMutex = new Mutex();
  private static userCount = 0;

  private static async initBrowser() {
    await this.browserMutex.runExclusive(async () => {
      if (!this.browser) {
        const { chromium } = await import('playwright');
        this.browser = await chromium.launch({
          headless: true,
          channel: 'chromium-headless-shell',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
          ],
        });
      }

      if (this.idleTimeout) clearTimeout(this.idleTimeout);
    });
  }

  private static scheduleIdleKill() {
    if (this.idleTimeout) clearTimeout(this.idleTimeout);

    this.idleTimeout = setTimeout(async () => {
      await this.browserMutex.runExclusive(async () => {
        if (this.browser && this.userCount === 0) {
          {
            await this.browser.close();
            this.browser = undefined;
          }
        }
      });
    }, this.IDLE_KILL_TIMEOUT);
  }

  /**
   * Tier 1 Fast Fetch: directly fetch HTML/PDF over HTTP and parse with Readability or PDFParse.
   * Runs in 100-300ms without spinning up a full Chromium instance.
   */
  private static async fastFetch(
    url: string,
    minLength: number,
  ): Promise<ScrapeSuccessResult | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FAST_FETCH_TIMEOUT);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      if (!res.ok) {
        return null;
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      const isPdf =
        contentType.includes('application/pdf') ||
        url.toLowerCase().split('?')[0].endsWith('.pdf');

      if (isPdf) {
        try {
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const parser = new PDFParse({
            data: buffer,
            CanvasFactory,
          });
          const pdfRes = await parser.getText();
          const pdfText = pdfRes?.text?.trim() || '';
          if (pdfText.length >= minLength) {
            const cleanTitle = url.split('/').pop()?.replace('.pdf', '') || 'PDF Document';
            const formattedContent = `# ${cleanTitle} - ${url}\n\n${pdfText}`;
            return {
              content: formattedContent,
              title: cleanTitle,
              length: pdfText.length,
              extractor: 'fast_fetch_pdf',
            };
          }
        } catch (pdfErr) {
          console.warn(`[Scraper] Fast fetch PDF parse error on ${url}:`, pdfErr);
        }
        return null;
      }

      if (
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml+xml') ||
        contentType.includes('text/plain')
      ) {
        const html = await res.text();
        if (!html || html.length < 100) return null;

        const dom = new JSDOM(html, { url });
        const rawTitle = dom.window.document.title?.trim() || 'No title';
        const title = rawTitle || 'No title';

        let extractedText = '';
        let extractorMethod:
          | 'fast_fetch_readability'
          | 'fast_fetch_selectors'
          | 'fast_fetch_paragraphs' = 'fast_fetch_readability';

        try {
          const clonedDoc = dom.window.document.cloneNode(true) as Document;
          const readabilityParsed = new Readability(clonedDoc).parse();
          if (readabilityParsed?.textContent) {
            extractedText = readabilityParsed.textContent.trim();
          }
        } catch (readabilityErr) {
          console.warn(`[Scraper] Fast fetch Readability failed on ${url}:`, readabilityErr);
        }

        if (extractedText.length < minLength) {
          const doc = dom.window.document;
          const noiseElements = doc.querySelectorAll(
            'script, style, noscript, nav, footer, header, aside, form, svg, iframe, dialog, [aria-hidden="true"]',
          );
          noiseElements.forEach((el) => el.remove());

          const mainCandidate = doc.querySelector(
            'article, main, [role="main"], #content, .content, #main, .main, .post-content, .article-content, .entry-content, .page-content',
          );
          const candidateText =
            mainCandidate?.textContent?.replace(/\s+/g, ' ').trim() || '';

          if (candidateText.length >= minLength) {
            extractedText = candidateText;
            extractorMethod = 'fast_fetch_selectors';
          } else {
            const paragraphs = Array.from(doc.querySelectorAll('p'))
              .map((p) => p.textContent?.replace(/\s+/g, ' ').trim() || '')
              .filter((t) => t.length >= 20);
            const combinedParagraphs = paragraphs.join('\n\n');
            if (combinedParagraphs.length >= minLength) {
              extractedText = combinedParagraphs;
              extractorMethod = 'fast_fetch_paragraphs';
            }
          }
        }

        if (extractedText.length >= minLength) {
          const formattedContent = `# ${title} - ${url}\n\n${extractedText}`;
          return {
            content: formattedContent,
            title,
            length: extractedText.length,
            extractor: extractorMethod,
          };
        }
      }

      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Find any enabled MCP server configured as a web scraper (e.g. Firecrawl or Crawl4AI)
   */
  public static async getActiveMcpScraperServer(): Promise<any | null> {
    try {
      const { default: mcpClientManager } = await import('./mcp/client');
      const servers = mcpClientManager.getServers().filter((s) => s.enabled);
      if (servers.length === 0) return null;

      return (
        servers.find((s) => {
          const lower = (s.name || '').toLowerCase();
          return (
            lower.includes('firecrawl') ||
            lower.includes('crawl4ai') ||
            lower.includes('scraper') ||
            lower.includes('crawler')
          );
        }) || null
      );
    } catch {
      return null;
    }
  }

  /**
   * Tier 0: Check if an enabled MCP server provides web scraping tools (e.g. Firecrawl or Crawl4AI).
   * If available, execute the tool and return the parsed markdown.
   */
  private static async tryMcpScrape(
    url: string,
    minLength: number,
    presetServer?: any,
  ): Promise<ScrapeSuccessResult | null> {
    try {
      const { default: mcpClientManager } = await import('./mcp/client');
      const servers = mcpClientManager.getServers().filter((s) => s.enabled);
      if (servers.length === 0) return null;

      const scraperServer =
        presetServer ||
        servers.find((s) => {
          const lower = (s.name || '').toLowerCase();
          return (
            lower.includes('firecrawl') ||
            lower.includes('crawl4ai') ||
            lower.includes('scraper') ||
            lower.includes('crawler')
          );
        });

      if (!scraperServer) return null;

      let targetServerId: string | undefined = scraperServer.id;
      let targetToolName: string | undefined;
      let serverName: string = scraperServer.name;

      const serverTools = await mcpClientManager.listServerTools(scraperServer);
      const scrapeTool =
        serverTools.find((t) => {
          const tName = (t.name || '').toLowerCase();
          return (
            tName.includes('scrape') ||
            tName.includes('crawl') ||
            tName.includes('extract')
          );
        }) || serverTools[0];

      if (scrapeTool) {
        targetToolName = scrapeTool.name;
      } else {
        const lower = (scraperServer.name || '').toLowerCase();
        if (lower.includes('firecrawl')) {
          targetToolName = 'firecrawl_scrape';
        } else if (lower.includes('crawl4ai')) {
          targetToolName = 'crawl4ai_scrape';
        }
      }

      if (!targetServerId || !targetToolName) return null;

      const lowerInfo = `${serverName} ${targetToolName}`.toLowerCase();
      const isFirecrawl = lowerInfo.includes('firecrawl');
      const isCrawl4Ai = lowerInfo.includes('crawl4ai');

      // Arguments compatible with Firecrawl and Crawl4AI
      const args: Record<string, any> = isFirecrawl
        ? { url, formats: ['markdown'] }
        : { url };

      const result = await mcpClientManager.callTool(
        targetServerId,
        targetToolName,
        args,
      );

      if (result.isError || !result.content || result.content.length === 0) {
        throw new Error(result.content?.[0]?.text || 'MCP scraping tool returned an error');
      }

      let rawText = result.content
        .map((c) => c.text || '')
        .filter(Boolean)
        .join('\n\n')
        .trim();

      if (!rawText) return null;

      // Handle cases where the tool returns a JSON string with markdown or content
      if (rawText.startsWith('{') && rawText.endsWith('}')) {
        try {
          const parsedJson = JSON.parse(rawText);
          if (typeof parsedJson.markdown === 'string') {
            rawText = parsedJson.markdown;
          } else if (typeof parsedJson.content === 'string') {
            rawText = parsedJson.content;
          } else if (typeof parsedJson.text === 'string') {
            rawText = parsedJson.text;
          } else if (parsedJson.data && typeof parsedJson.data.markdown === 'string') {
            rawText = parsedJson.data.markdown;
          }
        } catch {
          // Keep rawText as is
        }
      }

      if (rawText.length < minLength) {
        return null;
      }

      let title = 'Webpage';
      const headingMatch = rawText.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      } else {
        try {
          title = new URL(url).hostname;
        } catch {}
      }

      const extractor = isFirecrawl
        ? 'mcp_firecrawl'
        : isCrawl4Ai
          ? 'mcp_crawl4ai'
          : `mcp_${serverName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

      const formattedContent = rawText.startsWith('#')
        ? rawText
        : `# ${title} - ${url}\n\n${rawText}`;

      return {
        content: formattedContent,
        title,
        length: rawText.length,
        extractor: extractor as any,
      };
    } catch (err: any) {
      console.warn(`[Scraper] MCP scraping delegation failed on ${url}:`, err?.message || err);
      throw err;
    }
  }

  static async scrape(
    url: string,
    options?: ScrapeOptions,
  ): Promise<ScrapeResult> {
    const startTime = Date.now();
    const minLength = options?.minLength ?? this.DEFAULT_MIN_CONTENT_LENGTH;

    // SSRF pre-check: ensure the target URL is valid and does not point to internal/private resources
    const ssrfCheck = await validateUrlForSSRF(url);
    if (!ssrfCheck.valid) {
      const reason = ssrfCheck.reason || 'SSRF policy violation';
      console.warn(`[Scraper] SSRF blocked for URL "${url}": ${reason}`);

      const durationMs = Date.now() - startTime;
      await recordScrapeMetric({
        url,
        status: 'error',
        errorReason: `ssrf_blocked: ${reason}`,
        durationMs,
        contentLength: 0,
        chatId: options?.chatId,
        messageId: options?.messageId,
        userId: options?.userId,
        optimizationMode: options?.optimizationMode,
      });

      return {
        content: null,
        title: 'Blocked by Security Policy',
        error: 'ssrf_blocked',
        length: 0,
      };
    }

    let attemptedMcp: string | undefined;
    let mcpError: string | undefined;

    // Step 0: Check if an active MCP Scraper (Firecrawl / Crawl4AI) is configured and enabled
    try {
      const activeMcpServer = await this.getActiveMcpScraperServer();
      if (activeMcpServer) {
        attemptedMcp = activeMcpServer.name.includes('(MCP)') ? activeMcpServer.name : `${activeMcpServer.name} (MCP)`;
        const mcpResult = await this.tryMcpScrape(url, minLength, activeMcpServer);
        if (mcpResult) {
          const durationMs = Date.now() - startTime;
          await recordScrapeMetric({
            url,
            status: 'success',
            durationMs,
            contentLength: mcpResult.length,
            extractor: mcpResult.extractor,
            chatId: options?.chatId,
            messageId: options?.messageId,
            userId: options?.userId,
            optimizationMode: options?.optimizationMode,
          });

          return {
            ...mcpResult,
            attemptedMcp,
          };
        }
      }
    } catch (mcpErr: any) {
      mcpError = mcpErr?.message || String(mcpErr);
      console.warn(
        `[Scraper] MCP scrape error on ${url}, falling back to fast fetch:`,
        mcpErr,
      );
    }

    // Step 1: Attempt Tier 1 Fast Fetch (HTTP + Readability/PDF)
    try {
      const fastResult = await this.fastFetch(url, minLength);
      if (fastResult) {
        const durationMs = Date.now() - startTime;
        await recordScrapeMetric({
          url,
          status: 'success',
          durationMs,
          contentLength: fastResult.length,
          extractor: fastResult.extractor,
          chatId: options?.chatId,
          messageId: options?.messageId,
          userId: options?.userId,
          optimizationMode: options?.optimizationMode,
        });

        return {
          ...fastResult,
          attemptedMcp,
          mcpError,
        };
      }
    } catch (fastErr) {
      console.warn(`[Scraper] Fast fetch unexpected error for ${url}, falling back to browser:`, fastErr);
    }

    // Step 2: Fallback to Tier 2 Headless Browser (Playwright) for JavaScript SPAs or protected pages
    await this.initBrowser();

    if (!this.browser) throw new Error('Browser not initialized');

    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    // Intercept all network requests to prevent SSRF via redirects or embedded resources
    await page.route('**', async (route: any) => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith('data:') || requestUrl === 'about:blank') {
        return route.continue();
      }
      const check = await validateUrlForSSRF(requestUrl);
      if (!check.valid) {
        console.warn(`[Scraper] Route aborted due to SSRF policy: ${requestUrl} (${check.reason})`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });

    this.userCount++;

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.NAVIGATION_TIMEOUT,
      });

      await page
        .waitForLoadState('load', { timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(500);

      const html = await page.content();
      const rawTitle = await page.title().catch(() => '');
      const title = rawTitle?.trim() || 'No title';

      const dom = new JSDOM(html, {
        url,
      });

      let extractedText = '';
      let extractorMethod: 'readability' | 'fallback_selectors' | 'fallback_paragraphs' = 'readability';

      // Step 1: Extract via Readability on cloned document
      try {
        const clonedDoc = dom.window.document.cloneNode(true) as Document;
        const readabilityParsed = new Readability(clonedDoc).parse();
        if (readabilityParsed?.textContent) {
          extractedText = readabilityParsed.textContent.trim();
        }
      } catch (readabilityErr) {
        console.warn(`[Scraper] Readability failed on ${url}:`, readabilityErr);
      }

      // Step 2: Fallback if Readability failed or text is shorter than threshold
      if (extractedText.length < minLength) {
        const doc = dom.window.document;

        // Clean DOM noise
        const noiseElements = doc.querySelectorAll(
          'script, style, noscript, nav, footer, header, aside, form, svg, iframe, dialog, [aria-hidden="true"]',
        );
        noiseElements.forEach((el) => el.remove());

        // Fallback 1: Semantic main containers
        const mainCandidate = doc.querySelector(
          'article, main, [role="main"], #content, .content, #main, .main, .post-content, .article-content, .entry-content, .page-content',
        );

        const candidateText = mainCandidate?.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (candidateText.length >= minLength) {
          extractedText = candidateText;
          extractorMethod = 'fallback_selectors';
        } else {
          // Fallback 2: Paragraph text accumulation
          const paragraphs = Array.from(doc.querySelectorAll('p'))
            .map((p) => p.textContent?.replace(/\s+/g, ' ').trim() || '')
            .filter((t) => t.length >= 20);

          const combinedParagraphs = paragraphs.join('\n\n');
          if (combinedParagraphs.length >= minLength) {
            extractedText = combinedParagraphs;
            extractorMethod = 'fallback_paragraphs';
          }
        }
      }

      const durationMs = Date.now() - startTime;

      // Check threshold
      if (extractedText.length < minLength) {
        const errorType = extractedText.length === 0 ? 'empty_content' : 'content_too_short';
        const errorReason = `${errorType}: extracted ${extractedText.length} chars (min ${minLength})`;
        console.warn(`[Scraper] Extraction failed for ${url}: ${errorReason}`);

        await recordScrapeMetric({
          url,
          status: 'error',
          errorReason,
          durationMs,
          contentLength: extractedText.length,
          extractor: extractorMethod,
          chatId: options?.chatId,
          messageId: options?.messageId,
          userId: options?.userId,
          optimizationMode: options?.optimizationMode,
        });

        return {
          content: null,
          title,
          error: errorType,
          length: extractedText.length,
          attemptedMcp,
          mcpError,
        };
      }

      // Successful browser extraction
      const formattedContent = `# ${title} - ${url}\n\n${extractedText}`;

      await recordScrapeMetric({
        url,
        status: 'success',
        durationMs,
        contentLength: extractedText.length,
        extractor: extractorMethod,
        chatId: options?.chatId,
        messageId: options?.messageId,
        userId: options?.userId,
        optimizationMode: options?.optimizationMode,
      });

      return {
        content: formattedContent,
        title,
        length: extractedText.length,
        extractor: extractorMethod,
        attemptedMcp,
        mcpError,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorReason = `navigation_failed: ${err?.message || err}`;
      console.error(`[Scraper] Error scraping ${url}:`, err);

      await recordScrapeMetric({
        url,
        status: 'error',
        errorReason,
        durationMs,
        contentLength: 0,
        chatId: options?.chatId,
        messageId: options?.messageId,
        userId: options?.userId,
        optimizationMode: options?.optimizationMode,
      });

      return {
        content: null,
        title: 'Failed to scrape',
        error: 'navigation_failed',
        length: 0,
        attemptedMcp,
        mcpError,
      };
    } finally {
      this.userCount--;

      await context.close().catch(() => undefined);

      if (this.userCount === 0) {
        this.scheduleIdleKill();
      }
    }
  }
}

export default Scraper;
