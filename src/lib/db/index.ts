import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import * as schema from './schema';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const sqlite = new Database(path.join(DATA_DIR, './data/db.sqlite'));

// `next build` collects page data by importing every route module in several parallel
// worker processes. Each import would otherwise re-run the schema initialization below
// concurrently in every worker, racing on the same data/db.sqlite file. None of that
// build-time analysis actually serves a request, so it's safe to skip entirely and let
// the first real request (`yarn start` / Docker) initialize it once.
const isBuildPhase = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

// Auto-migrate essential columns if tables were created previously without them
if (!isBuildPhase) {
  try {
    sqlite.exec('ALTER TABLE chats ADD COLUMN userId TEXT;');
  } catch {}
  try {
    sqlite.exec('ALTER TABLE chats ADD COLUMN waypointId TEXT;');
  } catch {}
  try {
    sqlite.exec('ALTER TABLE model_stats ADD COLUMN userId TEXT;');
  } catch {}
  try {
    sqlite.exec('ALTER TABLE model_stats ADD COLUMN apiKeyId TEXT;');
  } catch {}
  try {
    sqlite.exec("ALTER TABLE model_stats ADD COLUMN source TEXT DEFAULT 'ui';");
  } catch {}
  try {
    sqlite.exec("ALTER TABLE chats ADD COLUMN sources TEXT DEFAULT '[]';");
  } catch {}
  try {
    sqlite.exec("ALTER TABLE chats ADD COLUMN files TEXT DEFAULT '[]';");
  } catch {}
  try {
    sqlite.exec(
      "ALTER TABLE waypoint_crons ADD COLUMN timezone TEXT DEFAULT 'UTC';",
    );
  } catch {}
  try {
    sqlite.exec("ALTER TABLE scratchpads ADD COLUMN type TEXT DEFAULT 'note';");
  } catch {}
  try {
    sqlite.exec(
      "ALTER TABLE scratchpads ADD COLUMN metadata TEXT DEFAULT '{}';",
    );
  } catch {}

  // Ensure tables exist immediately on database connection
  try {
    // Check if api_keys has a foreign key to users and safely migrate if needed
    try {
      const fks = sqlite
        .prepare('PRAGMA foreign_key_list(api_keys);')
        .all() as any[];
      const hasUserFk = fks && fks.some((fk: any) => fk.table === 'users');
      if (hasUserFk) {
        sqlite.exec(`
        CREATE TABLE IF NOT EXISTS api_keys_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          key_prefix TEXT NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
          token_limit_per_day INTEGER,
          allowed_providers TEXT DEFAULT '["*"]',
          allowed_models TEXT DEFAULT '["*"]',
          default_waypoint_id TEXT,
          last_used_at TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO api_keys_new SELECT * FROM api_keys;
        DROP TABLE api_keys;
        ALTER TABLE api_keys_new RENAME TO api_keys;
      `);
      }
    } catch {}

    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
      token_limit_per_day INTEGER,
      allowed_providers TEXT DEFAULT '["*"]',
      allowed_models TEXT DEFAULT '["*"]',
      default_waypoint_id TEXT,
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  } catch (e) {
    console.warn('Failed to auto-create api_keys table:', e);
  }
  try {
    sqlite.exec(`
    CREATE TABLE IF NOT EXISTS waypoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'Waypoints',
      system_instructions TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS waypoint_crons (
      id TEXT PRIMARY KEY,
      waypoint_id TEXT NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      prompt TEXT NOT NULL,
      sources TEXT DEFAULT '[]',
      optimization_mode TEXT NOT NULL DEFAULT 'balanced',
      chat_model_provider TEXT NOT NULL,
      chat_model_key TEXT NOT NULL,
      embedding_model_provider TEXT,
      embedding_model_key TEXT,
      system_instructions TEXT,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      last_status TEXT,
      last_error TEXT,
      last_chat_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  } catch (e) {
    console.warn('Failed to auto-create waypoints or waypoint_crons table:', e);
  }
} // end !isBuildPhase

export const ensureWaypointsTable = () => {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS waypoints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'Waypoints',
        system_instructions TEXT,
        user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    try {
      sqlite.exec('ALTER TABLE chats ADD COLUMN waypointId TEXT;');
    } catch {}
  } catch (e) {
    console.warn('ensureWaypointsTable error:', e);
  }
};

export const ensureWaypointCronsTable = () => {
  ensureWaypointsTable();
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS waypoint_crons (
        id TEXT PRIMARY KEY,
        waypoint_id TEXT NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        schedule TEXT NOT NULL,
        prompt TEXT NOT NULL,
        sources TEXT DEFAULT '[]',
        optimization_mode TEXT NOT NULL DEFAULT 'balanced',
        chat_model_provider TEXT NOT NULL,
        chat_model_key TEXT NOT NULL,
        embedding_model_provider TEXT,
        embedding_model_key TEXT,
        system_instructions TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        last_status TEXT,
        last_error TEXT,
        last_chat_id TEXT,
        user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    try {
      sqlite.exec(
        "ALTER TABLE waypoint_crons ADD COLUMN timezone TEXT DEFAULT 'UTC';",
      );
    } catch {}
  } catch (e) {
    console.warn('ensureWaypointCronsTable error:', e);
  }
};

export const ensureScratchpadTables = () => {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS scratchpad_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'FileText',
        content TEXT NOT NULL,
        system_instructions TEXT,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scratchpads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'note',
        metadata TEXT DEFAULT '{}',
        user_id TEXT,
        waypoint_id TEXT,
        template_id TEXT,
        sources TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scratchpad_versions (
        id TEXT PRIMARY KEY,
        scratchpad_id TEXT NOT NULL REFERENCES scratchpads(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        prompt TEXT,
        sources TEXT DEFAULT '[]',
        author TEXT NOT NULL DEFAULT 'ai',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scratchpad_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scratchpad_id TEXT NOT NULL REFERENCES scratchpads(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL,
        role TEXT NOT NULL,
        query TEXT NOT NULL,
        response_blocks TEXT DEFAULT '[]',
        sources TEXT DEFAULT '[]',
        selected_text TEXT,
        created_at TEXT NOT NULL
      );
    `);

    try {
      sqlite.exec(
        "ALTER TABLE scratchpads ADD COLUMN type TEXT DEFAULT 'note';",
      );
    } catch {}
    try {
      sqlite.exec(
        "ALTER TABLE scratchpads ADD COLUMN metadata TEXT DEFAULT '{}';",
      );
    } catch {}

    // Seed default built-in templates
    const now = new Date().toISOString();
    const obsoleteBuiltins = [
      'tpl-techspec',
      'tpl-learning',
      'tpl-study',
      'tpl-meeting',
      'tpl-article',
    ];
    for (const oldId of obsoleteBuiltins) {
      sqlite
        .prepare(
          'DELETE FROM scratchpad_templates WHERE is_builtin = 1 AND id = ?',
        )
        .run(oldId);
    }

    const insertOrReplaceTpl = sqlite.prepare(`
      INSERT OR REPLACE INTO scratchpad_templates (id, name, description, icon, content, system_instructions, is_builtin, user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)
    `);

    const defaultTemplates = [
      {
        id: 'tpl-research',
        name: 'Research & Topic Analysis',
        description:
          'A structured treatment of a topic broken down into theses, evidence, analysis, and sources.',
        icon: 'Sparkles',
        content: `# Research & Analysis: [Topic]

## 1. Introduction & Context
Introduction to the topic and the purpose of this write-up.

## 2. Key Theses & Findings
- **Main finding 1**: Description and significance
- **Main finding 2**: Description and significance

## 3. Detailed Substantive Analysis
An in-depth treatment of the topic backed by data and facts.

## 4. Conclusions & Recommendations
Summary of the most important conclusions and potential directions for further research.
`,
        systemInstructions:
          'Write the research note precisely, analytically, and backed by facts. Always verify sources and include citations in the content.',
      },
      {
        id: 'tpl-tech-comparison',
        name: 'Technology / Tool Comparisons',
        description:
          'A comparative breakdown of technologies or tools with a criteria table, pros, cons, and selection recommendations.',
        icon: 'Scale',
        content: `# Comparison: [Technology A] vs [Technology B]

## 1. Executive Summary (TL;DR)
A brief synthesis of the key differences and a final recommendation for typical scenarios.

## 2. Feature Comparison Table
| Criterion / Feature | [Technology A] | [Technology B] |
| :--- | :--- | :--- |
| **Core paradigm / model** | ... | ... |
| **Performance & resource usage** | ... | ... |
| **Learning curve (DX)** | ... | ... |
| **Ecosystem & community** | ... | ... |
| **License & cost** | ... | ... |

## 3. Detailed Analysis: [Technology A]
- **Strengths (Pros)**:
  - Pro 1: description
  - Pro 2: description
- **Limitations & weaknesses**:
  - Con 1: description

## 4. Detailed Analysis: [Technology B]
- **Strengths (Pros)**:
  - Pro 1: description
  - Pro 2: description
- **Limitations & weaknesses**:
  - Con 1: description

## 5. Decision Recommendations (When to choose what?)
- **Choose [Technology A] when**:
  - Condition 1
  - Condition 2
- **Choose [Technology B] when**:
  - Condition 1
  - Condition 2
`,
        systemInstructions:
          'Write objective, technically precise comparisons. Lay out key metrics in a clear markdown table, avoid bias, and give concrete trade-offs for each solution.',
      },
      {
        id: 'tpl-concept-explainer',
        name: 'Technical / Scientific Concept Explainers',
        description:
          'A multi-level explanation of a concept, from an intuitive analogy through a formal definition to examples and myths.',
        icon: 'Lightbulb',
        content: `# Concept: [Concept / Phenomenon Name]

## 1. The Intuition, in Plain Words (ELI5 / Analogy)
An intuitive explanation of the concept using a real-life analogy, understandable without specialist knowledge.

## 2. Formal Definition & How It Works
A precise definition, the underlying mathematical/architectural principles, and the key components.

## 3. Practical Examples & Applications
Concrete real-world examples, code snippets, or formulas showing the concept in action.

## 4. Common Misconceptions & Myths
- **Myth**: A widespread but incorrect belief.
  - *Facts*: Why reality looks different.

## 5. Summary & Related Topics
A concise takeaway in 2-3 sentences, plus a list of related concepts worth exploring further.
`,
        systemInstructions:
          'Explain difficult topics using the Feynman technique: from an intuitive analogy, through a formal definition, to examples and debunking myths.',
      },
      {
        id: 'tpl-market-analysis',
        name: 'Market / Industry Analysis',
        description:
          'A comprehensive study of a market, its trends, growth dynamics, competition, and barriers to entry.',
        icon: 'TrendingUp',
        content: `# Market Analysis: [Sector / Industry / Niche]

## 1. Market Size & Growth Dynamics
Estimated market value (TAM/SAM/SOM), CAGR figures, and the industry's current maturity stage.

## 2. Key Trends & Growth Drivers
- **Technology trend**: Impact of innovation on the sector.
- **Market / consumer trend**: Shifting customer needs.
- **Macro & regulatory factors**: Legislation and economic conditions.

## 3. Competitive Landscape & Key Players
| Segment / Player | Market Position | Key Advantages | Weaknesses |
| :--- | :--- | :--- | :--- |
| **Market leader** | ... | ... | ... |
| **Innovative challenger** | ... | ... | ... |

## 4. Opportunities, Threats & Barriers to Entry
- **Market opportunities**: Underserved niches and expansion potential.
- **Risks & threats**: Factors that could slow growth.
- **Barriers to entry**: Capital, technology, certifications.

## 5. Outlook & Strategic Conclusions
The direction the industry is heading over a 3-5 year horizon, plus strategic recommendations.
`,
        systemInstructions:
          'Produce rigorous, data-driven market analyses backed by business metrics and trends. Categorize competitors, assess market dynamics, and formulate actionable strategic conclusions.',
      },
      {
        id: 'tpl-biography-history',
        name: 'Biographies / Historical Events',
        description:
          "A chronological, contextual account of a person's life or the origins and course of a key historical event.",
        icon: 'History',
        content: `# Profile: [Person's Full Name / Event Name]

## 1. Introduction & Historical Significance
Who this person was, or what this event was, and why it matters to history / the field.

## 2. Timeline & Key Dates
- **[Year / Date]**: Turning point 1 - description of the event.
- **[Year / Date]**: Turning point 2 - description of the event.
- **[Year / Date]**: Turning point 3 - description of the event.

## 3. Era & Causes (Context)
The social, political, scientific, or cultural conditions that shaped the course of events.

## 4. Main Achievements / Course of Events & Consequences
An in-depth analysis of the person's body of work, or the immediate and long-term consequences of the event.

## 5. Legacy, Impact & Modern-Day Assessment
How the person/event is viewed today, historical conclusions, and its influence on the present.
`,
        systemInstructions:
          'Maintain a strict chronology of facts, historical accuracy, and a neutral, reliable narrative tone. Emphasize causes and effects, and the context of the era.',
      },
      {
        id: 'tpl-tech-how-it-works',
        name: '"How It Works" Technical Deep-Dives',
        description:
          'A technical breakdown of how a technology, protocol, or library works under the hood.',
        icon: 'Cpu',
        content: `# How It Works Under the Hood: [Technology / Tool Name]

## 1. Architecture Overview & Purpose
A brief explanation of what the technology does, what problems it solves, and its high-level architecture.

## 2. Key Components & Internal Modules
- **Component 1 (e.g. Engine / Core)**: Its role in processing and responsibilities.
- **Component 2 (e.g. Storage / Cache)**: Storage and synchronization mechanism.
- **Component 3 (e.g. Protocol / Network)**: The communication layer.

## 3. Step-by-Step Processing Flow (Lifecycle / Pipeline)
1. **Initialization / Input**: What happens after an event or command is received.
2. **Transformation / Processing**: Internal data flow and business logic.
3. **Output / Persistence**: Returning the response and persisting state.

## 4. Internal Data Structures & Algorithms
A description of the key algorithms (e.g. indexing, consensus, memory optimizations).

## 5. Best Practices, Optimizations & Pitfalls
Integration and performance tips, plus common bottlenecks.
`,
        systemInstructions:
          'Write from the perspective of a software engineer / architect. Explain the data flow step by step (under the hood), internal modules, algorithms, and performance considerations.',
      },
      {
        id: 'tpl-literature-review',
        name: 'Literature Reviews / Research Summaries',
        description:
          'A review of academic publications and research in a field, synthesizing methodology, findings, and research gaps.',
        icon: 'BookOpen',
        content: `# Literature & Research Review: [Research Area]

## 1. Review Purpose & Selection Criteria
Defining the research question and the criteria used to select the analyzed publications and sources.

## 2. Summary Table of Reviewed Works
| Author(s) & Year | Title / Source | Methodology Used | Key Findings |
| :--- | :--- | :--- | :--- |
| **[Researcher 1 (2024)]** | [Publication title] | Quantitative study / Experiment | Key result |
| **[Researcher 2 (2023)]** | [Publication title] | Meta-analysis / Review | Key result |

## 3. Main Theoretical Threads & Points of Contention
- **Dominant paradigm**: Findings shared by most researchers.
- **Controversies & discrepancies**: Areas of conflicting results.

## 4. Identified Research Gaps
What existing publications have not yet explained, and what questions remain open.

## 5. Synthesis & Final Conclusions
A summary of the state of knowledge, plus theoretical and practical implications.
`,
        systemInstructions:
          'Produce a rigorous, academic literature review. Categorize methodologies, rigorously cite sources [1], [2], identify research gaps, and lay out conclusions in synthesis tables.',
      },
    ];

    for (const tpl of defaultTemplates) {
      insertOrReplaceTpl.run(
        tpl.id,
        tpl.name,
        tpl.description,
        tpl.icon,
        tpl.content,
        tpl.systemInstructions,
        now,
        now,
      );
    }
  } catch (e) {
    console.warn('ensureScratchpadTables error:', e);
  }
};

// Ensure scratchpad tables on initial load
if (!isBuildPhase) {
  ensureScratchpadTables();
}

const db = drizzle(sqlite, {
  schema: schema,
});

export { sqlite };
export default db;
