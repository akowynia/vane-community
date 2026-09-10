# Vane Security Architecture

This document describes the security architecture of the Vane (Vane-Community) application, with particular focus on protecting AI provider credentials, preventing SSRF attacks, validating configuration parameters, and the middleware authentication layer.

---

## 1. Authentication Middleware and API Protection (`src/proxy.ts`, formerly `src/middleware.ts`)

### Architectural Solution
1. **API Endpoint Protection and Timing-Attack Resistance**:
   - The Next.js middleware intercepts every request to `/api/*`.
   - It reads the `API_KEY`, `AUTH_SECRET`, and `VANE_API_KEY` environment variables.
   - Key verification uses the `constantTimeCompare` function (a constant-time comparison based on bitwise XOR `^`), which eliminates susceptibility to cryptanalytic timing attacks (side-channel timing attacks).
   - When a key is configured in the environment, every API request must carry a valid token via one of:
     - the `Authorization: Bearer <key>` header
     - the `x-api-key: <key>` header
     - the `vane_api_key` session cookie
   - Missing valid credentials results in an immediate `401 Unauthorized` response.

2. **Write Lock in Open Mode**:
   - When the application is started without a configured `API_KEY` variable (the default local startup):
     - On the first request, a `console.warn` warning is emitted in the server logs, reminding the administrator to secure the instance.
     - The administrative and configuration endpoints (`/api/config*`, `/api/providers*`) **block every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) with a `403 Forbidden` status**.
     - Reads (`GET`) and local chat/search queries remain active.
     - Defining an `API_KEY` in the `.env` file or the environment is required to unlock configuration changes and adding model providers.

3. **Cross-Site Request Forgery (CSRF) Prevention (`isSafeOrigin`)**:
   - Requests that mutate application state (`POST`, `PUT`, `PATCH`, `DELETE`) coming from web browsers are checked for consistency between the `Origin`/`Referer` headers and the `Host` header.
   - Per the W3C Fetch API standard, browsers always attach an `Origin: <domain>` header on cross-origin requests. Requests from foreign domains are rejected with a `403 Forbidden` status.
   - Direct, non-browser requests (with no `Origin` or `Referer`) are protected by the `API_KEY` authorization layer and the write lock.

4. **HTTP Security Headers**:
   - Every server response carries a set of protective headers:
     - `X-Content-Type-Options: nosniff` (blocks MIME type sniffing)
     - `X-Frame-Options: SAMEORIGIN` (protects against clickjacking)
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `X-XSS-Protection: 1; mode=block`

---

## 2. Protecting API Keys and Confidential Data

### Architectural Problem (before the fix)
In earlier versions, the AI model provider configuration (OpenAI, Anthropic, Gemini, Groq, Lemonade, etc.) was sent to the client's browser in full, via the `GET /api/config` endpoint and the `POST /api/providers` and `PATCH /api/providers/[id]` responses. If an instance was deployed publicly on the internet, any visitor could extract live API keys.

### Architectural Solution Applied
1. **Server-Side Proxy Model**:
   - Every request to an AI model (both LLM and embedding calls) is executed exclusively on the Node.js server side (`/api/chat`, `/api/search`, `/api/suggestions`, `/api/images`, `/api/videos`).
   - The client's browser only sends the provider identifier (`providerId`) and the model key (`key`), never raw credentials.
2. **Credential Masking in API Responses**:
   - The `configManager.getSanitizedConfig()` method replaces every confidential field (`type === 'password'`, `apiKey`, `secret`, `token`, `password`, `credentials`, `auth`) with a safe `••••••••` mask.
   - The `/api/config`, `POST /api/providers`, and `PATCH /api/providers/[id]` endpoints return only masked configuration objects.
3. **Safe Updates (Secret Preservation)**:
   - When a connection is edited in the UI (`UpdateProviderDialog`), if the user does not change the value of a masked field (the value `••••••••`), the server's `ConfigManager.updateModelProvider` automatically preserves the existing key already stored in `config.json`.
4. **UI Masking**:
   - Form fields marked as `password` render as `<input type="password" />`, preventing the key from being visible on screen.

---

## 3. Protection Against Server-Side Request Forgery (SSRF)

### Attack Vectors
The application communicates with external and local services (Web Search & Scraper, the `scrape_url` agent tool, AI model backends, SearXNG instances). Without proper protection, an attacker could:
- Use prompt injection or a crafted user query in `/api/search` / `/api/chat` to trick the LLM into invoking the `scrape_url` tool against internal endpoints (e.g. `http://127.0.0.1:3001/api/discover`).
- Gain access to cloud metadata services (e.g. `http://169.254.169.254/latest/meta-data/` on AWS/GCP/Azure, `http://100.100.100.200/` on Alibaba Cloud) and exfiltrate IAM/instance role tokens.
- Scan and query the server's local network / Docker containers / Kubernetes clusters (`127.0.0.1`, `localhost`, `host.docker.internal`, `kubernetes.default`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Read local server files via schemes like `file:///`, `gopher:///`, etc.

