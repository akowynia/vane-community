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
    | 'fast_fetch_paragraphs';
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

        return fastResult;
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
