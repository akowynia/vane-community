# Changelog

## [1.1.2]

### Fixed
- Model Reasoning & Thinking Stream Isolation: Encapsulated internal thinking/reasoning streams (`reasoning_content`, `reasoning`, `thinking`, `thinking_delta`) inside `<think>...</think>` tags across OpenAI, Groq, Ollama, and Anthropic providers, preventing reasoning tokens from leaking into responses
- Thinking Tag Normalization: Unified alternative tags (`<thought>`, `<thinking>`) into canonical `<think>` tags across chat rendering, JSON sanitization, print export, and navigation utilities
- Batch Search Note Quality: Separated reasoning logic from search responses in `/api/search` and Batch Search notes, adding an on-demand collapsible thinking process inspector while keeping final research notes clean
- Batch Search Document & CSV Exports: Sanitized exported compiled documents, CSVs, and Scratchpad notes against thinking tag leakage
- Mermaid Diagram Auto-Repair: Added automatic syntax repair in `MermaidBlock` to auto-quote unquoted node labels with parentheses, slashes, and special characters, and convert non-breaking hyphens to prevent parser syntax errors
- Batch Search Diagram Rendering: Added full Markdown and Mermaid diagram visualization in Batch Search note card previews

## [1.1.1]

### Improved
- Batch Search Concurrency & Queueing: Introduced adaptive worker pool managing concurrent executions for cloud APIs while serializing local model runs to prevent VRAM contention
- Memory Management & Lifecycle: Implemented proactive session cleanup and browser recycling after high-volume page crawling to eliminate memory growth
- Queue Resilience: Added non-destructive re-import and smart state preservation for batch query processing
- Model Providers: Added support for local Lemonade hardware instances and remote Ollama Cloud integration, with dynamic OpenAI model discovery
- Security Enhancements: Reinforced SSRF network boundary validation and scheme protections across hybrid local and cloud model provider endpoints

## [1.1.0]

### Added
- Deep Research Agent with recursive query decomposition, autonomous exploration depth and breadth controls, and comprehensive synthesis reports
- Model Context Protocol (MCP) dynamic client supporting SSE and stdio transports, tool discovery, runtime execution, and telemetry logging
- Dedicated MCP Docker container and stdio-to-HTTP bridge for isolated execution of MCP servers
- Presenton MCP integration and AI presentation workflows directly accessible from the Scratchpad canvas
- Batch Search module supporting CSV query processing, parallel execution queues, streaming progress indicators, and multi-format exports
- Pluggable advanced scraper engine architecture with native Firecrawl and Crawl4AI integrations
- Highly customizable PDF export engine with branding styles, corporate headers and footers, and custom color themes
- Multi-theme visual engine supporting Modern and Retro aesthetic styles with full localization across 12 languages
- Waypoint Cron webhooks enabling proactive scheduled workspace research and external event triggers
- Automated GitHub Pages continuous documentation deployment pipeline powered by Material for MkDocs

## [1.0.2]

### Fixed
- Fixed internal server error (500) on Docker deployments with local data volumes by fixing permission handling and directory initialization
- Fixed session cookie rejection over HTTP deployments by dynamically checking connection security (RFC 6265bis compliance)
- Fixed session handling in single-user onboarding to automatically authenticate admin users upon completing setup
- Fixed Ollama model listing timeout and request blocking during response generation
- Added Docker host-gateway mapping to enable connectivity with local host LLM instances
- Improved resiliency across all model providers with safe fallback handling for uninitialized configurations

## [1.0.1]

### Added
- Mermaid diagram rendering support in message renderer
- Callout block formatting and visualization for AI messages
- Architecture documentation for search and response optimizations

### Changed
- Refactored print export utilities into dedicated modules
- Optimized web scraper and search researcher actions

### Fixed
- Fixed chat state reset and new chat ID generation on starting a new chat
- Updated documentation to point to the published Docker Hub image

## [1.0.0] — Independent release

Vane-Community v1.0.0 marks the start of independent development, forked from
[Vane](https://github.com/ItzCrazyKns/Vane) **v1.12.2** by [ItzCrazyKns](https://github.com/ItzCrazyKns)
(upstream commit `7dc5d08`, 2026-04-11). Versioning restarts at `1.0.0` to reflect
this project's own release history going forward; it does not indicate feature
parity with, or a downgrade from, upstream `v1.12.2`.

Everything below was built on top of that base and is maintained independently
from this point on.

### Added
- Multiuser authentication with session management, RBAC, and rate-limited login/logout
- Waypoints — custom system instructions and per-chat context management
- Background cron job scheduling with API management and UI
- API key management system with playground, rate limiting, and usage tracking
- Dynamic SearXNG engine management with an encrypted API key vault
- Quality Mode configurable token budget limits
- Model task queue for VRAM-aware sequential local model execution
- Model telemetry and statistics dashboard (token usage, latency)
- Scratchpad module — document management, versioning, AI chat, templates
- AI-powered presentation generation (planning, research, slide visualization, PPTX export) — **Beta**
- Multi-language (i18n) support across the application
- Diagnostic endpoints for search and provider connectivity
- Message management: retry, edit, delete, with backend support

### Security
- SSRF protection across scraping, provider base URLs, and SearXNG configuration
  (private/metadata IP ranges, DNS-rebinding checks, protocol allowlisting)
- Middleware authentication for `/api/*` with constant-time key comparison
- Secret masking in configuration responses; write-lock when no API key is configured
- CSRF origin/referer validation and standard security headers

### Changed
- Renamed project to Vane-Community
- Redesigned sidebar navigation and UI styling
- Replaced client-side PDF export with browser-native print export
- Various robustness improvements to LLM streaming, JSON parsing, and fallback logic

See the git history for full details prior to this point.
