import { EventEmitter } from 'events';
import crypto from 'crypto';
import {
  EnqueueTaskInput,
  ProviderQueueState,
  QueueManagerEvent,
  QueueTask,
  QueueTaskHandle,
} from './types';
import {
  getConfiguredModelProviderById,
  getConfiguredModelProviders,
} from '../config/serverRegistry';
import configManager from '../config';

interface InternalQueueTask extends QueueTask {
  resolve?: () => void;
  reject?: (err: any) => void;
  skipCount: number;
  abortController?: AbortController;
  onPositionChange?: (position: number) => void;
}

const MAX_HISTORY_ITEMS = 25;
const STARVATION_MAX_AGE_MS = 60000; // 60s
const STARVATION_MAX_SKIPS = 5;

export class ProviderQueue {
  readonly providerId: string;
  providerType: string;
  providerName: string;
  currentlyLoadedModel: string | null = null;
  activeTask: InternalQueueTask | null = null;
  pendingTasks: InternalQueueTask[] = [];
  history: QueueTask[] = [];
  private manager: ProviderQueueManager;

  constructor(
    providerId: string,
    providerType: string,
    providerName: string,
    manager: ProviderQueueManager,
  ) {
    this.providerId = providerId;
    this.providerType = providerType;
    this.providerName = providerName;
    this.manager = manager;
  }

  isQueueEnabled(): boolean {
    const prov = getConfiguredModelProviderById(this.providerId);
    if (!prov) return false;

    // Local providers (ollama, lmstudio) default to true if queueEnabled is undefined
    const isLocal =
      this.providerType === 'ollama' || this.providerType === 'lmstudio';

    if (prov.config?.queueEnabled !== undefined) {
      return (
        prov.config.queueEnabled === true ||
        prov.config.queueEnabled === 'true'
      );
    }

    return isLocal;
  }

