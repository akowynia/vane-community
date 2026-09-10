# Architecture Concept: Roles (RBAC), Credential Vault, Network Access, 5h/Weekly Limits, and the Sidebar Panel

## 1. Functional Requirements

1. **Sidebar Icon and Management Panel**:
   - Below the Settings icon in the left sidebar (`src/components/Sidebar.tsx`) there is a dedicated button, available to administrators: **Manage LLM access, passwords, and limits** (icon `ShieldCheck` or `Users`).
   - It opens a modal / dedicated admin panel:
     - **Accounts and passwords**: a list of users, account creation/editing, changing the administrator's and users' passwords.
     - **Model and provider access**: granular control over which providers (OpenAI, Ollama Cloud, Anthropic, etc.) and specific models a given user can access.
     - **Advanced usage limits**:
       - A **5-hour** limit (a rolling 5-hour window).
       - A **weekly** limit (a 7-day window).
       - A daily limit and a per-request limit.
       - Limit configuration for both logged-in users and unauthenticated guests.

2. **Current-usage Preview in the Model Selector (ChatModelSelector)**:
   - In the chat's model selector (`ChatModelSelector.tsx`), the user sees a neat indicator of their current usage:
     - Usage within the 5-hour window (e.g. `14,250 / 50,000 tokens (5h)`).
     - Usage within the weekly window (e.g. `82,000 / 250,000 tokens (week)`).
     - A progress bar and a percentage usage indicator.
     - When approaching the limit: a visual warning (amber/red color).

3. **Clean Start and a Multi-language Setup Wizard (3 steps)**:
   - **No 403 errors in Docker**: as long as configuration isn't complete (`!setupComplete`), the app always serves the Setup Wizard.
   - **Language selector in the top-right corner**: from the very first second, the user can pick their language (PL, EN, DE, FR, ES, etc.), and the entire app and wizard immediately switch dictionaries.
   - **Step 1 (Mode & Network)**: a simple choice:
     - *Just me (Single-User)*: no passwords on localhost, instant progression.
     - *Multiple users (Multi-User)*: an inline expansion of the admin-account form and guest policy.
     - A network-exposure toggle (*Ollama style*): in Single-User mode, enabling it inline asks for an administrator password.
   - **Step 2 (Connections)**: adding providers (including the new **Ollama Cloud** category), the AES-256-GCM vault, and dynamic model fetching.
   - **Step 3 (Models)**: model selection and launch.

4. **Cryptography and the Credential Vault (AES-256-GCM)**:
   - Sensitive data is stored in `data/config.json` in `enc:v1:...` format.
   - The key lives in `data/vault.key` (mode 0600) or comes from the `VAULT_SECRET` environment variable.
   - Passwords are hashed using the OWASP `scrypt` standard ($N=32768, r=8, p=1$) plus `timingSafeEqual`.
   - Sliding-window rate limiting on `/api/auth/login` (5 attempts / 15 min per IP).

---

## 2. SQLite Database Data Model (Drizzle)

```ts
// users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('member'), // 'admin' | 'member'
  status: text('status').notNull().default('active'),
  allowedProviders: text('allowed_providers', { mode: 'json' }).$type<string[]>(),
  allowedModels: text('allowed_models', { mode: 'json' }).$type<string[]>(),
  tokenLimit5h: integer('token_limit_5h'),         // NEW: 5-hour limit
  tokenLimitWeekly: integer('token_limit_weekly'), // NEW: weekly limit
  tokenLimitPerDay: integer('token_limit_per_day'),
  tokenLimitPerMonth: integer('token_limit_per_month'),
  maxTokensPerRequest: integer('max_tokens_per_request'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// modelStats, linked via userId
export const modelStats = sqliteTable('model_stats', {
  // ... existing fields ...
  userId: text('user_id'),
});
```

---

## 3. Time-window Limit Calculation (RBAC)

In `src/lib/security/rbac.ts`:
- `checkTokenUsage(user)` computes:
  1. `tokensLast5h`: the sum of `totalTokens` from `modelStats` where `createdAt >= now - 5 hours` for the given user/guest.
  2. `tokensWeekly`: the sum of `totalTokens` from `modelStats` where `createdAt >= now - 7 days`.
  3. `tokensLast24h` and `tokensThisMonth`.
  4. Flags: `limit5hExceeded`, `limitWeeklyExceeded`, `dayLimitExceeded`, `monthLimitExceeded`.

