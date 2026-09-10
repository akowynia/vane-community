# Chat Model Selection, Rewrite, and Response Metadata

This document describes the architecture and implementation of three features related to LLM model selection and presenting response telemetry to the assistant.

## 1. Changing the Model in an Ongoing Chat (`MessageInput.tsx`)
- **Goal**: let the user smoothly switch the active LLM model directly while a conversation is in progress, from the bottom query bar.
- **Implementation**:
  - A `<ModelSelector position="top" align="left" />` component was added to `MessageInput.tsx`, next to the optimization modes and attachments.
  - The `ChatModelSelector.tsx` component supports the `position="top"` prop (opens the menu upward, above the query bar) and `align="left"` (anchors the dropdown menu to the left edge, preventing it from being clipped off-screen).
  - Selecting a model updates the `chatModelProvider` state and `localStorage` (`chatModelKey`, `chatModelProviderId`).

## 2. Model Selection in the "Rewrite" Feature
- **Goal**: let the user regenerate a response either instantly with the current model, or by picking any other configured model from a list.
- **Implementation**:
  - The `src/components/MessageActions/Rewrite.tsx` component was rebuilt:
    - The main button with a `Repeat` icon performs an instant rewrite using the current model.
    - A `ChevronDown` arrow opens a popover with a model search box and a list of available models grouped by provider.
    - A `(current)` label marks the active model.
  - In `useChat.tsx`:
    - The `rewrite` and `sendMessage` functions accept an optional `modelOverride?: { key: string; providerId: string }` parameter.
    - Once a model is selected, a request is sent immediately to `/api/chat` with the overridden model, and the new choice is saved as the default.

## 3. Response Metadata (Model, Duration, Token Usage)
- **Goal**: show accurate information about which model produced the response, its generation time in seconds, and the number of tokens consumed.
- **Backend implementation**:
  - `src/lib/types.ts` defines the `MetricsBlock` type:
    ```ts
    export type MetricsBlock = {
      id: string;
      type: 'metrics';
      data: {
        modelKey: string;
        providerId: string;
        durationMs: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };
    ```
  - In `src/lib/agents/search/index.ts`, once the LLM finishes generating a response:
    1. The duration is computed: `totalDurationMs = performance.now() - streamStartTime`.
    2. Prompt and completion tokens are counted via `getTokenCount`.
    3. The metric is recorded in the `model_stats` table via `recordLlmMetric`.
    4. A `metrics` block is sent via `session.emitBlock(metricsBlock)`, which automatically streams it to the client over SSE and stores it in `messages.responseBlocks` in the SQLite database.
  - In `src/app/api/chats/[id]/route.ts`:
    - When chat history is fetched, messages are enriched with records from the `model_stats` table (for backward compatibility with older queries).
- **UI implementation (`MessageBox.tsx`)**:
  - Neat labels (chips) are rendered above the assistant response's action bar:
    - `Cpu` with the model name (e.g. `gemma2:9b`),
    - `Clock` with the response time in seconds (e.g. `2.4s`),
    - `Zap` with the number of tokens consumed (e.g. `428 tok.`).

## 4. PDF Export in the Project's Style, and Responsiveness (`Navbar.tsx`)
- **Problem**: the previous PDF export had page-break bugs (`page-break-inside: avoid` on the whole assistant response block forced the entire content onto page 2 and left blank pages behind), lacked Markdown formatting (raw text was displayed), and the styling was sterile white with no Vane branding.
- **Improvements made**:
  - **Vane's project style**:
    - A header with Vane's vector SVG logo and a `Vane - Community` label.
    - A warm, upscale palette (bronze/gold accents `#b8864d`, subtle card borders `#ede5dc`).
    - User-question cards with a gold left accent (`border-left: 4px solid #b8864d`).
    - An assistant-response card labeled with the role and date.
    - A response telemetry section with the LLM model, generation time, and tokens consumed.
    - A sources (citations) section with numbered badges and hyperlinks.
  - **Responsiveness and print layout**:
    - A container with dynamic scaling, `padding: clamp(16px, 3vw, 36px)` and `max-width: 820px`.
    - Full `@media print` support: the global `break-inside: avoid` was removed from long responses (content now flows smoothly across pages), headings are protected against orphans (`break-after: avoid`), and paragraphs are protected with `orphans: 2; widows: 2`.
  - **Markdown renderer**:
    - Headings (`#`, `##`, `###`), bold, italics, bullet lists, block quotes, links.
    - Code blocks with a dark obsidian theme (`#181513`) and a language header.

### Fix for `<citation>` Tags in PDF and Markdown Export
- The `<citation href="..." title="...">NUM</citation>` marker inserted into `parsedTextBlocks` was being escaped by `escapeHtml`, so the PDF showed raw HTML with the full `href` and `title` attributes.
- A pre-processor was added that extracts citation tags before special-character escaping and formats them as neat, numbered superscript links (`.citation-ref`, `[1]`, `[2]`, etc.) with tooltips and clickable links to the sources.
- In the Markdown export, `<citation>` is now converted to the standard Markdown link format `[NUM](URL)`.

### Multi-language Support (i18n) in PDF and Markdown Export
- An `exportTranslations` dictionary was added, covering the application's 12 languages: `pl`, `en`, `de`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `ru`, `uk`, `zh` (with a fallback to `en`).
- Every element of the document is translated: the report header, the query count, the question number (`Question #N`), the sender label (`Vane Answer`), the sources section, the telemetry labels (`Model`, `Time`, `Tokens`), and the document footer.
- Dates are formatted according to the selected locale (`toLocaleString(locale)`), and the HTML tag receives the proper `<html lang="...">` attribute.
