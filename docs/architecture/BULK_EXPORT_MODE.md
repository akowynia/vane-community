# Bulk Selection & Multi-Format Export Mode

## Overview

The application features a comprehensive, multi-format bulk export engine that seamlessly integrates into the multi-item selection toolbar. Users can select arbitrary subsets or entire collections of resources—including chats, scratchpad notes, batch research results, scheduled tasks, and workspace spaces—and export them into structured document formats with granular controls over sources, metadata, and packaging.

---

## 1. UI Architecture & Entry Points

### Dual-State Toolbar Integration
The export workflow operates across two complementary states in the selection ribbon:
1. **Inactive Selection Mode**: An "Export" trigger is located directly alongside the "Select" mode toggle. Clicking it immediately engages selection mode so users can select desired items.
2. **Active Selection Mode**: When selection mode is active, an "Export" action button appears in the primary toolbar section right next to "Deselect all". The button activates dynamically whenever at least one item is checked.

### Universal Export Dialog
Triggering the export action presents a unified configuration modal providing:
- **Format Selection Grid**: Visual cards for DOCX, PDF, Markdown, HTML, Plain Text, and JSON.
- **Bibliography & Citation Control**: Toggle to include or strip sources, citations, and web reference links.
- **Metadata Toggle**: Option to include or omit timestamps, model identifiers, and telemetry counters.
- **Packaging Mode**: Choice between a single consolidated document or a packaged ZIP archive containing individual files per item.
- **Visual Document Styling**: Selection of theme styles (Vane Classic, Minimal Neutral, Corporate Executive, Academic Paper) for rendered PDF and HTML exports.

---

## 2. Supported Export Formats & Rendering Pipeline

### Native OpenXML DOCX Generation
- Implemented using pure OpenXML packaging over JSZip, eliminating fragile third-party binary dependencies.
- Generates compliant Word documents complete with content type maps, relationship schemas, and custom paragraph styles.
- Features automatic section pagination (`w:br w:type="page"`) between distinct items in consolidated exports.
- Supports headings (H1, H2, H3), blockquotes, bulleted and numbered lists, code blocks with shading and monospaced typography, and reference link lists.

### High-Fidelity PDF & Browser Printing
- Utilizes the unified print stylesheet pipeline with `@page` sizing, portrait geometry, and high-contrast styling.
- Inserts CSS break avoidance and page splits (`page-break-before: always; break-before: page;`) between consolidated conversation turns or notes.
- Eliminates UI artifacts and automatically suppresses internal model reasoning tags (`<think>`, `<thought>`, `<thinking>`).

### Markdown & Plain Text
- Generates clean, standards-compliant Markdown files suitable for Obsidian, Notion, and static site generators.
- Plain text generation normalizes special symbols and strips formatting tags while maintaining structured typographic spacing.

### HTML Reports
- Generates self-contained, offline-capable HTML documents with embedded CSS and vector SVG icons for instant opening in any modern web browser.

### Structured JSON
- Exports raw data arrays with timestamps, content, source metadata, and metrics for programmatic ingestion and backup.

---

## 3. Covered Application Modules

| Module | Export Scope & Data Model |
| :--- | :--- |
| **All Chats (Library)** | Asynchronously retrieves full turn-by-turn conversation messages, user queries, assistant responses, deduplicated sources, and model metrics. |
| **Batch Research Notes (Library)** | Structured research documents compiled from batch search jobs and saved in the note repository. |
| **Scratchpad Notes & Drafts** | Full notes, research synthesis documents, and presentation slide markdown with version context. |
| **Waypoint Detail Chats** | Conversation history scoped strictly to the parent workspace space. |
| **Waypoints Spaces** | Space descriptions, icon configurations, creation dates, and custom system masterprompts. |
| **Schedules (Crons)** | Task names, cron timing expressions, model assignments, prompts, and active execution status. |
| **Batch Search Studio** | Selected query rows, status badges, and synthesized search responses from active queue sessions. |

---

## 4. Security & Resilience Architecture

### IDOR Prevention & Multi-User Scoping
- In multi-user mode, bulk data retrieval endpoints enforce user authentication and ownership checks.
- Exporting chats or private notes strictly verifies that the authenticated user matches the resource owner or holds administrative privileges.

### Path Traversal & Filename Sanitization
- File and ZIP archive entry names undergo strict character sanitization: control codes, directory traversal sequences (`../`), and invalid filesystem characters are filtered.
- File names are truncated to safe lengths to prevent filesystem overflow on varied host operating systems.

### XML & HTML Injection Protection
- All user-supplied prompts, queries, and assistant texts inserted into OpenXML document structures are XML-escaped (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`).
- Dangerous control characters (`\x00-\x1F` except allowed whitespace) are filtered to prevent document corruption.

### Memory Optimization & Leak Prevention
- Asynchronous chat fetching processes items in concurrent chunks of 5 parallel requests, avoiding browser connection pool exhaustion.
- Generated client-side object URLs (`URL.createObjectURL`) are systematically released with `URL.revokeObjectURL` following browser download initiation.

