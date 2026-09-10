# Architecture Concept: Scratchpad (Canvas / Notes with an AI Copilot)

## 1. Introduction and Purpose

The **Scratchpad** is an advanced workspace in Vane (the equivalent of *Canvas* in ChatGPT / *Artifacts* in Claude), combining the strengths of an interactive AI assistant equipped with web search with a full-fledged document and notes editor.

### Key principles:
1. **Two-panel working interface (Split View)**:
   - **Left panel**: chat with the AI model, web-search options, optimization modes, model selection, and attachments.
   - **Right panel**: a Markdown/text editor with a formatting toolbar, live preview, table of contents (TOC), and counters.
2. **Dynamic note creation and modification**:
   - The user asks the assistant to create or expand a note in the chat (e.g. *"create a note about recursion"*).
   - The assistant searches the web or literature for the necessary information, composes a chat reply with citations, and directly updates the document content in the editor on the right.
3. **Contextual and selective (targeted in-line) editing**:
   - The user can select any fragment of text in the editor and issue a command in the chat (e.g. *"change this to a Python example"*, *"expand this point with technical detail"*).
   - The assistant receives the context of the selection and modifies exactly the indicated fragment without damaging the rest of the note's structure.
4. **Full version history (Version History & Time Travel)**:
   - Every change (AI-generated or made manually) creates a new version snapshot in the database.
   - The user can browse earlier versions of the document, compare changes, and restore any archived version at any time.
5. **Template system (built-in and user-defined)**:
   - Ready-made starting patterns (research analysis, technical specification, study plan, meeting notes, article).
   - Full localization of the skeleton content (Markdown) and the AI system instructions for all 12 languages (`src/lib/scratchpad/builtinTemplates.ts`).
   - Any note can be saved as a reusable template with dedicated instructions for the AI.
6. **Dynamic table of contents (TOC)**:
   - Automatically generated live from the note's headings, with quick navigation and AI actions per section (*"✨ Expand with AI"*).
7. **Source tracking and presentation**:
   - All web sources and files used to draft the note are logged and presented as interactive cards (with favicons, domains, and links).
8. **Multi-language support and user isolation (RBAC)**:
   - Full support for 12 UI languages.
   - Note isolation in Multi-User mode, and full local access in Single-User mode.

---

## 2. Data Model (SQLite / Drizzle ORM)

