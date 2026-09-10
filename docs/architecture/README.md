# Vane-Community Architecture

Vane-Community is a Next.js application that combines an AI chat experience with search.

For a high level flow, see [WORKING.md](WORKING.md). For deeper implementation details, see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Key components

1. **User Interface**

   - A web based UI that lets users chat, search, and view citations.

2. **API Routes**

   - `POST /api/chat` powers the chat UI.
   - `POST /api/search` provides a programmatic search endpoint.
   - `GET /api/providers` lists available providers and model keys.

3. **Agents and Orchestration**

   - The system classifies the question first.
   - It can run research and widgets in parallel.
   - It generates the final answer and includes citations.

4. **Search Backend**

   - A meta search backend (SearXNG) is used to fetch relevant web results when research is enabled.

5. **LLMs (Large Language Models)**

   - Used for classification, writing answers, and producing citations.

6. **Embedding Models**

   - Used for semantic search over user uploaded files.

7. **Storage**
   - Chats and messages are stored so conversations can be reloaded.

## Detailed Modules
- [Model Task Queue & Model-Aware Scheduling](PROVIDER_QUEUE_AND_MODEL_SCHEDULING.md)
- [API Access & Developer Playground](API_ACCESS_AND_PLAYGROUND.md)
- [Waypoints & Personalized Spaces](WAYPOINTS.md)
- [Waypoint Crons & Scheduled Refresh](WAYPOINT_CRONS.md)
- [Roles, Vault & Multi-user Security](ROLES_VAULT_AND_MULTIUSER.md)
- [Model Statistics & Telemetry](MODEL_STATISTICS.md)
- [Localization System](LOCALIZATION.md)
- [Security Architecture](SECURITY.md)
- [Scratchpad (AI Canvas / Notes)](SCRATCHPAD.md)
- [AI Presentation Generator](PRESENTATIONS.md)
- [Unified Search & Input Panel](UNIFIED_SEARCH_PANEL.md)
- [Search Engines Configuration & API Keys](SEARCH_ENGINES_CONFIG.md)
- [Search Warnings & Engine Diagnostics](SEARCH_WARNINGS.md)
- [Search Diagnostics & Resilience](SEARCH_DIAGNOSTICS_AND_RESILIENCE.md)
- [Search & Streaming Resilience](SEARCH_STREAMING_RESILIENCE.md)
- [Quality Mode Optimizations](QUALITY_MODE_OPTIMIZATIONS.md)
- [Model Selection & Response Metadata](MODEL_SELECTION_AND_RESPONSE_METADATA.md)
- [Scraper Extraction & Telemetry](SCRAPER_EXTRACTION_AND_TELEMETRY.md)
