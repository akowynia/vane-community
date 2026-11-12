# Bulk & Selective Deletion Mode

## Overview

Vane-Community provides a unified deletion workflow across list and workspace views, allowing users to remove **individual items**, **arbitrary subsets**, or **all currently visible items** with full confirmation and strict server-side authorization.

### Covered Modules
- **Library — All Chats**: Toggleable selection mode over filtered chat sessions, replacing ad-hoc single deletes with multi-select and bulk confirmation.
- **Schedules (Library & Waypoint Schedules)**: Shared selection mode in the cron schedule list component, supporting deleting individual schedules, selected subsets, or all visible schedules.
- **Batch Search (Library Saved Research & Studio Workspace)**:
  - Saved Batch Research tab in Library supports single and bulk deletion of saved `batch` scratchpad entries.
  - Batch Search Studio replaces browser `window.confirm` prompts with a shared modal dialog (`DeleteConfirmDialog`) for clearing the session or deleting selected queue items, while guarding against mutations during an active search run.
- **Scratchpad**: Selection mode across notes, batch research notes, and presentations with mobile-accessible single delete controls.
- **Waypoints & Waypoint Chats**:
  - Waypoints grid supports bulk deletion for owned spaces while locking non-owned shared spaces out of selection.
  - Waypoint detail chats tab supports bulk chat deletion scoped to user ownership.

> **Scope Exclusion**: Deletion inside active conversation threads (individual message bubbles within an open chat or scratchpad editor) remains intentionally unchanged.

---

## Backend API & Database Architecture

### Bulk Delete Endpoints
Every target resource exposes a batch `DELETE` collection endpoint alongside hardened single-item `DELETE` handlers:

| Resource | Collection Endpoint | Cascading / Related Behavior |
| :--- | :--- | :--- |
| Chats | `DELETE /api/chats` | Deletes matching chats and their `messages`; preserves `model_stats` quota telemetry. |
| Schedules (Crons) | `DELETE /api/crons` | Deletes matching `waypoint_crons` (authorized via cron owner or parent waypoint owner). |
| Scratchpads | `DELETE /api/scratchpad` | Deletes matching `scratchpads`, `scratchpad_versions`, and `scratchpad_messages`. |
| Waypoints | `DELETE /api/waypoints` | Unlinks associated `chats` (`waypoint_id = null`), removes cascading crons, deletes `waypoints`. |

All collection endpoints expect a JSON body `{ "ids": string[] }` validated via Zod (minimum 1 ID, maximum 500 IDs per request, trimmed non-empty strings, automatically deduplicated).

### Response Contract
Bulk `DELETE` handlers return HTTP `200` with:
- `deletedIds`: Array of IDs successfully removed by the authenticated actor.
- `skippedIds`: Array of requested IDs that did not exist or failed ownership/RBAC checks.

This guarantees partial-authorization requests never leak unauthorized side effects while giving the UI deterministic state updates.

### SQLite Chunking & Atomic Transactions
- Requested ID arrays are split into chunks of 150 items before executing SQLite `inArray` queries to stay safely below SQLite bound parameter limits.
- Deletions execute synchronously inside atomic `better-sqlite3` transactions (`db.transaction`) so dependent tables remain consistent even under concurrent requests.
- `model_stats` records are explicitly retained when chats are deleted so usage quotas and token limits remain accurate.

---

## Security Model & RBAC Hardening

1. **Multi-user Authentication Guard**:
   - In `multi` instance mode, `DELETE` operations reject unauthenticated callers (`401`) and `guest` role accounts (`403`).
2. **IDOR Prevention on Single & Bulk Deletes**:
   - Non-admin users can only delete entities whose `user_id` explicitly matches their authenticated user ID.
   - Legacy or orphan entities where `user_id` is `null` are restricted strictly to `admin` users in `multi` mode, preventing horizontal privilege escalation.
   - Cron deletion authorizes against either the cron `user_id` or the parent waypoint `user_id`.
   - Message deletion inside chat threads enforces the same actor and parent chat ownership verification.

---

## Frontend Selection Architecture

### Shared Hook (`useBulkSelection`)
- **Visible-Item Scoping**: Selection state is derived against the currently filtered/visible list so hidden items (filtered out by search or category tabs) are never accidentally deleted.
- **Range Selection (`Shift+Click`)**: Holding `Shift` while toggling an item selects or deselects the contiguous range of selectable items from the last anchor index.
- **Keyboard Escape**: Pressing `Escape` cleanly exits selection mode unless disabled (e.g., inactive tabs).

### Shared UI Components
- **BulkSelectionToolbar**: Displays a compact `Select` trigger when inactive, and expands into selected counter badges, `Select all` / `Deselect all`, `Delete selected (N)`, `Delete all`, and `Cancel` actions when active.
- **SelectionCheckbox**: Accessible checkbox button that stops click propagation and displays an informational tooltip when an item is locked due to ownership rules.
- **DeleteConfirmDialog**: Unified confirmation modal replacing native browser `confirm` dialogs, displaying item counts, loading spinners, and resource-specific warnings.
- **Client Helper (`executeBulkDelete`)**: Handles HTTP `401` login triggers, network/API errors, and localized success or partial-warning toast notifications across all 12 supported locales.

---

## Edge Cases & Testing Checklist

- **Filtered Search / Tabs**: Activating "Select all" or "Delete all" after filtering by search text or category only targets visible matching items.
- **Shared Waypoints**: Public waypoints owned by another user display a disabled selection checkbox and cannot be included in bulk payloads.
- **Quota Preservation**: Deleting chats removes conversation history and messages while leaving aggregate `model_stats` intact.
- **Batch Search Running State**: Bulk removal of queued batch items is blocked while a batch execution loop is actively streaming.
- **Touch / Mobile Accessibility**: Single delete action buttons remain accessible on touch screens without requiring hover states.

