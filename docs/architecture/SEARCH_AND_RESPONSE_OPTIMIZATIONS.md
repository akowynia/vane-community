# Search & Response Pipeline Optimizations

## 1. Overview and Motivation

This document details the 3-phase optimization architecture introduced to substantially improve search speed, contextual depth across all search modes (`speed`, `balanced`, `quality`), prompt intent alignment, multilingual consistency, and citation accuracy in Vane-Community.

---

## 2. Multi-tier Scraping Engine (`Scraper.ts`)

### Problem
Previously, any web page scraping invoked a full Chromium headless instance via Playwright. Spawning browser instances for static websites introduced high RAM/CPU overhead and added 2–6 seconds of latency per page. Furthermore, PDF document links on the web could not be parsed and failed with `content_too_short` or `empty_content`.

### Solution: Two-tier Extraction Strategy
1. **Tier 1 (Fast HTTP Fetch + Readability / PDF)**:
   - Direct HTTP GET with browser-like headers (`User-Agent`, `Accept`, `Accept-Language`, `Sec-Fetch-*`) and a strict 8-second timeout.
   - Validates destination against SSRF policies.
   - If the response is a PDF (`application/pdf` or `.pdf` extension), the binary buffer is parsed directly using `pdf-parse` (`PDFParse` + `CanvasFactory`).
   - If the response is HTML, it is parsed into a DOM via `JSDOM` and processed by `@mozilla/readability`. If readability fails, fallback selectors (`article`, `main`, `#content`, `.post-content`, `<p>`) are evaluated.
   - If extracted text meets `minLength`, the result is returned in **100–300 ms** with extractor label `fast_fetch_readability`, `fast_fetch_pdf`, or `fast_fetch_selectors`.
2. **Tier 2 (Headless Browser Fallback)**:
   - If Fast Fetch fails, times out, or returns empty content (e.g. JavaScript-rendered SPAs, complex protections), execution seamlessly falls back to the Playwright Chromium instance.

---

## 3. Hybrid Search Ranking & Balanced Mode Enhancement (`baseSearch.ts`)

### A. Reciprocal Rank Fusion (RRF) & Hybrid Relevance
Rather than relying solely on cosine similarity thresholding (which varies widely depending on the chosen embedding model) or pure lexical rank:
- **SearXNG Rank Score**: $Score_{\text{rank}} = \frac{1}{60 + (\text{rank} + 1)}$
- **Vector Cosine Similarity**: $Score_{\text{vector}} = \max(0, \text{cosineSim}(\mathbf{q}, \mathbf{d}))$
- **Hybrid Score**: $Score_{\text{hybrid}} = (Score_{\text{rank}} \times 30) + (Score_{\text{vector}} \times 0.5)$

Results with strong semantic similarity, high hybrid score, or top lexical ranks are retained, ensuring exact keyword matches (error codes, product numbers) are preserved alongside semantic matches.

### B. Lightweight Balanced Scraping
In `balanced` mode, the top 2 unique search results are automatically enriched via Tier 1 Fast Fetch (without running heavy LLM picker or extractor calls). This provides full article bodies (up to 2,500 characters) to the synthesis model instead of brief 150-character search snippets.

### C. Domain Diversity Capping
During deduplication in both Speed/Balanced and Quality modes, results from the same root domain are capped (max 2 per domain in Speed, max 3 in Balanced/Quality) to prevent a single website from saturating the search findings.

---

## 4. Response Synthesis, Context Budgeting & Grounding (`writer.ts` & `index.ts`)

### A. Adaptive Prompting & Intent Alignment (`writer.ts`)
The synthesis system prompt now dynamically formats answers based on user intent:
- **Strict Language Matching**: The model must write exclusively in the language of the user's query (including all headings, conclusions, lists, and tables), preventing English leakage on multilingual setups.
- **Direct Answer First**: Factual/definitional queries immediately provide a 1–2 sentence direct answer/thesis before delving into detailed sections.
- **Structured Comparison Tables**: Queries comparing items ("X vs Y", product comparisons) automatically generate side-by-side Markdown comparison tables with parameters, trade-offs, and verdicts.
- **Step-by-step Procedures**: Instructional queries produce numbered, actionable steps with bold titles and prerequisites.
- **Technical/Code**: Complete, syntax-highlighted code blocks are positioned prominently.

