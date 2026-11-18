# Mermaid Diagram Rendering Architecture and Interactive Controls

This document details the architecture, rendering lifecycle, fail-safe isolation, and interactive inspection controls for Mermaid diagrams.

---

## 1. Overview and Problem Statement

Mermaid diagrams provide rich visual architectural flowcharts, sequence diagrams, and state machines directly inside AI search and assistant responses.

Starting in version 1.2, a CSS fail-safe intended to suppress rogue error elements in the document root inadvertently blocked browser-side SVG rendering:
- While headless export engines (PDF and Markdown) succeeded in rendering diagrams, the interactive web chat interface fell back to displaying raw code blocks in an error state.
- The root issue stemmed from `display: none !important` applied to Mermaid measurement containers directly under the document body. Under this rule, browser SVG geometry calculations (`.getBBox()` and `.getBoundingClientRect()`) return `0x0` dimensions or throw exceptions, causing graph layout engines (such as Dagre) to fail.

To resolve this issue and fulfill user expectations from community feedback, the architecture implements:
1. Non-destructive off-screen geometry preservation for layout calculation nodes.
2. Interactive tabbed preview controls (Rendered SVG Diagram vs. Raw Mermaid Code View).
3. Resilient auto-repair parser normalization and prompt engineering rules.
4. Defense-in-depth SVG sanitization and strict script execution policies.

---

## 2. Technical Architecture

### 2.1 Off-Screen DOM Geometry Isolation

During diagram synthesis, Mermaid dynamically injects a temporary measurement wrapper into the document body to compute text bounding boxes and edge routing. 

To prevent visual flashing or layout shift without destroying measurement capabilities:
- Rogue error nodes (`#error-svg`) are hidden immediately.
- Temporary measurement containers (`dmermaid-*`, `dvane-mermaid-*`, etc.) are repositioned off-screen using:
  ```css
  position: absolute !important;
  top: -99999px !important;
  left: -99999px !important;
  opacity: 0 !important;
  pointer-events: none !important;
  ```
- By remaining in the active render tree (unlike `display: none`), `.getBBox()` accurately reports node bounding boxes across all major rendering engines (Chromium, Gecko/Firefox, and WebKit/Safari).

### 2.2 Scoped Element Lifecycle and Cleanup

To eliminate race conditions when multiple diagrams stream concurrently in a single thread:
- Each diagram instance generates a unique, isolated identifier prefix (`vane-mermaid-[uniqueId]-[timestamp]-[random]`).
- The DOM cleanup handler targets solely elements matching the specific instance's identifier, ensuring that cleanups triggered by one diagram do not inadvertently destroy the active measurement node of a parallel diagram.

### 2.3 Interactive View Controls (Preview vs. Code)

The diagram wrapper component features a dual-mode header toolbar:
- **Preview Tab:** Displays the rendered high-fidelity SVG diagram with dark/light theme awareness.
- **Code Tab:** Exposes the raw syntax with monospace typography and quick copy-to-clipboard functionality.
- **Transient State Handling:** If parsing encounters a partial or incomplete stream, or an unrecoverable syntax fault, the component presents a syntax warning card, displays the raw source code, and provides an interactive retry button.

### 2.4 Auto-Repair Pipeline

Prior to sending diagram code to the Mermaid parser, the frontend passes raw text through an automated repair pipeline that resolves common LLM formatting inconsistencies:
- Replaces non-breaking spaces and non-breaking hyphens with standard ASCII characters.
- Quotes unquoted subgraph titles (`subgraph id["Title"]`).
- Automatically quotes node text enclosed in brackets (`[...]`), braces (`{...}`), cylinders (`[(...)]`), circles (`((...))`), or subroutines (`[[...]]`) that contain parentheses, colons, slashes, or special symbols.
- Quotes edge text containing special characters (`-->|"label"|`).

---

## 3. Security and Defense-in-Depth

1. **Strict Security Level:** Mermaid initialization enforces `securityLevel: 'strict'`. In this mode, Mermaid's internal DOMPurify pipeline strips malicious executable markup, attributes, and tags.
2. **SVG Sanitization Guard:** Rendered SVG payloads undergo client-side verification prior to injection; any presence of inline `<script>` tags or event handlers (`onload`, `onclick`, `onerror`) immediately aborts rendering and triggers a safe fallback view.
3. **Container Scoping:** Generated diagrams are isolated inside a dedicated wrapper with responsive CSS bounds (`[&>svg]:max-w-full [&>svg]:h-auto`), preventing horizontal layout overflow.

---

## 4. Model Prompting Standards

AI generation prompts explicitly specify strict diagram rules:
- Supported diagram definitions: `flowchart TD / LR`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`.
- Mandatory quotation of node labels inside brackets/braces (`node1["Label text (details)"]`).
- Alphanumeric, space-free identifiers (`step_1`, `db_primary`).
- Proper subgraph enclosure (`end`) with quoted titles.
- Prohibition of embedded HTML tags (`<br>`, `<div>`) and Markdown formatting (`**bold**`) within labels.
