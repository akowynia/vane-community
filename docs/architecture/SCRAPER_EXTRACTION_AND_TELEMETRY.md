# Content Extraction Resilience (Scraper, Readability Fallback, and Telemetry)

## 1. Concept and Goals

Extracting content from web pages is a key part of Deep Research (**Quality Mode**) and the `scrape_url` tool. The previous implementation fetched HTML using the **Playwright** engine and fed it directly to the `@mozilla/readability` parser. For single-page apps (SPAs), blocked pages, empty pages, or unusual HTML layouts, Readability would return an empty object or a negligibly short text, which was then passed to the LLM with a `"No content available"` placeholder.

The architecture introduced here solves these problems through:
1. **A minimum content-length threshold (`MIN_CONTENT_LENGTH = 200` characters)**: eliminating empty or junk excerpts.
2. **A cascading fallback for Readability**: smart semantic selectors and paragraph aggregation when the Mozilla Readability parser fails.
3. **An explicit error contract (`ScrapeResult`)**: failed sources are skipped early in the pipeline (`executeSearch`, `scrapeURLAction`) without wasting tokens or causing LLM hallucinations.
4. **Telemetry and Audit Log integration (`model_stats`)**: every scrape is recorded, broken down by domain, duration, extraction method used, and diagnostic error codes.

---

## 2. Architecture of the `Scraper` Module (`src/lib/scraper.ts`)

### Types and Contract
```typescript
export type ScrapeResult =
  | {
      content: string;
      title: string;
      error?: undefined;
      length: number;
      extractor: 'readability' | 'fallback_selectors' | 'fallback_paragraphs';
    }
  | {
      content: null;
      title: string;
      error: 'ssrf_blocked' | 'navigation_failed' | 'content_too_short' | 'empty_content' | 'extraction_failed' | string;
      length: number;
    };
```

### Cascading Extraction Flow
1. **SSRF validation (`validateUrlForSSRF`)**:
   - Checks that the protocol is valid (`http:`, `https:`) and blocks private IPs/hosts, loopback addresses, and cloud metadata endpoints (AWS, GCP, Azure, DigitalOcean).
   - If blocked, immediately returns `error: 'ssrf_blocked'` and records a metric.
2. **Navigation with Playwright (`Chromium Headless`)**:
   - `page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })` + `waitForLoadState('load')`.
   - Fetches the rendered HTML (`page.content()`).
3. **Step 1: `@mozilla/readability` parser**:
   - Run on a cloned DOM document (Readability mutates the tree, so cloning protects the structure for the following steps).
4. **Step 2: Noise cleanup and semantic fallback**:
   - If the extracted text is shorter than 200 characters, noise tags are stripped: `script`, `style`, `noscript`, `nav`, `footer`, `header`, `aside`, `form`, `svg`, `iframe`, `dialog`, `[aria-hidden="true"]`.
   - Semantic containers are searched for: `article`, `main`, `[role="main"]`, `#content`, `.content`, `.post-content`, `.article-content`, `.entry-content`, `.page-content`.
5. **Step 3: Paragraph fallback**:
   - If the semantic selectors still don't meet the length threshold, text is gathered from all `<p>` tags that are `>= 20` characters long.
6. **Step 4: Threshold check and result validation**:
   - If, after all attempts, the text is still `< 200` characters, an explicit error is returned: `{ content: null, title, error: 'content_too_short' | 'empty_content', length }`.
   - On success, formatted Markdown text is returned along with metadata.

---

## 3. Integration with the Research Pipeline

### `baseSearch.ts` (Quality Mode)
In the search-results scraping loop:
```typescript
const scrapedData = await Scraper.scrape(result.metadata.url, { optimizationMode: 'quality' });
if (!scrapedData || scrapedData.error || !scrapedData.content) {
  console.warn(`[baseSearch] Skipping ${result.metadata.url} due to extraction failure: ${scrapedData?.error || 'no_data'}`);
  continue;
}
```
Sources with a failed extraction are skipped immediately, preventing empty data from being passed to the model and saving the token budget.

### `scrapeURL.ts` (the `scrape_url` action)
When a user requests analysis of a specific URL, if extraction fails the system returns a precise message explaining the reason (e.g. content too short, or anti-bot protection), instead of trying to extract facts from the error text.

---

## 4. Domain Telemetry and Audit Log (`src/lib/stats/tracker.ts`)

Every scrape event is persisted in the `model_stats` table:
- `step`: `'scraper'`
- `providerId`: the target domain (e.g. `en.wikipedia.org`, `github.com`)
- `modelKey`: the extraction method used (`'readability'`, `'fallback_selectors'`, `'fallback_paragraphs'`)
- `query`: the full URL
- `status`: `'success'` or `'error'`
- `errorMessage`: the error code and reason (e.g. `content_too_short: extracted 42 chars (min 200)`)
- `durationMs`: total loading and parsing time

In the statistics panel, administrators have access to:
- The scraping success rate.
- A list of the domains that fail most often, with exact error codes.
- Dedicated filtering in the **Technical Request Log (Audit Log)** view, by domain keywords and pipeline step.