---

## 4. New UI Components and Endpoints

1. **UI components**:
   - `src/components/Sidebar.tsx`: the LLM access/passwords/limits management button, placed **directly below the Settings icon** (visible to admins), plus a profile/login button in the bottom bar.
   - `src/components/Settings/AccessControlDialog.tsx`: a dedicated modal with 4 tabs: Accounts & Passwords, Model/Provider Access, 5h/Weekly/Daily Limits, Network & AES-256-GCM Vault.
   - `src/components/MessageInputActions/ChatModelSelector.tsx`: a token-usage indicator for the 5-hour and weekly windows, with a colored progress bar.
   - `src/components/Auth/LoginDialog.tsx`: the login and account-switching modal for Multi-User.
   - `src/components/Setup/SetupWizard.tsx`: a floating language selector, present from the very first second, in the top-right corner.
   - `src/components/Setup/SetupConfig.tsx`: the 3-step wizard (Mode & Network -> API Connections -> Model Selection).

2. **API endpoints**:
   - `GET/POST /api/auth/login`, `/api/auth/logout`, `/api/auth/me`
   - `GET/POST/PUT/DELETE /api/users` and `/api/users/[id]`
   - `POST /api/config/network-exposure`
   - `POST /api/config/admin-password` (directly setting/changing the administrator password)
   - `POST /api/providers/[id]/refresh`

---

## 5. Access Panel, Localization, and Navigation Improvements (Version 2.1)

1. **Multi-language support (i18n)**:
   - The `AccessControlDialog.tsx` panel and the sidebar elements (`Sidebar.tsx`) fully use the `t('accessControl...')` translation system, with full support for Polish (`pl.ts`) and English (`en.ts`).
2. **Switching Single-User <-> Multi-User**:
   - A direct instance-mode switch placed in the header and the Users tab.
   - In Multi-User mode, authentication is enforced, chat sessions are isolated per user, and permissions/limits apply per user.
3. **Password in Solo Mode**:
   - A Single-User-mode user can directly set or change the administrator password without needing to enable network exposure.
   - The password is safely hashed with OWASP `scrypt` and stored in `auth.adminPasswordHash`.
4. **Provider and Ollama Visibility**:
   - The provider list merges data from active processes (`/api/providers`) with the configuration stored in `config.modelProviders`. This means a configured local Ollama instance is always visible in the panel, even if the service is temporarily unresponsive.
   - In Single-User mode, the requirement to pick a database user was removed — the panel now presents instance-wide global access instead.
5. **Global Limits (instance-wide)**:
   - A global-limits section was added to the "Usage Limits" tab: rolling 5h, 7-day, and 24h windows, plus a per-request limit.
   - Stored in `config.globalLimits` and factored into the `checkTokenUsage` calculation.
6. **Eliminating Navigation Stutter**:
   - Uncontrolled manipulation of the `window.history.pushState` object in `useChat.tsx` and `Sidebar.tsx` was removed.
   - Navigation between the `/discover`, `/statistics`, `/library`, and `/` views now works smoothly through the standard Next.js App Router, without a page reload.

---

## 6. First-run Wizard and Admin Security Improvements (Version 2.2)

1. **Safe Loading of the Library (`/library`) on a Fresh Database**:
   - The case of a fresh install with no chats in the database is now handled. `res.ok` verification, safe `Array.isArray(data.chats)` fallbacks, and `chats?.length` validation were added, guarding against `Cannot read properties of undefined (reading 'length')`.

2. **Default Ollama Address for the Docker Container (`http://host.docker.internal:11434`)**:
   - The default address `http://host.docker.internal:11434` was set in the provider definition (`src/lib/models/providers/ollama/index.ts`) and in the `AddProviderDialog.tsx` form.
   - This makes it easy to connect to an Ollama instance running on the host from inside a Docker container, without manually entering the network address.

3. **Fixing the "Test Connection" Button in the Wizard (SSRF Bypass for Local Providers)**:
   - In `src/app/api/diagnostics/provider/route.ts`, `providerType` is now passed to the `validateProviderBaseURL(url, providerType)` validation function.
   - Local providers (`ollama`, `lmstudio`, `local`) are exempted from the private/local address block (`host.docker.internal`, `127.0.0.1`, `localhost`), so the "Test connection" feature in the wizard correctly verifies connectivity and measures latency.

