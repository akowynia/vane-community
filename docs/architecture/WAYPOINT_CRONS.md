# Architecture Concept: Waypoint Crons (Scheduled Jobs Within Spaces)

## 1. Introduction and Purpose

The **Waypoint Crons** feature lets users automatically run recurring searches and AI analyses within dedicated **Waypoints** spaces. Every scheduled job (cron) is tied to a specific Waypoint, inherits its **Masterprompt** (system instructions), has a defined schedule (e.g. daily at a given time, on weekdays, or via a cron expression), and carries a full set of query settings (AI model, search sources, optimization mode).

In addition, a dedicated **Schedules (Crons)** card is available in the **Library** view (`/library`), providing a global overview and management of every scheduled job across every space.

### Key principles:
1. **Linked to a Waypoint space**: a scheduled job is assigned to a specific Waypoint. Every run creates a new chat thread within that space, preserving context and the Masterprompt's rules.
2. **Flexible scheduling**:
   - Ready-made presets: *Daily at a chosen time*, *On weekdays (Mon-Fri)*, *Every Monday*, *Hourly*, *Every 12 hours*.
   - Advanced mode: a standard 5-field cron expression (e.g. `0 8 * * 1-5`).
3. **Complete query settings**:
   - The prompt/query text for the recurring research.
   - AI model selection (provider and model key).
   - Search optimization mode (Speed / Balanced / Quality).
   - Source filters (Web / Academic / Discussions).
   - Optional additional system instructions extending the Masterprompt.
4. **State management and on-demand triggering**:
   - An active/paused toggle.
   - A *Run now* action to test a job on demand at any time.
   - Logging the status of the last run (Success, Error, Running), along with the time and a link to the generated chat.
5. **Dedicated view in the Library (`/library`)**:
   - A tab presenting a unified list of every schedule.
   - Quick filtering, enabling/disabling, editing, and running jobs, all from one place.

---

## 2. Data Model (SQLite Database / Drizzle ORM)

### `waypoint_crons` table
```ts
export const waypointCrons = sqliteTable('waypoint_crons', {
  id: text('id').primaryKey(),
  waypointId: text('waypoint_id')
    .notNull()
    .references(() => waypoints.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  schedule: text('schedule').notNull(),
  prompt: text('prompt').notNull(),
  sources: text('sources', { mode: 'json' })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  optimizationMode: text('optimization_mode').notNull().default('balanced'),
  chatModelProvider: text('chat_model_provider').notNull(),
  chatModelKey: text('chat_model_key').notNull(),
  embeddingModelProvider: text('embedding_model_provider'),
  embeddingModelKey: text('embedding_model_key'),
  systemInstructions: text('system_instructions'),
  timezone: text('timezone').notNull().default('UTC'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastRunAt: text('last_run_at'),
  nextRunAt: text('next_run_at'),
  lastStatus: text('last_status'), // 'success' | 'error' | 'running' | null
  lastError: text('last_error'),
  lastChatId: text('last_chat_id'),
  userId: text('user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

---

## 3. Background Engine Architecture (`src/lib/cron/`)

### 1. Schedule Parser and Calculator with Time Zone Support (`src/lib/cron/parser.ts`)
- Validates and interprets cron expressions (minute, hour, day of month, month, day of week).
- Supports IANA time zones (e.g. `Europe/Warsaw`, `UTC`): `computeNextRun(schedule, fromDate, timezone)` computes the next real-world point in time (a UTC timestamp) taking the user's local time zone into account.
- `describeSchedule(schedule, locale)`: generates a human-readable description of the schedule in the selected language (e.g. *"Daily at 08:30"*).

### 2. Job Executor (`src/lib/cron/executor.ts`)
- The `executeCronJob(cronId)` function:
  - Sets the job status to `running`.
  - Fetches the job configuration and the associated Waypoint with its Masterprompt.
  - Creates a new record in the `chats` table linked to `waypointId` and `userId`.
  - Initializes a `SearchAgent` session, loading the specified LLM and embedding model.
  - Runs the full search and response-generation pipeline.
  - Saves the response blocks to the `messages` table and records token-usage metrics in `model_stats`.
  - Updates `lastRunAt`, sets `lastStatus = 'success'`, `lastChatId`, and computes the new `nextRunAt`.
  - On failure, safely sets `lastStatus = 'error'`, `lastError = message`, and schedules the next run.

### 3. Background Scheduler Worker (`src/lib/cron/scheduler.ts`)
- Started automatically on server startup, in `src/instrumentation.ts`.
- Periodically (every 30-60 seconds) queries the database for active jobs (`enabled = true`) whose `nextRunAt <= now` and `lastStatus != 'running'`.
- Runs jobs asynchronously, preventing the server's main thread from being blocked.

---

## 4. API Architecture

### 1. `GET /api/crons`
- Returns the list of scheduled jobs available to the user, enriched with Waypoint information (`waypointName`, `waypointIcon`, `isPublic`).
- Supports an optional `?waypointId=...` query parameter.

### 2. `POST /api/crons`
- Creates a new scheduled job.
- Fields: `waypointId`, `name`, `schedule`, `prompt`, `sources`, `optimizationMode`, `chatModelProvider`, `chatModelKey`, `embeddingModelProvider`, `embeddingModelKey`, `systemInstructions`, `enabled`.
- Automatically computes the initial `nextRunAt` time.

### 3. `GET /api/crons/[id]`
- Fetches the details of a single scheduled job.

### 4. `PUT /api/crons/[id]`
- Updates the job's configuration and recomputes `nextRunAt`.

### 5. `DELETE /api/crons/[id]`
- Removes a scheduled job from the database.

### 6. `POST /api/crons/[id]/run`
- Forces the job to run immediately (*Run now*), independent of its schedule.
- Returns the id of the created chat (`chatId`).

### 7. `PATCH /api/crons/[id]/toggle`
- Toggles the job's active state (`enabled: true/false`).

---

## 5. User Interface (UI/UX)

1. **Waypoint details view (`src/app/waypoints/[id]/page.tsx`)**:
   - **Chats & Queries** tab: the standard prompt-entry box and a list of chats.
   - **Schedules (Crons)** tab: a dedicated list of the crons tied to that Waypoint, with the ability to add new jobs (`+ Add schedule`), trigger them immediately, enable/disable, and edit them.

2. **Library view (`src/app/library/page.tsx`)**:
   - A tab switcher in the Library header:
     - **Chats**: a list of every query and thread.
     - **Schedules (Crons)**: a combined panel of every scheduled job across every space, with filtering, statistics (active/all), and full management tools.

3. **Create/edit modal (`CreateEditCronDialog.tsx`)**:
   - Waypoint space selection.
   - Job name.
   - A schedule builder with presets (times, days of the week) and an advanced mode.
   - A multi-line prompt field.
   - LLM model, source, and optimization-mode selectors.

---

## 6. Security and Permissions (RBAC & Guest Restrictions)

1. **Guests are denied access (`isGuest = instanceMode === 'multi' && !currentUser`)**:
   - An unauthenticated guest in multi-user mode **sees no** scheduled jobs at all (`GET /api/crons` returns an empty list).
   - A guest **cannot run or modify** any scheduled job (`POST /api/crons/[id]/run`, `PATCH /toggle`, and `POST /api/crons` all return `401 Unauthorized`).
   - In the UI (both the Library and the Waypoint view), attempting to open the Schedules tab shows a dedicated banner inviting the user to log in, with an action button.
2. **Permissions for logged-in users**:
   - A regular logged-in user can only see and run/edit their own jobs, or jobs in their own private spaces.
   - The instance administrator has full visibility and control over every schedule.