### `scratchpads` table
```ts
export const scratchpads = sqliteTable('scratchpads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  userId: text('user_id'),
  waypointId: text('waypoint_id'),
  templateId: text('template_id'),
  sources: text('sources', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

### `scratchpad_versions` table (version history)
```ts
export const scratchpadVersions = sqliteTable('scratchpad_versions', {
  id: text('id').primaryKey(),
  scratchpadId: text('scratchpad_id')
    .notNull()
    .references(() => scratchpads.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  prompt: text('prompt'),
  sources: text('sources', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  author: text('author').notNull().default('ai'), // 'ai' | 'user'
  createdAt: text('created_at').notNull(),
});
```

### `scratchpad_messages` table (scratchpad chat history)
```ts
export const scratchpadMessages = sqliteTable('scratchpad_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scratchpadId: text('scratchpad_id')
    .notNull()
    .references(() => scratchpads.id, { onDelete: 'cascade' }),
  messageId: text('message_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  query: text('query').notNull(),
  responseBlocks: text('response_blocks', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  sources: text('sources', { mode: 'json' }).$type<any[]>().default(sql`'[]'`),
  selectedText: text('selected_text'),
  createdAt: text('created_at').notNull(),
});
```

### `scratchpad_templates` table (note templates)
```ts
export const scratchpadTemplates = sqliteTable('scratchpad_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('FileText'),
  content: text('content').notNull(),
  systemInstructions: text('system_instructions'),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false),
  userId: text('user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

---

## 3. API Architecture

1. `GET /api/scratchpad` – fetch the user's list of scratchpads with a summary and statistics.
2. `POST /api/scratchpad` – create a new empty scratchpad, or one initialized from a prompt.
3. `GET /api/scratchpad/[id]` – fetch the full scratchpad state, chat messages, and available versions.
4. `PUT /api/scratchpad/[id]` – manually update the note's title or content.
5. `DELETE /api/scratchpad/[id]` – delete a scratchpad along with its version history and messages.
6. `GET /api/scratchpad/[id]/versions` – fetch the list of all versions of the note.
7. `POST /api/scratchpad/[id]/versions/[versionId]/revert` – restore the document to the indicated version.
8. `POST /api/scratchpad/[id]/chat` – the streaming AI assistant that performs web research, drafts the note, and applies selective edits.
9. `GET /api/scratchpad/templates` – fetch the list of built-in and user templates.
10. `POST /api/scratchpad/templates` – save a new user template.
11. `PUT / DELETE /api/scratchpad/templates/[id]` – modify or delete a user's own template.

---

## 4. UI Architecture (UI/UX)

1. **Navigation menu (`Sidebar.tsx`)**:
   - A new menu item: `Scratchpad`, placed under `Waypoints`.
   - Icon: `NotebookPen` from the `lucide-react` library.
   - Path: `/scratchpad`.
2. **Main view (`src/app/scratchpad/page.tsx`)**:
   - A scratchpad search box, a *New scratchpad* button, a template-selection dialog, and a tile grid with previews and metadata.
3. **Working view (`src/app/scratchpad/[id]/page.tsx`)**:
   - **Full-bleed widescreen workspace**:
     - The artificial width constraint (`max-w-screen-lg`) in the main `Layout.tsx` was removed, letting the scratchpad use the full available screen width (from the sidebar edge to the right edge of the window).
     - The AI chat column has an ergonomic, optimal width (`lg:w-[400px] xl:w-[460px] 2xl:w-[500px]`), while the editor takes up all remaining space (`flex-1 min-w-0`), providing a comfortable experience with live preview and an open sources/TOC panel even on smaller laptop screens and 4K monitors.
   - **Left column**: AI chat, streaming, thinking, sources, and an action bar (`ModelSelector`, `Optimization`, `Sources`, `Attach`, `WaypointSelector`).
   - **Right column**: the Markdown editor, formatting toolbar, mode switcher (edit / split / preview), a collapsible side panel with a tab switcher (**Table of Contents (TOC)** and **Sources & References panel**), version history, and export.
5. **Document export and printing with a sources option (`ScratchpadExportDialog.tsx`)**:
   - **Include-sources toggle**: in the export dialog, the user can decide whether the document should include footnotes and a bibliography, or be generated as plain text.
   - **Automatic text cleanup (when sources are disabled)**:
     - All footnote markers `[number]` and `[number, number]` are precisely stripped from the text, along with any leading spaces before punctuation marks (e.g. `baseline condition [10] .` -> `baseline condition.`).
     - The document contains no bibliography section at the end.
   - **Full bibliography formatting (when sources are enabled)**:
     - In the text, footnotes are formatted as neat superscripts, `<sup class="citation">[$1]</sup>`, placed directly before punctuation marks.
     - At the end of the printed/PDF document and the exported Markdown/TXT file, a *Sources and Bibliography* section is automatically generated with source cards, links, domains, and quoted excerpts.
6. **Token tracking and model telemetry in the scratchpad chat (`ScratchpadChat.tsx`)**:
   - Every assistant reply in the chat records and displays telemetry badges identical to those in Vane's main chat:
     - **Model identifier**: a `Cpu` icon with the model key (e.g. `gpt-4o`, `claude-3-5-sonnet`) and the provider name.
     - **Generation time**: a `Clock` icon with the measured response time in seconds (e.g. `2.4s`).
     - **Token usage**: a `Zap` icon with the total token count (e.g. `850 tok.`) and a tooltip with a detailed breakdown of input (prompt) and output (completion) tokens.
   - Metrics are stored in the database in the `scratchpad_messages` table (`metrics` column) and in the global `model_stats` statistics system.
7. **Model task-queue button integration (`QueueTrigger.tsx` & `page.tsx`)**:
   - The floating queue widget (`fixed top-20 right-3`) is automatically hidden on the working subpage `/scratchpad/[id]` so it doesn't cover the toolbar and the editor mode-switch buttons (`Edit` / `Split` / `Preview`).
   - Direct access to the model task-queue drawer has been integrated into the top action bar of the scratchpad header with a dedicated `Layers` icon, giving convenient access without visual collisions.
8. **Edit lock while the AI is generating (`ScratchpadEditor.tsx` & `page.tsx`)**:
   - The moment a prompt is sent and the AI assistant is generating/streaming content (`isAiGenerating === true`), user editing is automatically locked.
   - **Note title field**: disabled (`disabled`) while the AI is working.
   - **Editor field (textarea)**: read-only mode (`readOnly`), with text entry blocked and an informational cursor.
   - **Formatting toolbar**: all text-formatting buttons (bold, headings, lists, code, tables, etc.) are greyed out and disabled (`disabled`).
   - **Status indicator**: an animated informational badge appears in the toolbar and the bottom status bar (`✨ AI is editing the note...`), preventing concurrent-editing conflicts.

9. **Interactive query clarification and disambiguation**:
   - **Ambiguity detection (`src/lib/agents/scratchpad/clarifier.ts`)**:
     - Before starting research and generation, the assistant analyzes the user's prompt in the context of the current document and history.
     - If the request is general or has several distinct substantive directions (e.g. *"make a note about recursion"* -> mathematical vs. programming vs. optimization; *"add a chapter on security"* -> web vs. infosec vs. auth), the model does not immediately produce a shallow note, but instead formulates a clarifying question with 2–4 concrete options.
     - Precise instructions (e.g. *"change the code to Python"*, *"fix the heading"*) are executed immediately without clarification.
   - **Interactive widget in the chat (`ScratchpadClarificationBox.tsx`)**:
     - The user sees a neat card with the assistant's question, selectable options, a field to type a custom option, and *"Confirm and draft the note"* / *"Skip (general note)"* buttons.
     - Once confirmed, the assistant searches the web from the chosen angle and drafts the note, and the widget in the chat history collapses into a readable summary of the chosen option.
   - **Support for ongoing editing**:
     - On subsequent additions and modifications to the document, if another ambiguity arises, the assistant dynamically asks for clarification again in the same way.

10. **Smart note-expansion suggestions**:
    - After finishing generating/editing a note, the assistant returns a `<note_suggestions>` block containing 3–4 concrete, contextual suggestions for further developing the document (e.g. *"Add a section on tail recursion with C code"*, *"Compare the complexity with an iterative approach"*, *"Insert a call-graph diagram in Mermaid"*).
    - Suggestions are shown below the chat reply as interactive buttons with a `+` icon.
    - Clicking a suggestion immediately runs it as the next chat command (with the `skipClarification: true` flag), automatically expanding the content in the editor.

11. **Visual diff highlighting and version comparison**:
    - **LCS diff algorithm (`src/lib/scratchpad/diff.ts`)**:
      - Precisely compares document versions line by line, computing change statistics (`added`, `removed`, `unchanged`).
    - **Comparison interface in the history dialog (`ScratchpadVersionHistory.tsx`)**:
      - **Mode switcher**: the user can toggle between *"What changed (Diff)"* mode and *"Preview"* mode (full Markdown render).
      - **Baseline version selector**: compares against the immediately preceding version (`v[N-1]`) by default, with the option to pick any other archived or the current version.
      - **Visual highlighting**:
        - Added lines are marked with a green background, border, and a `+` marker.
        - Removed lines are marked with a red background, strikethrough, and a `-` marker.
        - Unchanged lines keep neutral context and line numbers.
      - **Title-change detection**: a clear banner highlighting the note's old and new title.
      - **Mini badges on the timeline**: each version in the list on the left shows a compact change summary (e.g. `+14 -2`), making it easy to quickly spot key revisions.

12. **Document title management**:
    - The note's title is strictly managed by the user (an editable field in the header).
    - The AI assistant edits only the note's content (`content`) inside the `<note_update>` block, and does not overwrite the document's title on subsequent messages and chat additions.

13. **Template structure information in the editor**:
    - **Informational banner in the editor (`ScratchpadEditor.tsx`)**:
      - When a note is opened/created from a template (or a template structure with a section skeleton and placeholders is detected), a clear, dismissible informational banner (`Layers`) appears at the top of the editor.
      - The banner tells the user that the template below defines the layout, appearance, and building blocks of the finished document, and that a command issued in the chat will have the AI fill in the individual sections.
    - **Hint in the Copilot chat (`ScratchpadChat.tsx`)**:
      - In the chat's initial view, an additional label is shown, indicating the active template and that content will be generated based on the skeleton in the editor.
    - **Multi-language support**:
      - All messages related to the template banner and hint have been localized into 12 languages (`src/lib/i18n/locales/*.ts`).

14. **Set of built-in content templates (`builtinTemplates.ts`)**:
    - The Scratchpad module defines 7 specialized templates optimized for deep research, analysis, and knowledge synthesis:
      1. **Topic research and analysis (`tpl-research`)** – a structured write-up of a topic split into theses, evidence, analysis, and sources.
      2. **Technology/tool comparison (`tpl-tech-comparison`)** – a feature table, selection criteria, pros, cons, and scenario-based recommendations.
      3. **Explaining technical/scientific concepts (`tpl-concept-explainer`)** – the Feynman method: from an intuitive analogy (ELI5), through a formal definition, to examples and common myths.
      4. **Market/industry analysis (`tpl-market-analysis`)** – market size (TAM/SAM), growth dynamics, trends, a competitive landscape map, and strategic conclusions.
      5. **Biographies/history of events (`tpl-biography-history`)** – a timeline, the context of the era, achievements/consequences, and a historical assessment.
      6. **"How it works" documentation for a technology (`tpl-tech-how-it-works`)** – a technical breakdown of how a library, protocol, or engine works (pipeline, architecture, algorithms under the hood).
      7. **Literature reviews / research summaries (`tpl-literature-review`)** – an academic review of publications with a synthesis table of methodology, findings, and research gaps.
    - All templates have dedicated system prompts (`systemInstructions`), defined Markdown skeletons, and full translations in all 12 languages.

15. **Safe rendering and formatting of Markdown tables (comparison table)**:
    - **Root cause**: the previous citation-highlighting algorithm for `[1], [2]` matched text across column delimiters `|`, injecting `<span className="citation-wrapper">...</span>` tags at the start of a row, which broke table syntax in the Markdown parser (`markdown-to-jsx`). In addition, overly long paragraphs generated inside cells caused the table to stretch awkwardly.
    - **Fix architecture**:
      - **Table- and code-block-safe parser (`ScratchpadEditor.tsx`)**:
        - Line-by-line parsing that detects code blocks (` ``` `) and leaves code text unmodified.
        - Header delimiter rows (`| :--- | :--- |`) are ignored.
        - In table rows, cell processing happens strictly within the `|...|` boundaries without disturbing the pipe characters.
      - **Dedicated table components in `markdown-to-jsx` (`ScratchpadEditor.tsx`, `ScratchpadChat.tsx`, `ScratchpadVersionHistory.tsx`)**:
        - The `table` container is wrapped in a responsive scroll area (`overflow-x-auto rounded-xl border`), preventing it from pushing the editor out of shape in split mode (`split`).
        - `thead` / `th` header styling with clear emphasis and `whitespace-nowrap`.
        - Word wrapping (`break-words`) and top alignment for `td` cells (`align-top`).
      - **AI prompt rules (`chat/route.ts` & `builtinTemplates.ts`)**:
        - A cell-conciseness rule (keywords, metrics, statuses instead of long blocks of text).
        - Detailed descriptions, pros, and cons are moved to dedicated sections below the table.
        - Raw newline characters inside table cells are strictly forbidden, and pipe characters must be escaped (`\|` or `` ` ``...`` ` ``).