4. **Eliminating Back-navigation Errors in the Wizard**:
   - In `UpdateProviderDialog.tsx`, reading `modelProvider?.config[field.key]` was guarded against `TypeError: Cannot read properties of undefined`.
   - In `SetupConfig.tsx`, safe optional chaining (`configSections?.modelProviders`) was added, along with a translated back button (`t('setup.back')`).
   - In `ModelSelect.tsx`, the appearance of a `"null/null"` value in the model-selector state when returning from advanced steps was eliminated.

5. **Enforcing a Custom Administrator Name (Banning "admin") and Password Confirmation When Switching to Multi-User**:
   - A dedicated endpoint, `POST /api/users/setup-multiuser-admin`, was created:
     - It requires a custom username (rejecting the default `admin`).
     - It validates the username format (`[a-z0-9_-]+`, 3-32 characters).
     - It requires a password of at least 8 characters plus a `confirmPassword` field, and verifies they match.
     - It hashes the password with OWASP `scrypt`, creates the administrator account in SQLite, sets `instanceMode = 'multi'`, generates an HMAC SHA-256 `vane_session` cookie, and activates the permissions.
   - Both in Step 1 of the wizard (`SetupConfig.tsx`) and in the mode-switch dialog in Settings (`AccessControlDialog.tsx`), the user is required to provide a new administrator name and enter the password twice.

6. **Securing Access and Settings After Logout (Eliminating a Critical Error)**:
   - **Root cause**:
     - In `Sidebar.tsx`, the `isAdmin` flag was computed as `currentUser?.role === 'admin' || !currentUser`. As a result, after logging out (`currentUser === null`) in Multi-User mode, the user was incorrectly treated as an administrator, and the "Access Control" button remained visible and clickable.
     - Clicking the "Settings" or "Access Control" button sent a request to `/api/config`. In Multi-User mode, the middleware blocked this request with a `403 Forbidden` status, which caused `SettingsDialogue.tsx` to try reading `config.fields[...]` from the error object, throwing a `TypeError` and triggering `app/global-error.tsx` (a critical application error).
   - **Solution implemented**:
     - `Sidebar.tsx` now fetches the `instanceMode` state. The `isAdmin` flag takes the mode into account: `currentUser?.role === 'admin' || (instanceMode === 'single' && !currentUser)`. After logging out in Multi-User mode, the user is no longer treated as an administrator.
     - The "Access Control" button is now completely hidden for unauthenticated users and for team members without the admin role.
     - After logout, the "Settings" button in the sidebar shows a message that administrator login is required and immediately opens the login modal instead of causing an error.
     - `SettingsDialogue.tsx` and `AccessControlDialog.tsx` now safely handle `401` and `403` status codes, guard access to the `config?.fields` and `config?.values` objects with optional chaining, and show a neat "no permission" screen with a button to log in directly to an administrator account.

---

## 7. Standardizing and Fixing Network Exposure (Version 2.3)

1. **Root cause**:
   - The `/api/config/network-exposure` endpoint expected an `exposeToNetwork: boolean` field.
   - The frontend components (`AccessControlDialog.tsx` and `SetupConfig.tsx`) sent `{ expose: boolean }` in the request body, so `exposeToNetwork` came through as `undefined`, triggering a `400 Bad Request` validation error with the message `"exposeToNetwork must be a boolean value."`.

2. **Solution implemented**:
   - **Backend (`src/app/api/config/network-exposure/route.ts`)**:
     - Flexible parameter detection was added: both `exposeToNetwork` and `expose` are now accepted (as a fallback).
     - A `GET` method was added, returning the current state of the `exposeToNetwork` flag and `hasAdminPassword`.
   - **Frontend (`AccessControlDialog.tsx`, `SetupConfig.tsx`)**:
     - The `fetch('/api/config/network-exposure')` calls were fixed to send the standard `exposeToNetwork: boolean` field (plus `expose` for backward compatibility).
     - In `AccessControlDialog.tsx`, the `hasAdminPassword` state is now tied to a backend check: if an administrator password has already been configured, enabling network exposure no longer forces the password to be re-entered — the flag is activated immediately. Otherwise, a modal asking for a password of at least 8 characters is shown.

---

## 8. Fixing the Chat Library in Solo and Multi-User Modes (Version 2.4)

