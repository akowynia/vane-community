# Model Task Queue and Model-Aware Scheduling

This document describes the architecture of the LLM request queuing system for local providers (`ollama` and `lmstudio`), the model-aware scheduling mechanism (minimizing VRAM reloads), the API endpoints, and the UI integration.

---

## 1. Goal and Context

Local language-model instances (e.g. Ollama, LM Studio) run on local hardware (GPU / VRAM / RAM). Running multiple requests in parallel:
1. Leads to VRAM exhaustion (Out Of Memory / CUDA error) or a drastic drop in generation speed (thrashing).
2. When parallel requests target different models, the model weights are repeatedly unloaded from and reloaded into VRAM (so-called model thrashing), causing multi-second delays for every request.
3. When the user runs, say, 2 chat searches while a scheduled job (Waypoint Cron) fires in the background, the requests should line up in a sequential queue.

### Key Requirements:
- **Sequential execution**: only one task per local provider is processed at any given time (`maxConcurrency = 1`).
- **Provider configuration toggle**: a `queueEnabled` option (enabled by default for Ollama and LM Studio, can be disabled in settings).
- **VRAM-optimized scheduling (Model-Aware Scheduling)**: if model $X$ is currently loaded in VRAM, the queue first picks the next pending task for model $X$, before performing an expensive switch to model $Y$.
- **Starvation prevention**: tasks that have been waiting more than 60 seconds, or have been skipped $\ge 5$ times, are forcibly promoted so they don't get stuck indefinitely.
- **Live sidebar panel (Drawer & Trigger)**: a panel on the right side of the screen showing the active task, its duration, the list of pending tasks with indicators ("Same model" vs. "Model switch"), a cancel option, and history.
- **Real-time SSE broadcasting**: informs the user in the chat of their position in the queue before token streaming begins.

---

## 2. System Architecture

```
               [ Chat API ]   [ Search API ]   [ Cron Worker ]   [ Playground API ]
                     \              |                |                 /
                      \             |                |                /
                       v            v                v               v
               +-------------------------------------------------------------+
               |                    ProviderQueueManager                     |
               |  (a singleton registered on global, to survive Next.js HMR) |
               +-------------------------------------------------------------+
                             /                                 \
                            /                                   \
             +------------------------------+   +------------------------------+
             |    ProviderQueue (ollama)    |   |   ProviderQueue (lmstudio)   |
             | - maxConcurrency: 1          |   | - maxConcurrency: 1          |
             | - currentlyLoadedModel: 'x'  |   | - currentlyLoadedModel: 'y'  |
             | - activeTask: QueueTask      |   | - activeTask: QueueTask      |
             | - pendingTasks: QueueTask[]  |   | - pendingTasks: QueueTask[]  |
             +------------------------------+   +------------------------------+
                            |                                   |
                     Model-Aware Batching               Model-Aware Batching
                            |                                   |
                            v                                   v
                      Ollama Server                      LM Studio Server
```

---

## 3. Components and Implementation

### 3.1. `ProviderQueueManager` and `ProviderQueue`
Files: `src/lib/queue/types.ts`, `src/lib/queue/providerQueue.ts`, `src/lib/queue/index.ts`.

- **`ProviderQueueManager`**: manages the queue instances for each provider.
- **`ProviderQueue`**:
  - `enqueue<T>(taskParams, executeFn)`: registers a task. If queuing is disabled for the provider, the task runs immediately (`bypass`).
  - `onPositionChange`: notifies subscribers of the current queue position (e.g. streaming state to the chat over SSE).
  - `dequeueNext()`: the smart task-selection algorithm:
    1. Checks whether the oldest task has been starved (time in queue $> 60\text{s}$ or `skipCount \ge 5`).
    2. If not, looks for the first task matching the currently loaded model (`currentlyLoadedModel`).
    3. If there's no task for the current model, takes the oldest task and updates `currentlyLoadedModel`.
  - `cancelTask(taskId)`: cancels a pending task, or triggers the `AbortController` of the active task.

### 3.2. Integration in the API and Executing Clients

1. **`POST /api/chat`**:
   - Checks the provider and fetches the queue instance.
   - Registers the task in the queue.
   - While the task is waiting in the queue, sends SSE packets of type `queueStatus` (e.g. `{ position: 2, total: 3, model: "llama3" }`).
   - Registers a cancellation callback for when the client aborts the connection (`req.signal.onabort`).
2. **`POST /api/search`**:
   - Wraps the search and analysis request in `providerQueueManager.enqueue`.
3. **`Waypoint Cron Executor` (`src/lib/cron/executor.ts`)**:
   - Scheduled Waypoint runs are queued with a `cron` task type and name, preventing them from blocking the user's chat requests.
4. **`Playground API` (`src/app/api/api-keys/playground-run/route.ts`)**:
   - Test calls from the API console go through the same queuing mechanism.

### 3.3. Queue API Endpoints

- `GET /api/queue`: returns the full state of every configured queue (active task, pending tasks, history, enabled state, loaded model).
- `POST /api/queue`: enables/disables queuing for a given provider (`{ providerId: string, enabled: boolean }`).
- `GET /api/queue/stream`: an SSE (Server-Sent Events) endpoint delivering real-time queue-state updates to the UI.
- `DELETE /api/queue/tasks/[taskId]`: an endpoint for immediately canceling a queued task.

### 3.4. User Interface (UI)

- **`QueueTrigger` (`src/components/Queue/QueueTrigger.tsx`)**:
  - A floating/docked button on the right side of the screen.
  - Shows a badge with the number of active and pending tasks, and an animated activity indicator (pulse).
- **`QueueDrawer` (`src/components/Queue/QueueDrawer.tsx`)**:
  - A panel that slides in from the right (Headless UI Dialog/Transition).
  - Shows the active task with a live-running timer.
  - Displays the list of queued tasks, along with whether each will run on the currently loaded model or require a VRAM weight switch.
  - Includes buttons to cancel individual tasks, a queue enable/disable toggle, and a history of recently completed tasks.
- **Chat window notification (`MessageBox.tsx`)**:
  - While a message is waiting in the queue, an elegant status bar is shown, reporting the queue position along with a *"Show queue"* shortcut button.

---

## 4. Provider Configuration

In `src/lib/models/providers/ollama/index.ts` and `src/lib/models/providers/lmstudio/index.ts`:
- A configuration field was added:
  ```typescript
  {
    key: 'queueEnabled',
    label: 'Request queuing (VRAM)',
    type: 'switch',
    description: 'Forces requests to be processed one after another, optimizing VRAM usage and preventing the local server from being overloaded.',
    placeholder: 'true',
    required: false,
    defaultValue: 'true',
  }
  ```
- Support for a toggle (`Switch`) component was added to the provider add/edit dialogs (`AddProviderDialog.tsx`, `UpdateProviderDialog.tsx`).
