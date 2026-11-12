# Vane-Community Architecture

Vane-Community is a Next.js application that combines an AI chat experience with search.

For a high level flow, see [WORKING.md](WORKING.md). For deeper implementation details, see [Contributing Guidelines](https://github.com/akowynia/vane-community/blob/master/CONTRIBUTING.md).

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
- [Advanced Scraper Integration (Firecrawl & Crawl4AI)](ADVANCED_SCRAPER_INTEGRATION.md)
- [Search & Response Pipeline Optimizations](SEARCH_AND_RESPONSE_OPTIMIZATIONS.md)
- [Beta Options & Feature Flags](BETA_OPTIONS.md)
- [Batch Search & CSV Processing](BATCH_SEARCH.md)
- [Docker Multi-Architecture Build & Versioning Pipeline](DOCKER_RELEASE_PIPELINE.md)
- [Deep Research & Recursive Autonomous Exploration](DEEP_RESEARCH.md)
- [Waypoint Cron Webhooks & Proactive Notifications](WAYPOINT_CRON_WEBHOOKS.md)
- [Model Context Protocol (MCP) Integration](MCP_INTEGRATION.md)
- [MCP Dedicated Docker Container](MCP_DOCKER_IMAGE.md)
- [Presenton MCP Integration & Research-to-Presentation](PRESENTON_MCP_RESEARCH_PRESENTATIONS.md)
- [Multi-Theme Architecture (Modern & Retro Themes)](UI_THEMES.md)
- [PDF Export Styles & Branding Customization](PDF_EXPORT_CUSTOMIZATION.md)
- [Model Reasoning & Thinking Process Isolation](MODEL_REASONING_AND_THINKING_ISOLATION.md)
- [Bulk & Selective Deletion Mode](BULK_DELETE_MODE.md)
- [GitHub Pages Continuous Documentation Deployment](GITHUB_PAGES_DEPLOYMENT.md)
