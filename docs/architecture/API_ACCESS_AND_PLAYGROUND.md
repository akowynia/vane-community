# API Access & Developer Playground Architecture

## 1. Overview & Objectives
The **API Access** subsystem provides secure programmatic access to Vane's search and AI synthesis capabilities. It includes:
- Per-user and multi-tenant API key management.
- 256-bit entropy cryptographic keys (`vane_sk_...`) stored securely with one-way SHA-256 hashing.
- Dual-layer Rate Limiting (in-memory sliding-window request throttling + daily token usage caps).
- A safe server-side API Playground (`POST /api/api-keys/playground-run`) preventing raw secret leakage to the browser.
- Full telemetry and statistics breakdown per user and per API key (`ui`, `api`, `cron`).
- Client-side code snippet generation for cURL, Python, Node.js, and n8n workflows.

---

## 2. Security Architecture

### 2.1 Key Generation & Storage
1. **Raw Key Format**: `vane_sk_` + 32 cryptographic random bytes encoded in hex (`64 hex characters`). Total length: 72 characters (256 bits entropy).
2. **One-Way Hashing**: The backend generates `keyHash = SHA256(rawKey)`. Only `keyHash` and a preview `keyPrefix` (first 16 characters) are stored in the SQLite `api_keys` table.
3. **One-Time Secret Reveal**: The raw key is returned to the client UI only once upon creation.

### 2.2 Request Authentication & RBAC
- Supported headers in `/api/search` and all external routes:
  - `Authorization: Bearer vane_sk_...`
  - `x-api-key: vane_sk_...`
- When a valid key is provided:
  - The request is authenticated in the context of the key owner (`userId`).
  - Active/suspended status of the key is validated.
  - The request is attributed with `apiKeyId` and `source = 'api'` in telemetry metrics (`model_stats`).

### 2.3 Safe Playground Execution
To test keys without requiring the frontend to retain or reconstruct raw keys, the playground calls:
`POST /api/api-keys/playground-run`
- Payload: `{ apiKeyId, query, chatModel, optimizationMode, focusMode, waypointId, stream }`
- Verified against the currently logged-in user session or admin privileges.
- Executes the search agent internally, recording latency, rate limits, and token usage.

---

## 3. Rate Limiting & Throttling
- **Sliding-Window Rate Limiter**: Tracks requests per 60-second window per `apiKeyId`.
- **Response Headers**:
  - `X-RateLimit-Limit`: Maximum requests permitted per minute.
  - `X-RateLimit-Remaining`: Remaining request quota in the current window.
  - `Retry-After`: Seconds to wait before retrying when HTTP 429 is returned.
- **Daily Token Limits**: Prevents budget overrun on LLM providers.

---

## 4. Usage Statistics & Audit Breakdown
The statistics engine (`src/lib/stats/tracker.ts` and `/api/statistics`) supports:
- Source dimension: `ui` (Web Chat), `api` (External API keys), `cron` (Waypoint background jobs).
- Breakdown by User (`userBreakdown`).
- Breakdown by API Key (`apiKeyBreakdown`).
- Filtering by `source`, `userId`, and `apiKeyId`.

---

## 5. UI Integration & 12 Locales
- Accessible via the **API Access** tab (`/api-access`) in `Sidebar.tsx`.
- Fully localized across 12 languages: English (`en`), Polish (`pl`), German (`de`), French (`fr`), Spanish (`es`), Italian (`it`), Portuguese (`pt`), Russian (`ru`), Ukrainian (`uk`), Chinese (`zh`), Japanese (`ja`), and Korean (`ko`).