1. **Root cause**:
   - **Missing `userId` column in the SQLite `chats` table**:
     In `migrate.ts`, the statement `ALTER TABLE chats ADD COLUMN userId TEXT;` ran *before* the Drizzle migration loop. On a fresh container start, the `chats` table did not yet exist at that point, so the statement failed with an error that was silently swallowed by `catch(e) {}`. The migrations then created the `chats` table without a `userId` column.
     As a result, every Drizzle ORM query against the `chats` table (`db.query.chats.findMany()`, `findFirst()`, `insert()`) threw `SqliteError: no such column: chats.userId`, causing a 500 status from `/api/chats` in both Solo and Multi-User mode, and chats were not being saved to the database at all.
   - **`resolveRequestUser` called on a plain `Request` object**:
     In `rbac.ts`, the `resolveRequestUser` function referenced `req.cookies.get('vane_session')` directly. In route handlers that accept a plain `Request` instead of `NextRequest`, the `cookies` object was `undefined`, throwing a `TypeError`.
   - **`userId` not passed to `ensureChatExists`**:
     In `src/app/api/chat/route.ts`, the `userId: user?.id` identifier was not passed when creating a chat, so chats ended up with `userId: null`, and Multi-User users without the admin role could not see their own threads.
   - **Fragile array fields (`sources` and `files`) on the frontend**:
     `null` values or JSON strings in `chat.sources` or `chat.files` caused a `TypeError: Cannot read properties of null (reading 'length')` while rendering the library component.

2. **Solution implemented**:
   - **Database (`src/lib/db/index.ts`, `src/lib/db/migrate.ts`, `0000_fuzzy_randall.sql`)**:
     - A defensive migration for the `userId TEXT`, `sources`, and `files` columns was added, run both directly when opening the connection in `db/index.ts` and after the migration loop finishes in `migrate.ts`.
     - The `chats` table definition was updated in the `0000_fuzzy_randall.sql` migration file and in step `0002` of `migrate.ts`.
   - **Safe user resolution (`src/lib/security/rbac.ts`)**:
     - `resolveRequestUser` now safely handles both `NextRequest` (`cookies.get`) and a plain `Request` (by manually parsing the `Cookie` header).
   - **Saving chats (`src/app/api/chat/route.ts`)**:
     - The `ensureChatExists` call now passes the `userId: user?.id || null` parameter.
     - The `sources` and `files` arrays are now safely normalized.
   - **Chat endpoints (`src/app/api/chats/route.ts`, `src/app/api/chats/[id]/route.ts`)**:
     - In Multi-User mode, a user sees their own chats (`chats.userId === user.id` or `isNull(chats.userId)`, for backward compatibility), while an administrator has access to everything.
     - Every chat record is now guaranteed to always carry `sources: []` and `files: []` arrays.
   - **Library view (`src/app/library/page.tsx`)**:
     - `safeSources` and `safeFiles`, along with safe formatting of `chat.createdAt`, were added, preventing `TypeError`s in the UI.

---

## 9. Restricting Statistics Access to Administrators Only (Version 2.5)

1. **Requirement**:
   - Statistics (`/statistics` and the `/api/statistics` endpoint) must not be accessible to guests or regular members. They must be available to administrators only.

2. **Safeguards implemented**:
   - **Sidebar and mobile navigation (`src/components/Sidebar.tsx`)**:
     - The statistics link and icon (`LayoutGrid` -> `/statistics`) are conditionally rendered in `navLinks` only when `isAdmin === true`. For guests and regular users in Multi-User mode, the link is completely hidden from both the sidebar and mobile navigation.
   - **Backend endpoint (`src/app/api/statistics/route.ts`)**:
     - A `requireAdmin(req)` guard was added to the `GET` and `DELETE` methods.
     - In Multi-User mode, every request from an unauthenticated user or a non-admin user is rejected with a `403 Forbidden` status (`"Access to this resource requires administrator privileges."`).
   - **Middleware (`src/proxy.ts`, formerly `src/middleware.ts`)**:
     - The `/api/statistics` path was added to `isSensitiveAdminRoute`.
     - A redirect to the home page (`/`) was added for a direct attempt to visit `/statistics` by a non-admin user in Multi-User mode.
   - **Statistics page view (`src/app/statistics/page.tsx`)**:
     - Handling for the `authError` state on `401` and `403` responses was added.
     - When permissions are missing, a neat informational card is shown with a `ShieldAlert` icon, a message about the administrator-account requirement, and a button to return to the home page.
