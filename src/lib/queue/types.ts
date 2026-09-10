export type TaskType = 'chat' | 'search' | 'cron' | 'playground' | string;

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface QueueTask {
  id: string;
  providerId: string;
  providerType: string;
  providerName: string;
  modelKey: string;
  taskType: TaskType;
  title: string;
  chatId?: string;
  messageId?: string;
  userId?: string;
  status: TaskStatus;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  position?: number;
  isModelSwitch?: boolean;
}

export interface QueueTaskHandle {
  task: QueueTask;
  waitForTurn: () => Promise<void>;
  finish: (err?: any) => void;
  cancel: () => void;
  onPositionChange?: (position: number) => void;
  /** Aborts when this task is explicitly cancelled (e.g. via the queue UI), NOT on mere client disconnect. */
  signal: AbortSignal;
}

export interface EnqueueTaskInput {
  providerId: string;
  modelKey: string;
  taskType: TaskType;
  title: string;
  chatId?: string;
  messageId?: string;
  userId?: string;
}

export interface ProviderQueueState {
  providerId: string;
  providerType: string;
  providerName: string;
  queueEnabled: boolean;
  currentlyLoadedModel: string | null;
  activeTask: QueueTask | null;
  pendingTasks: QueueTask[];
  history: QueueTask[];
  totalQueued: number;
  isProcessing: boolean;
}

export interface QueueManagerEvent {
  type:
    | 'task_queued'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'task_cancelled'
    | 'queue_reordered'
    | 'queue_toggled'
    | 'state_updated';
  providerId: string;
  task?: QueueTask;
  state?: ProviderQueueState;
  timestamp: number;
}