### B. Per-domain Context Budget (`index.ts`)
When assembling `<search_results>` (up to 12,000 tokens), a per-domain token cap (max 2,000 tokens per unique domain) ensures that long articles from one source do not displace diverse findings from other sources.

### C. Citation Verification & Hallucination Sanitization (`index.ts`)
After stream completion, the generated answer is scanned for inline citations `[X]`. If any index $X > N$ (where $N$ is the total count of available sources) or $X \le 0$ is found, the invalid reference is stripped to maintain grounding and source credibility.

---

## 5. Flow Diagram

```mermaid
flowchart TD
    A[User Query] --> B[Classifier: skipSearch / widgets / standalone]
    B --> C[Researcher: Speed / Balanced / Quality]
    C --> D[SearXNG Multi-engine Query]
    D --> E[Compute Embeddings & RRF Hybrid Ranking]
    E --> F[Deduplicate & Domain Diversity Cap]
    
    F --> G{Mode?}
    G -- Balanced --> H[Tier 1 Fast Fetch: Top 2 URLs]
    G -- Quality --> I[LLM Picker -> Fast Fetch/Playwright -> LLM Extractor]
    G -- Speed --> J[Keep Ranked Snippets]
    
    H --> K[Pack Context with Per-Domain Budget max 2000 tokens/domain]
    I --> K
    J --> K
    
    K --> L[Writer: Adaptive Intent Prompt + Strict Language Matching]
    L --> M[Stream Response to UI]
    M --> N[Post-processing: Sanitize Citations [X] <= N]
    N --> O[Save Message to DB]
```

---

## 6. Response Quality & Interactive Grounding Enhancements

To maximize the clarity, reliability, and analytical value of responses, 7 key quality mechanisms have been integrated across the pipeline:

### 1. Exact Quote Tooltips & Bidirectional Highlighting
- **Mechanism**: Hovering over inline citation badges `[n]` in chat messages reveals an interactive tooltip displaying the source title, domain, publication date, and an exact excerpt from the source text.
- **Bidirectional Linking**: Hovering over `[n]` simultaneously highlights the corresponding source card in the `MessageSources` panel. Conversely, hovering over any card in the sources panel highlights all associated `[n]` citations across the answer.

### 2. Client-Side Mermaid Diagrams
- **Renderer**: `MermaidBlock.tsx` provides client-side SVG diagram rendering supporting light and dark themes, interactive copy-to-clipboard, and graceful fallback to syntax-highlighted code on syntax warnings.
- **Prompt Directive**: Instructs the synthesis model to generate ````mermaid ```` blocks (e.g. `flowchart TD/LR`, `sequenceDiagram`, `stateDiagram-v2`) when explaining system architectures, workflows, algorithms, or lifecycles.

### 3. GitHub-Style Alert Callouts
- **Component**: `CalloutBlock.tsx` detects GitHub-style callout headers (`[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`) in blockquotes and renders them as styled callout cards with contextual Lucide icons and theme-adapted color palettes.

### 4. Executive Summary Card ("W Pigułce")
- **Prompt Directive**: Prior to detailed thematic analysis, the synthesis model starts with a direct 1–2 sentence answer followed by a 3-point takeaway summary ("W pigułce" / Key Takeaways) highlighting the core parameters.

### 5. Temporal Anchoring & Recency Weighting
- **Pipeline**: Publication dates (`publishedDate`) extracted from SearXNG search engines are embedded directly into the context XML (`<result index=1 title="..." date="2025-01-15">`).
- **Prompt Directive**: Directs the synthesis model to prioritize newer sources for fast-moving subjects (tech models, financial news, legal updates) and anchor findings with explicit dates/years in the narrative.

### 6. Factual Contradiction Detection
- **Prompt Directive**: When authoritative sources present conflicting factual claims (e.g. differing benchmark scores, opposing release dates, contradictory empirical results), the model is instructed to explicitly call out the discrepancy (e.g. using a `[!WARNING]` block) and cite both opposing sources rather than guessing or smoothing over the conflict.

