# Search & Streaming Resilience

This document describes the architecture and the mechanisms implemented to prevent queries from hanging, infinite loading states (Brainstorming / Answer), and chat threads getting stuck.

---

## 1. Anatomy of the Problem

Before these fixes were implemented, the application had the following weaknesses:
1. **Client-side SSE stream loop with no error handling (`useChat.tsx`)**:
   - Network exceptions (a dropped internet connection, a backend restart) were not caught, which left `loading = true` set permanently and blocked input.
2. **404 errors ignored in the `checkReconnect` procedure**:
   - After a container restart or the expiry of an in-memory session, the `/api/reconnect/[id]` endpoint returned 404, but the client tried to parse it as a stream anyway, leaving the message stuck in the `answering` state forever.
3. **Silent disconnection of idle TCP connections**:
   - During long research runs involving SearXNG / scraping, the lack of data packets for 30-60s caused proxies (Cloudflare, Nginx, Docker) to close the connection.
4. **No error-state rendering in `MessageBox.tsx`**:
   - A backend error occurring after results had been found caused the toast to disappear and left an empty screen ("No response").
5. **No user controls (Stop / Retry / Edit / Delete)**:
   - The user had no way to interrupt a hung query, retry it, or delete a broken question.

---

## 2. Implemented Resilience Mechanisms

### A. SSE Heartbeat / Ping (Backend)
- A periodic heartbeat that sends a `{"type":"ping"}` event every 15 seconds was implemented in `src/app/api/chat/route.ts` and `src/app/api/reconnect/[id]/route.ts`.
- This prevents proxies, routers, and browsers from putting the connection to sleep or closing it.
- The safe `safeWrite` and `safeClose` methods prevent `write after end` errors when a socket is dropped.

### B. Client: Watchdog, AbortController, and Stop Generating (Frontend)
- Every request in `useChat.tsx` has an `AbortController` tied to the **Stop** button in `MessageInput.tsx`.
- While generating (`loading === true`), the send arrow turns into a red "Stop" button, allowing generation to be interrupted immediately.
- A **watchdog timer (90s)** was added: if no SSE packet at all (not even a ping) arrives within 90 seconds, the request is automatically aborted with a timeout error instead of hanging forever.
- The streaming loop is now fully wrapped in a `try / catch / finally` block, guaranteeing that the `loading` flag is always reset.

### C. Safe Session Resumption (`checkReconnect`)
- `res.ok` verification: if the backend returns 404 (the in-memory session no longer exists), the client immediately sets `loading = false` and the message status changes to `'error'`.
- Automatic correction (`auto-recovery`) was added to `GET /api/chats/[id]`: if a message in the database has status `answering` but the in-memory session no longer exists, the status is immediately updated to `'error'`.

### D. Error Panel and Message Actions (`MessageBox.tsx`)
- A visible error panel is now shown whenever a message has `status === 'error'` or produced no content.
- Three direct actions are provided:
  - **Retry**: re-runs the query.
  - **Edit prompt**: copies the query back into the text field and removes the failed attempt.
  - **Delete message**: removes the message from the thread and from the database via the `DELETE /api/chats/[id]/messages/[messageId]` endpoint.
- The `Edit` and `Delete` buttons are also available in the bottom bar of every generated message.

### E. Model and SearXNG Resilience (Agent & Models)
- In `Researcher.ts`: `try / catch` was added around the iteration loop. If the search has already found results (e.g. 82 results) and the next model iteration throws an error (rate limit, tool call error), the researcher safely falls through to synthesizing an answer from the material gathered so far.
- In `socialSearch.ts`: fallback engines (`hackernews`, `stackexchange`) were added so that a failure of the Reddit engine no longer blocks the search.
- In `openaiLLM.ts`: compatibility with the Google Gemini API was fixed (a safe `content: ''` for assistant messages carrying `tool_calls`, and preserving the correct `tool_call_id`).
