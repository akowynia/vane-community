import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { Mutex } from 'async-mutex';
import { validateUrlForSSRF } from './security/ssrf';
import { recordScrapeMetric } from './stats/tracker';

export interface ScrapeSuccessResult {
  content: string;
  title: string;
  error?: undefined;
  length: number;
  extractor: 'readability' | 'fallback_selectors' | 'fallback_paragraphs';
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
}

export type ScrapeResult = ScrapeSuccessResult | ScrapeErrorResult;

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

      // Krok 1: Próba ekstrakcji przez Readability na sklonowanym dokumencie (Readability modyfikuje DOM)
      try {
        const clonedDoc = dom.window.document.cloneNode(true) as Document;
        const readabilityParsed = new Readability(clonedDoc).parse();
        if (readabilityParsed?.textContent) {
          extractedText = readabilityParsed.textContent.trim();
        }
      } catch (readabilityErr) {
        console.warn(`[Scraper] Readability failed on ${url}:`, readabilityErr);
      }

      // Step 2: Fallback if Readability failed or the text is shorter than the minimum threshold
      if (extractedText.length < minLength) {
        const doc = dom.window.document;

        // Oczyszczenie DOM z elementów szumu
        const noiseElements = doc.querySelectorAll(
          'script, style, noscript, nav, footer, header, aside, form, svg, iframe, dialog, [aria-hidden="true"]',
        );
        noiseElements.forEach((el) => el.remove());

        // Fallback 1: Check semantic containers for the main content
        const mainCandidate = doc.querySelector(
          'article, main, [role="main"], #content, .content, #main, .main, .post-content, .article-content, .entry-content, .page-content',
        );

        const candidateText = mainCandidate?.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (candidateText.length >= minLength) {
          extractedText = candidateText;
          extractorMethod = 'fallback_selectors';
        } else {
          // Fallback 2: Zgromadzenie tekstu z paragrafów <p>
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

      // Check the minimum content length threshold
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
        };
      }

      // Successful content extraction
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
