# PDF Export Styles & Branding Customization

The application provides a comprehensive, customizable PDF and print export engine that enables users to tailor the visual appearance, typography, layout, and branding of exported chat transcripts and research notes.

---

## 1. Feature Overview

Users can configure how generated PDF documents look through the application settings, choosing between diverse visual styles as well as toggling brand elements on or off.

### Available Style Variants

1. **Vane Classic (Branded)**
   - Official brand visual identity with signature warm bronze and gold accents.
   - Includes the official SVG logo in the document header and beside assistant messages.
   - Highlights assistant responses with warm cream backgrounds and bronze borders.
   - Displays community attribution in the document footer.

2. **Minimal Neutral (Clean / White-label)**
   - Minimalist, high-contrast monochrome design with subtle slate gray accents.
   - Completely strips all brand logos, brand names, and community mentions.
   - Replaces branded headers with neutral document titles and clean timestamps.
   - Designed for external client distribution, corporate reports, or unbranded publication.

3. **Corporate Executive**
   - Sleek business styling featuring deep navy blue accent lines and ice-blue callout containers.
   - Executive briefing header banner layout with formal section numbering.
   - Sender labeled with professional analytical terminology.
   - Formatted for stakeholder presentations, business meetings, and client briefings.

4. **Academic Paper**
   - Scholarly working paper appearance featuring classic serif typography (Georgia / Times).
   - Double-rule formal monograph header with academic subtitle.
   - Formal section hierarchy with classic paragraph indentation and footnote-style reference lists.
   - Ideal for research reviews, literature syntheses, and academic submissions.

### White-label & Branding Control

In addition to visual style variants, users have explicit control over brand visibility via the independent branding toggle:
- When enabled, official brand marks and attribution are included in supported styles.
- When disabled, all logos, badges, and attribution text are omitted across all document styles, producing completely neutral white-label documents.

---

## 2. Technical Architecture

### Dynamic Stylesheet Generation
The print engine dynamically generates dedicated CSS print stylesheets tailored to the active variant:
- Page geometry (`@page`) configured for standard portrait printing with calibrated margins.
- Media print rules ensuring crisp high-contrast printing, forced background color rendering, and elimination of non-print UI artifacts.
- Intelligent break avoidance (`break-inside: avoid` and `break-after: avoid`) applied to code blocks, tables, diagrams, callouts, and message headers to prevent awkward page splits.
- Variant-specific token injection for fonts, accent colors, container borders, and telemetry badges.

### Multi-turn Chat & Scratchpad Synthesis
Both multi-turn chat exports and single-note Scratchpad exports utilize the unified styling pipeline:
- Markdown inline formatting (bold, italic, links, inline code, and citation references).
- Semantic rendering for GitHub-style alert callouts (Note, Tip, Warning, Important, Caution) with crisp SVG icons.
- Syntax-highlighted code blocks with language indicators.
- Client-side Mermaid diagram rendering to vector graphics before print triggering.
- Automatic bibliography compilation with source numbering, domain chips, and quoted snippets.

### Settings Integration & Visual Previews
The configuration options are integrated seamlessly into the application preferences:
- **Style Variant Selector**: An interactive visual card grid displaying live miniature page mockups for each variant (header accents, user query bubbles, and typography previews) alongside dropdown selection.
- **Branding Switch**: A reactive toggle switch allowing users to enable or disable brand elements with immediate persistence.
- **Client Configuration Sync**: Settings are persisted to client storage and automatically reflected across chat export and Scratchpad print actions.

---

## 3. Localization (i18n)

All configuration options, descriptions, variant names, badges, and document labels are fully localized across all twelve supported interface languages:
- English
- Polish
- German
- Spanish
- French
- Italian
- Portuguese
- Russian
- Ukrainian
- Chinese
- Japanese
- Korean