### Layered Protection Mechanisms Applied (Defense-in-Depth)

1. **Search Agent Action Layer (`scrapeURL.ts`, `baseSearch.ts`)**:
   - Every URL passed in is directly validated by `validateUrlForSSRF` before the Playwright scraper is launched.
   - If a blocked address is detected, the action immediately returns a policy-error result without launching the browser, without emitting fake "reading" steps, and without passing any data into the LLM's fact-extraction prompt.

2. **Protocol and URL-structure Validation (`src/lib/security/ssrf.ts`)**:
   - Only the `http:` and `https:` protocols are allowed.
   - Dangerous schemes are blocked: `file:`, `gopher:`, `dict:`, `ftp:`, `data:`, `javascript:`, `blob:`, `ldap:`.
   - URLs containing embedded credentials (`user:pass@host`) are rejected.
   - Normalization strips trailing FQDN dots (`replace(/\.+$/, '')`), preventing bypass via something like `http://localhost./`.

3. **Blocking Local Hostnames, Internal Domains, and Metadata Services**:
   - Unconditionally blocked: `localhost`, `ip6-localhost`, `metadata.google.internal`, `metadata.internal`, `instance-data`, `instance-data.ec2.internal`, `metadata`, `host.docker.internal`, `gateway.docker.internal`, `kubernetes.default`, `kubernetes.default.svc`, `kubernetes.default.svc.cluster.local`.
   - Domain suffixes blocked: `.localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, `.corp`, `.home`, `.intranet`, `.test`, `.example`, `.invalid`, `.cluster.local`, `.svc`.
   - Unqualified (single-label) hostnames with no dot are blocked (e.g. `http://metadata/`, `http://admin/`, `http://router/`).