### 7. Consolidated Domain Authority in RRF Hybrid Ranking
- **Formula**: Domain credibility multipliers are consolidated directly into the RRF ranking formula:
  $$Multiplier_{\text{authority}} = \begin{cases} 1.25 & \text{for } .gov, .edu, arxiv.org, ncbi.nlm.nih.gov, nature.com, sciencedirect.com, github.com, \text{official docs} \\ 1.10 & \text{for } wikipedia.org, reuters.com, bbc.com, bloomberg.com, nytimes.com, techcrunch.com \\ 0.95 & \text{for } reddit.com, twitter.com, x.com, quora.com, facebook.com, pinterest.com, medium.com \\ 1.00 & \text{otherwise} \end{cases}$$
  $$Score_{\text{hybrid}} = \left( \frac{30}{60 + (\text{rank} + 1)} + 0.5 \times \max(0, \text{vectorSim}) \right) \times Multiplier_{\text{authority}}$$

---

### 8. Dedicated Token Limit Warning Box (UI Native Component)
- **UI Card**: When the search or research budget limit is reached, a dedicated warning card (`AlertTriangle`, explanation message, and "Configure Limits" button) is rendered directly below the research progress block (`AssistantSteps`).
- **Clean Response Stream**: The synthesis model focuses purely on generating the best possible answer from gathered sources without polluting the Markdown response text with budget disclosure disclaimers.

---

### 9. Unified PDF Export & Print Engine (`printExport.ts`)
- **Citation Extraction & Linking**: Robust attribute-agnostic regex extracts `<citation href="..." title="..." source-index="..." snippet="..." date="...">NUM</citation>` into interactive superscript reference badges `[NUM]` linking directly to source URLs.
- **Markdown Tables**: Semantic `<table>` rendering with column alignment (`:---`, `:---:`, `---:`), headers, zebra striping, and page-break avoidance.
- **GitHub-style Alert Callouts**: Renders `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]` with vector SVG icons, accent borders, and dedicated badges.
- **Client-side Mermaid Rendering**: Asynchronously converts ````mermaid ```` code blocks into vector SVG diagrams prior to print execution.
- **Structured Typography & Print CSS**: Full support for headings (H1–H6), nested ordered/unordered lists, task checkboxes, pre-wrapped code blocks, A4 margins, orphan/widow suppression, and elimination of page-splitting outer card borders and shadows.

---

## 7. Modified Files Summary

| File | Changes |
| :--- | :--- |
| `scraper.ts` | Added Tier 1 Fast Fetch (HTTP + Readability + `pdf-parse`) before Playwright fallback. |
| `searxng.ts` | Added `publishedDate`, `pubdate`, `published_date` to `SearxngSearchResult`. |
| `writer.ts` | Added Mermaid, Callouts, Executive Summary ("W pigułce"), Temporal Anchoring, Contradiction Detection, strict language matching, and removed token limit text pollution. |
| `baseSearch.ts` | Implemented RRF hybrid ranking with domain authority multiplier, domain capping, and lightweight balanced scraping. |
| `index.ts` | Added `date="..."` XML attributes, per-domain context token budgeting, and citation index verification/sanitization. |
| `MermaidBlock.tsx` | Client-side dynamic SVG rendering for Mermaid diagrams with light/dark theme support. |
| `CodeBlock/index.tsx` | Routed `mermaid` code language blocks directly to `MermaidBlock`. |
| `CalloutBlock.tsx` | GitHub-style alert callouts with Lucide icons for `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!CAUTION]`. |
| `Citation.tsx` | Exact Quote Tooltips with `@radix-ui/react-tooltip` and bidirectional hover state. |
| `MessageSources.tsx` | Bidirectional highlight linking and hover callbacks. |
| `MessageBox.tsx` | Linked `hoveredSourceIndex` state, registered `CalloutBlock`, and added dedicated token limit alert card below research progress. |
| `printExport.ts` | Unified Markdown to Print HTML engine with tables, callouts, Mermaid diagrams, citations, and `@media print` styling. |
| `Navbar.tsx` | Switched chat PDF/Print export to the unified engine and fixed citation normalization in Markdown export. |
| `ScratchpadExportDialog.tsx` | Connected Scratchpad note PDF/Print export to the unified engine with full table, callout, and citation support. |
