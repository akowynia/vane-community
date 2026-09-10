# Architecture Concept: Waypoints (Spaces with Personalized System Instructions / Masterprompt)

## 1. Introduction and Purpose

The **Waypoints** feature (the equivalent of *Spaces* in Perplexity AI) lets users create dedicated topical or project spaces. Each Waypoint has its own independent **Masterprompt** (**system instructions**) that automatically governs the AI model's behavior for every thread and query conducted within that Waypoint.

### Key principles:
1. **Multiple independent spaces**: the user can create any number of Waypoints (e.g. *"TypeScript Programming"*, *"Market Research"*, *"Copywriting & Marketing"*, *"Financial Analysis"*).
2. **Individual masterprompt**: every Waypoint has a unique set of system instructions that define the style, perspective, response formatting, constraints, and AI response preferences.
3. **Contextual chat sessions**:
   - When the user enters a given Waypoint, they can ask a question directly.
   - The new chat is automatically linked to that `waypointId`.
   - While generating a response, the search agent (`SearchAgent`) injects that Waypoint's system instructions into the LLM's system prompt.
4. **Knowledge organization**: in the Waypoint view, the user can see all threads and chats belonging to that space.
5. **RBAC and Multi-User compatibility**: in Single-User mode, Waypoints are available locally, while in Multi-User mode each logged-in user manages their own spaces.

---

## 2. Data Model (SQLite Database / Drizzle ORM)

### `waypoints` table
```ts
export const waypoints = sqliteTable('waypoints', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('Waypoints'),
  systemInstructions: text('system_instructions'),
  userId: text('user_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
```

### Relation in the `chats` Table
A `waypointId` column is added to the existing `chats` table:
```ts
export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  userId: text('userId'),
  waypointId: text('waypointId'), // Links the chat to a Waypoint
  sources: text('sources', { mode: 'json' }).$type<SearchSources[]>().default(sql`'[]'`),
  files: text('files', { mode: 'json' }).$type<DBFile[]>().default(sql`'[]'`),
});
```

### Database Migration (`src/lib/db/migrate.ts`)
```sql
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

ALTER TABLE chats ADD COLUMN waypointId TEXT;
```

---

## 3. API Architecture

### 1. `GET /api/waypoints`
- Fetches the list of Waypoints for the current user (taking single/multi-user mode into account).
- Returns the number of chats assigned to each Waypoint (`chatsCount`).

### 2. `POST /api/waypoints`
- Creates a new Waypoint.
- Parameters: `name`, `description`, `icon`, `systemInstructions`.
- Automatically assigns the current user session's `userId`.

### 3. `GET /api/waypoints/[id]`
- Fetches a Waypoint's details and the list of associated chats (`chats`).

### 4. `PUT /api/waypoints/[id]`
- Updates a Waypoint's metadata and the `systemInstructions` content (Masterprompt).

### 5. `DELETE /api/waypoints/[id]`
- Deletes a Waypoint and detaches or removes its associated chats.

### 6. `PATCH /api/chats/[id]`
- Dynamically assigns or detaches an existing chat to/from a Waypoint space (`{ waypointId: string | null }`).
- Lets the user switch spaces mid-thread (via the `WaypointSelector` in the bottom bar) without losing history.

### 7. Masterprompt Injection and Linking in `POST /api/chat`
- The chat request schema carries an optional `waypointId?: string` field.
- `waypointId` is passed reliably by reference and as a direct parameter, preventing the link from being lost during navigation or chat resets.
- If `waypointId` is provided, the server fetches that Waypoint's `systemInstructions` from the database and replaces or extends the `systemInstructions` field passed to the `SearchAgent`.
- `ensureChatExists` reliably and asynchronously saves `waypointId` onto the chat record.

### 7. Multi-User Permission Model and Security (RBAC)
- **Public spaces (`userId: null`)**:
  - Readable and queryable by all users, including unauthenticated guests.
  - Created and edited/deleted only by the instance administrator (`role: 'admin'`).
- **Private spaces (`userId: user.id`)**:
  - Accessible only to the owner and the system administrator.
  - Other users receive an HTTP 403 Forbidden response.
- **Read access for unauthenticated users (`GET /api/waypoints`)**:
  - Returns public spaces, preventing the list from disappearing on refresh (F5).
- **Asking questions and creating spaces without logging in**:
  - Returns a 401 status and triggers the login modal (`LoginDialog`) instead of silently failing.

---

## 4. UI Architecture (UI/UX)

### 1. Sidebar (`src/components/Sidebar.tsx`)
- A new navigation menu entry was added:
  - Icon: `Waypoints` from the `lucide-react` library.
  - Path: `/waypoints`.
  - Label: `Waypoints` (translated via `useTranslation`).
  - Available both on the desktop rail and in the bottom bar on mobile devices.

### 2. Waypoints Home Page (`src/app/waypoints/page.tsx`)
- A neat tile grid representing the user's spaces.
- Each tile shows:
  - An icon with a gradient background matching Vane's style.
  - A visibility badge: *Shared* (blue) or *Private* (gold).
  - A name and short description.
  - Information about the active masterprompt (instruction length / preview).
  - A count of associated chats.
  - Quick actions (open, edit, delete) — shown only to the owner or an administrator (`isOwner`).
- A `+ New Waypoint` button that opens the creation modal (in multi-user mode, for unauthenticated users it opens the login window instead).
- An informational banner for guests with a quick login action.

### 3. Space View (`src/app/waypoints/[id]/page.tsx`)
- A header with a back-to-list link, icon, title, visibility badge, and description.
- Edit and delete actions shown only to authorized users.
- A Masterprompt preview and edit section:
  - A collapsible panel/accordion showing the active system instructions.
  - The ability to edit the system rules immediately.
- **A dedicated query input field with a toolbar identical to the regular chat**:
  - AI model selection (`ModelSelector` from `@/components/MessageInputActions/ChatModelSelector`)
  - Search optimization mode (`Optimization` - Speed / Balanced / Quality)
  - Search source filtering (`Sources` - Web / Academic / Finance)
  - File and document attachments (`Attach`)
  - Submitting a query starts a chat using the selected model and the active Masterprompt.
- Smart handling of authorization states:
  - Code 401: a dedicated view informing about a private space, with a login button (`LoginDialog`).
  - Code 403: a view informing the user they lack permission.
  - Code 404: a message that the space doesn't exist.
- The list of threads and chats conducted within that Waypoint.

### 4. Create/Edit Modal (`CreateEditWaypointDialog.tsx`)
- A form with fields for:
  - **Space name** (e.g. *Market Analysis*)
  - **Short description**
  - **Icon selection** (thematic icons suited to AI use cases)
  - **System instructions (Masterprompt)**: a large multi-line field with an explanation of how the instructions influence the model's response style.
  - **Public space option**: available to instance administrators.

### 5. Integration with the Chat Window (`Navbar.tsx` & `useChat.tsx`)
- When a chat belongs to a Waypoint, the chat header (`Navbar.tsx`) shows a badge with the Waypoint's name and icon; clicking it takes the user to the space view.
- In `useChat.tsx`, the `waypointId` state is carried through the stream, ensuring instruction continuity across subsequent messages in the thread.

---

## 5. Summary of Benefits
- Full modularity and work organization (similar to Perplexity Spaces).
- The ability to build specialized AI assistants with dedicated models and system prompts.
- Full Multi-User mode support (isolation of private spaces, sharing of public spaces, guest login).
- Consistency with Vane's visual style (gold accents `#b8864d`, dark theme, consistent rounding and typography).
