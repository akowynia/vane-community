# Changelog

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