4. **DNS Resolution and Rigorous IP Address Verification**:
   - Every hostname is resolved via DNS (`dns.promises.lookup`, for all records).
   - If any returned IP address falls within a private, loopback, or reserved range, the request is immediately rejected:
     - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (including Alibaba's `100.100.100.200`), `127.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.0.0.0/24`, `192.0.2.0/24`, `192.168.0.0/16`, `198.18.0.0/15`, `198.51.100.0/24`, `203.0.113.0/24`, `224.0.0.0/4`, `240.0.0.0/4`, `255.255.255.255/32`.
     - IPv6: `::1/128`, `::/128`, `fc00::/7` (including AWS IMDSv6's `fd00:ec2::254`), `fe80::/10`, `ff00::/8`, `2001:db8::/32`, `2001:10::/28`, `2001:20::/28`, `2002::/16`, `64:ff9b::/96`, `64:ff9b:1::/48`, `::ffff:0:0/96` (IPv4-mapped IPv6).

5. **Request Interception in Playwright (`page.route` in `src/lib/scraper.ts`)**:
   - Every network request initiated by the browser engine (including HTTP 301/302 redirects, external scripts, and XHR/fetch) is checked against the SSRF filter.
   - Requests to forbidden addresses are immediately aborted (`route.abort('blockedbyclient')`).
   - Safe internal rendering protocols (`data:`, `about:blank`) are allowed through for document rendering.

6. **`baseURL` Validation for AI Providers (`validateProviderBaseURL`)**:
   - For cloud providers (OpenAI, Anthropic, Gemini, Groq, Lemonade), a publicly reachable IP address is required, with no ability to query private subnets.
   - For local providers (Ollama, LMStudio), communication with `localhost`, `127.0.0.1`, `host.docker.internal`, and the LAN is allowed, while cloud metadata addresses and dangerous schemes remain unconditionally blocked.
   - Requests that fetch the model list carry a timeout (`signal: AbortSignal.timeout(5000)`), protecting the server against hung connections (DoS).

---

## 4. Validation and Protection of the `/api/config` Endpoint and the SearXNG Instance

### The Second-Order SSRF Vulnerability
In the original architecture, the `POST /api/config` endpoint allowed the `search.searxngURL` parameter to be changed to a cloud metadata service address (e.g. `http://169.254.169.254`) or to internal server ports. Calls to dependent endpoints (e.g. `GET /api/discover`, the image/video search agents, `src/lib/searxng.ts`) would then query that stored address, resulting in a second-order SSRF.

### Remediation Mechanisms Implemented
1. **Asynchronous `validateSearxngURL` Validation in `ConfigManager.updateConfig`**:
   - Only the `http:` and `https:` protocols are allowed.
   - Credentials embedded in the URL (`user:pass@host`) are rejected.
   - Cloud metadata domains and IP addresses are unconditionally blocked (AWS, GCP, Azure, Alibaba's `100.100.100.200`, `169.254.169.254`, `fe80::`), including after DNS resolution (protecting against DNS rebinding).
2. **Defense-in-Depth Layer in `searchSearxng` (`src/lib/searxng.ts`)**:
   - Before every `fetch` request is initiated, the SearXNG URL is re-verified by `validateSearxngURL`.
   - Safe JSON response parsing was implemented, with format-error handling that prevents raw response data from leaking.
3. **Key Allowlist and Type Validation in `/api/config`**:
   - Only explicitly defined UI parameters may be updated:
     - `preferences.theme`: only `'light'` and `'dark'` are allowed.
     - `preferences.language`: only the defined language codes are allowed (`en`, `pl`, `es`, `de`, `fr`, `it`, `pt`, `ru`, `uk`, `zh`, `ja`, `ko`).
     - `preferences.measureUnit`: only `'Metric'` and `'Imperial'` are allowed.
     - `preferences.autoMediaSearch`, `preferences.showWeatherWidget`, `preferences.showNewsWidget`: must be of type `boolean`.
     - `personalization.systemInstructions`: must be of type `string`, with a 5000-character length limit.
     - `search.searxngURL`: a valid HTTP/HTTPS URL (with no credentials or cloud metadata addresses) or an empty string.
4. **Prototype Pollution Protection**:
   - The keys `__proto__`, `constructor`, and `prototype` are blocked at every nesting level of the path.
5. **Separation of Provider Management**:
   - Provider configuration (`modelProviders`) cannot be modified through the general `/api/config` endpoint — only through the dedicated `/api/providers` CRUD endpoints.

---

## 5. Protecting Provider Registration and Eliminating Error Leakage

### The Vulnerability
1. When registering a new model provider (`POST /api/providers`), supplying the address of an internal service (e.g. `http://127.0.0.1:3000`) triggered an attempt to fetch its model list via `fetch`.
2. When the internal service responded with an HTML page (`<!DOCTYPE ...`), the `res.json()` call threw a `SyntaxError` whose message contained a fragment of the received HTML document.
3. That error ended up in `chatModels: [{ key: 'error', name: err.message }]` and was returned in the API response, letting an attacker read fragments of pages from the internal network (a partially-readable SSRF).

### Architectural Solution Applied
1. **Error Message Sanitization in `ModelRegistry` (`src/lib/models/registry.ts`)**:
   - The `sanitizeErrorMessage(err)` method analyzes and filters every error returned from the provider layer.
   - Any error containing HTML markup, JSON parser errors (`SyntaxError`, `Unexpected token`, `<!DOCTYPE`), or an overly long message is replaced with a safe, generic message: `"Failed to connect to model provider: received invalid non-JSON response"`.
2. **Safe Response Handling in Provider Classes**:
   - Every provider (`OllamaProvider`, `LMStudioProvider`, `LemonadeProvider`, `GroqProvider`, `GeminiProvider`, `AnthropicProvider`) now implements:
     - Verifying the `res.ok` status code before attempting to parse.
     - Safe parsing via `try { await res.json() }`, catching `SyntaxError`.
     - Request timeouts (`signal: AbortSignal.timeout(5000)`).
3. **Static `parseAndValidate` Validation in Provider Classes**:
   - Every provider class verifies the URL scheme (`http:`, `https:`), the absence of embedded credentials, and blocks cloud metadata addresses.

---

## 6. Analysis and Exclusion of RCE / Shell Command Execution Vulnerabilities

### Code Audit Outcome
A report alleging a possible Remote Code Execution (RCE) vulnerability via dangerous calls to `child_process.exec`, `execSync`, or `spawn` was thoroughly audited across the entire repository and commit history:
1. **No `child_process` module in use**: the `child_process` module, along with `eval`, `new Function`, and `vm.runInContext`, **has never been and is not used anywhere in the Vane backend**.
2. **Pure JavaScript parsing**:
   - Document processing (`pdf-parse`, `officeparser`, `mammoth`, `jspdf`) is handled entirely within the JavaScript environment, with no binary processes spawned at the operating-system level.
   - The web scraper (`playwright`) communicates with the Chromium instance via the Chrome DevTools Protocol (CDP), with no system shell involved.
3. **`mathjs` library security**:
   - The application uses `mathjs@15.2.0`, a version in which every historical sandbox-escape / prototype-pollution vulnerability has been eliminated. AST evaluation runs in an isolated parser with no access to the `process`, `require`, or `global` objects.
   - In the `src/lib/agents/search/widgets/calculationWidget.ts` module, the `mathEval` call is further protected with a `try ... catch` block, making the application resilient to any syntax errors or anomalies in queries.
