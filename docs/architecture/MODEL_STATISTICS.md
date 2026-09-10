# LLM Model Telemetry and Statistics Architecture (Model Statistics)

Technical documentation for the **Model Statistics** feature (the LLM analytics card in the Vane-Community sidebar).

---

## 1. Feature Overview

The **Model Statistics** card (`/statistics`) provides a comprehensive view into the behavior of the language models (LLMs) used in Vane-Community. The system automatically collects telemetry from every stage of the pipeline (the main answer, the intent classifier, the research agent, and follow-up question suggestions).

### Key metrics:
- **Token usage**: prompt (input) and completion (output) token counts, computed in real time (`js-tiktoken`).
- **Response time (latency)**: total query execution time in milliseconds, and time to first token (TTFT).
- **Throughput**: generation speed measured in tokens per second (tok/s).
- **Model and provider breakdown**: the percentage share of each model (OpenAI, Anthropic, Gemini, Ollama, LM Studio, etc.) in queries and token consumption.
- **Pipeline steps**: queries broken down by stage (`answer`, `classifier`, `researcher`, `suggestions`, `widget`).
- **Reliability**: the success rate (%) and a log of any errors.
- **Audit Log**: a detailed record of individual technical calls, with the ability to inspect prompts and execution parameters.

---

## 2. Database Schema (`model_stats`)

The `model_stats` table in the SQLite database (`drizzle/schema.ts`) stores individual call records:

```sql
CREATE TABLE IF NOT EXISTS model_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chatId TEXT,
  messageId TEXT,
  providerId TEXT NOT NULL,
  modelKey TEXT NOT NULL,
  query TEXT,
  step TEXT NOT NULL DEFAULT 'answer',
  promptTokens INTEGER NOT NULL DEFAULT 0,
  completionTokens INTEGER NOT NULL DEFAULT 0,
  totalTokens INTEGER NOT NULL DEFAULT 0,
  durationMs INTEGER NOT NULL DEFAULT 0,
  timeToFirstTokenMs INTEGER,
  tokensPerSecond REAL,
  optimizationMode TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  errorMessage TEXT,
  createdAt TEXT NOT NULL
);
```

---

## 3. Telemetry Module (`src/lib/stats/tracker.ts`)

The module exposes:
- `recordLlmMetric(metric: LLMMetricInput)`: asynchronously records a metric without blocking the main thread of the user's response.
- `getStatsSummary(options)`: aggregates KPIs, computes time series for charts (daily/hourly), and breaks down models, providers (with dynamic mapping of internal ids/UUIDs to friendly `providerName` display names), users, API keys, and optimization modes.
- `ensureStatsBackfill()`: automatically generates initial statistics from existing message history if the telemetry table is empty.
- `clearStats()`: clears the collected logs.

---

## 4. API Endpoints

### `GET /api/statistics`
Fetches aggregated statistics and a list of recent logs.

**Query parameters:**
- `timeframe`: `'24h'` | `'7d'` | `'30d'` | `'all'` (default `'7d'`)
- `model`: optional filter by model key (e.g. `'gpt-4o'`)
- `provider`: optional filter by provider (e.g. `'openai'`)
- `step`: optional filter by pipeline step (`'answer'`, `'classifier'`, `'suggestions'`)
- `source`: optional source filter (`'all'`, `'ui'`, `'api'`)
- `userId`: optional user filter
- `apiKeyId`: optional API key filter

**JSON response:**
```json
{
  "kpi": {
    "totalTokens": 14520,
    "totalPromptTokens": 8200,
    "totalCompletionTokens": 6320,
    "totalRequests": 42,
    "avgDurationMs": 1240,
    "avgTtftMs": 320,
    "avgTokensPerSecond": 42.5,
    "avgTokensPerRequest": 345,
    "successCount": 42,
    "errorCount": 0,
    "successRate": 100.0,
    "activeModelsCount": 2,
    "topModel": "gpt-4o",
    "topProvider": "openai",
    "topProviderName": "OpenAI"
  },
  "timeSeries": [...],
  "modelBreakdown": [
    {
      "modelKey": "gpt-4o",
      "providerId": "openai",
      "providerName": "OpenAI",
      "requests": 30,
      "totalTokens": 12000,
      ...
    }
  ],
  "providerBreakdown": [
    {
      "providerId": "openai",
      "providerName": "OpenAI",
      "requests": 30,
      "totalTokens": 12000,
      "percentage": 82.6
    }
  ],
  "stepBreakdown": [...],
  "userBreakdown": [...],
  "apiKeyBreakdown": [...],
  "sourceBreakdown": [...],
  "recentLogs": [...]
}
```

### `DELETE /api/statistics`
Clears every record in the `model_stats` table.

---

## 5. UI Integration

1. **Sidebar navigation (`Sidebar.tsx`)**:
   - A new entry was added: `Stats`, with a `BarChart3` icon, linking to `/statistics`.
   - Supported on both the desktop view and the mobile bottom bar.
2. **Analytics dashboard (`src/app/statistics/page.tsx`)**:
   - KPI cards styled to match Vane (dark/light theme).
   - An interactive bar chart of token usage over time, with a hover preview.
   - Readable provider names shown (e.g. Ollama, LM Studio, OpenAI) instead of internal UUIDs.
   - Comparison of response times and model/provider shares.
   - Usage breakdown by user (`Usage by User`) and by API key (`Usage by API Key`).
   - An audit-log table with search and a call-details modal.
   - Report export to JSON format.