  setQueueEnabled(enabled: boolean): void {
    const prov = getConfiguredModelProviderById(this.providerId);
    if (prov) {
      configManager.updateModelProvider(this.providerId, prov.name, {
        ...prov.config,
        queueEnabled: enabled,
      });
      this.manager.emitEvent({
        type: 'queue_toggled',
        providerId: this.providerId,
        state: this.getState(),
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Recalculate estimated execution order, queue positions, and model switch flags
   */
  private recalculateQueueOrder(): void {
    const currentModel = this.currentlyLoadedModel || this.activeTask?.modelKey || null;

    this.pendingTasks.forEach((task, index) => {
      const newPos = index + 1;
      const oldPos = task.position;
      task.position = newPos;
      task.isModelSwitch = currentModel ? task.modelKey !== currentModel : false;
      if (oldPos !== newPos && task.onPositionChange) {
        try {
          task.onPositionChange(newPos);
        } catch {}
      }
    });
  }

  getState(): ProviderQueueState {
    this.recalculateQueueOrder();

    return {
      providerId: this.providerId,
      providerType: this.providerType,
      providerName: this.providerName,
      queueEnabled: this.isQueueEnabled(),
      currentlyLoadedModel: this.currentlyLoadedModel,
      activeTask: this.activeTask
        ? {
            id: this.activeTask.id,
            providerId: this.activeTask.providerId,
            providerType: this.activeTask.providerType,
            providerName: this.activeTask.providerName,
            modelKey: this.activeTask.modelKey,
            taskType: this.activeTask.taskType,
            title: this.activeTask.title,
            chatId: this.activeTask.chatId,
            messageId: this.activeTask.messageId,
            userId: this.activeTask.userId,
            status: this.activeTask.status,
            queuedAt: this.activeTask.queuedAt,
            startedAt: this.activeTask.startedAt,
            isModelSwitch: this.activeTask.isModelSwitch,
          }
        : null,
      pendingTasks: this.pendingTasks.map((t) => ({
        id: t.id,
        providerId: t.providerId,
        providerType: t.providerType,
        providerName: t.providerName,
        modelKey: t.modelKey,
        taskType: t.taskType,
        title: t.title,
        chatId: t.chatId,
        messageId: t.messageId,
        userId: t.userId,
        status: t.status,
        queuedAt: t.queuedAt,
        position: t.position,
        isModelSwitch: t.isModelSwitch,
      })),
      history: [...this.history],
      totalQueued: this.pendingTasks.length,
      isProcessing: Boolean(this.activeTask),
    };
  }

  /**
   * Select the optimal next task from the queue based on currently loaded model and starvation prevention
   */
  private selectNextTask(): InternalQueueTask | null {
    if (this.pendingTasks.length === 0) return null;

    const now = Date.now();

    // 1. Starvation prevention: check if any task waited too long or got skipped too many times
    const starvingIndex = this.pendingTasks.findIndex(
      (t) =>
        now - t.queuedAt >= STARVATION_MAX_AGE_MS ||
        t.skipCount >= STARVATION_MAX_SKIPS,
    );

    if (starvingIndex !== -1) {
      const [starvingTask] = this.pendingTasks.splice(starvingIndex, 1);
      return starvingTask;
    }

    // 2. Model-aware selection: pick task with matching modelKey if loaded
    if (this.currentlyLoadedModel) {
      const matchIndex = this.pendingTasks.findIndex(
        (t) => t.modelKey === this.currentlyLoadedModel,
      );

      if (matchIndex !== -1) {
        // Increment skip count for tasks that came before this matching task
        for (let i = 0; i < matchIndex; i++) {
          this.pendingTasks[i].skipCount += 1;
        }

        const [matchingTask] = this.pendingTasks.splice(matchIndex, 1);
        return matchingTask;
      }
    }

    // 3. FIFO fallback: pick the oldest pending task
    const nextTask = this.pendingTasks.shift() || null;
    return nextTask;
  }

  private processNext(): void {
    if (this.activeTask) {
      return; // Already running a task
    }

    const nextTask = this.selectNextTask();
    if (!nextTask) {
      this.recalculateQueueOrder();
      return;
    }

    const wasModelSwitch =
      this.currentlyLoadedModel !== null &&
      this.currentlyLoadedModel !== nextTask.modelKey;

    this.currentlyLoadedModel = nextTask.modelKey;
    nextTask.status = 'running';
    nextTask.startedAt = Date.now();
    nextTask.isModelSwitch = wasModelSwitch;
    this.activeTask = nextTask;

    this.recalculateQueueOrder();

    this.manager.emitEvent({
      type: 'task_started',
      providerId: this.providerId,
      task: nextTask,
      state: this.getState(),
      timestamp: Date.now(),
    });

    if (nextTask.resolve) {
      nextTask.resolve();
    }
  }

  enqueue(input: EnqueueTaskInput): QueueTaskHandle {
    const taskId = crypto.randomUUID();
    const isQueueActive = this.isQueueEnabled();

    // A client disconnecting (navigating away, closing the tab) never
    // cancels a task on its own — it keeps running (or waiting its turn)
    // and gets persisted by the agent regardless, so the result is there
    // when the chat is revisited. Only an explicit cancelTask() call (e.g.
    // the queue UI's cancel button) stops a task; that's what abortController
    // below is wired to via QueueTaskHandle.signal.
    const abortController = new AbortController();

    const internalTask: InternalQueueTask = {
      id: taskId,
      providerId: this.providerId,
      providerType: this.providerType,
      providerName: this.providerName,
      modelKey: input.modelKey,
      taskType: input.taskType,
      title: input.title || 'Untitled Task',
      chatId: input.chatId,
      messageId: input.messageId,
      userId: input.userId,
      status: isQueueActive && this.activeTask ? 'queued' : 'running',
      queuedAt: Date.now(),
      skipCount: 0,
      abortController,
    };

    let executionPromise: Promise<void>;

    if (!isQueueActive || !this.activeTask) {
      // Execute immediately
      this.currentlyLoadedModel = input.modelKey;
      internalTask.status = 'running';
      internalTask.startedAt = Date.now();
      internalTask.isModelSwitch = false;
      this.activeTask = internalTask;

      executionPromise = Promise.resolve();

      this.manager.emitEvent({
        type: 'task_started',
        providerId: this.providerId,
        task: internalTask,
        state: this.getState(),
        timestamp: Date.now(),
      });
    } else {
      // Enqueue to wait
      internalTask.status = 'queued';
      executionPromise = new Promise<void>((resolve, reject) => {
        internalTask.resolve = resolve;
        internalTask.reject = reject;
      });

      this.pendingTasks.push(internalTask);
      this.recalculateQueueOrder();

      this.manager.emitEvent({
        type: 'task_queued',
        providerId: this.providerId,
        task: internalTask,
        state: this.getState(),
        timestamp: Date.now(),
      });
    }

    const finish = (err?: any) => {
      const now = Date.now();
      const isCurrentActive = this.activeTask?.id === taskId;

      if (isCurrentActive && this.activeTask) {
        const completedTask: QueueTask = {
          ...this.activeTask,
          status: err ? 'failed' : 'completed',
          completedAt: now,
          durationMs: this.activeTask.startedAt
            ? now - this.activeTask.startedAt
            : 0,
          error: err ? (typeof err === 'string' ? err : err?.message || 'Error') : undefined,
        };

        this.history.unshift(completedTask);
        if (this.history.length > MAX_HISTORY_ITEMS) {
          this.history.pop();
        }

        this.activeTask = null;

        this.manager.emitEvent({
          type: err ? 'task_failed' : 'task_completed',
          providerId: this.providerId,
          task: completedTask,
          state: this.getState(),
          timestamp: now,
        });

        // Trigger next task in line
        this.processNext();
      } else {
        // If it was in pending queue and completed/finished early
        const pIndex = this.pendingTasks.findIndex((t) => t.id === taskId);
        if (pIndex !== -1) {
          const [removed] = this.pendingTasks.splice(pIndex, 1);
          removed.status = err ? 'failed' : 'completed';
          removed.completedAt = now;
          this.history.unshift(removed);
          this.recalculateQueueOrder();
        }
      }
    };

    const cancel = () => {
      this.cancelTask(taskId, 'User cancelled');
    };

    const handle: QueueTaskHandle = {
      task: internalTask,
      waitForTurn: () => executionPromise,
      finish,
      cancel,
      signal: abortController.signal,
    };

    Object.defineProperty(handle, 'onPositionChange', {
      set: (fn) => {
        internalTask.onPositionChange = fn;
      },
      get: () => internalTask.onPositionChange,
    });

    return handle;
  }

  cancelTask(taskId: string, reason?: string): boolean {
    const now = Date.now();

    // Check if it's the active task
    if (this.activeTask?.id === taskId) {
      const cancelledTask: QueueTask = {
        ...this.activeTask,
        status: 'cancelled',
        completedAt: now,
        durationMs: this.activeTask.startedAt
          ? now - this.activeTask.startedAt
          : 0,
        error: reason || 'Task cancelled',
      };

      this.activeTask.abortController?.abort();
      this.history.unshift(cancelledTask);
      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history.pop();
      }

      this.activeTask = null;

      this.manager.emitEvent({
        type: 'task_cancelled',
        providerId: this.providerId,
        task: cancelledTask,
        state: this.getState(),
        timestamp: now,
      });

      this.processNext();
      return true;
    }

    // Check if it's in pending
    const index = this.pendingTasks.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      const [removed] = this.pendingTasks.splice(index, 1);
      removed.status = 'cancelled';
      removed.completedAt = now;
      removed.error = reason || 'Cancelled before execution';

      if (removed.reject) {
        removed.reject(new Error(removed.error));
      }

      this.history.unshift(removed);
      if (this.history.length > MAX_HISTORY_ITEMS) {
        this.history.pop();
      }

      this.recalculateQueueOrder();

      this.manager.emitEvent({
        type: 'task_cancelled',
        providerId: this.providerId,
        task: removed,
        state: this.getState(),
        timestamp: now,
      });

      return true;
    }

    return false;
  }
}

export class ProviderQueueManager extends EventEmitter {
  private queues: Map<string, ProviderQueue> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  private ensureQueue(providerId: string): ProviderQueue {
    let queue = this.queues.get(providerId);
    if (!queue) {
      const prov = getConfiguredModelProviderById(providerId);
      const provType = prov?.type || 'unknown';
      const provName = prov?.name || providerId;

      queue = new ProviderQueue(providerId, provType, provName, this);
      this.queues.set(providerId, queue);
    }
    return queue;
  }

  emitEvent(event: QueueManagerEvent): void {
    this.emit('queue_event', event);
  }

  enqueue(input: EnqueueTaskInput): QueueTaskHandle {
    const queue = this.ensureQueue(input.providerId);
    return queue.enqueue(input);
  }

  cancelTask(providerId: string, taskId: string, reason?: string): boolean {
    const queue = this.queues.get(providerId);
    if (queue) {
      return queue.cancelTask(taskId, reason);
    }

    // Try all queues if providerId is unknown
    for (const q of this.queues.values()) {
      if (q.cancelTask(taskId, reason)) {
        return true;
      }
    }
    return false;
  }

  getQueueState(providerId: string): ProviderQueueState | null {
    const queue = this.ensureQueue(providerId);
    return queue.getState();
  }

  getAllQueuesState(): ProviderQueueState[] {
    const configuredProviders = getConfiguredModelProviders();
    const states: ProviderQueueState[] = [];

    // Ensure queues exist for all configured providers
    for (const p of configuredProviders) {
      const queue = this.ensureQueue(p.id);
      states.push(queue.getState());
    }

    return states;
  }

  toggleQueue(providerId: string, enabled: boolean): ProviderQueueState | null {
    const queue = this.ensureQueue(providerId);
    queue.setQueueEnabled(enabled);
    return queue.getState();
  }
}

// Global singleton instance
const globalQueueManager =
  (global as any)._providerQueueManager || new ProviderQueueManager();

if (process.env.NODE_ENV !== 'production') {
  (global as any)._providerQueueManager = globalQueueManager;
}

export const providerQueueManager: ProviderQueueManager = globalQueueManager;
export default providerQueueManager;
