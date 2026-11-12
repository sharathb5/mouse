import { browser } from 'wxt/browser';
import type {
  ActionInputFor,
  ActionResult,
  AgentDestination,
  Task,
  TaskApproval,
  TaskId,
} from '@/core/contracts';
import { canCreateTask } from '@/core/contracts';
import { countActiveTasks, taskTitle, transition } from '@/core/tasks';
import { setActiveTaskBadge } from '@/platform/badge';
import { loadDestinationsConfig } from '@/platform/destinations-store';
import { createDestinationAdapter, CursorApiError, type DestinationAdapter } from '../destinations';
import { notifyTaskCompletion } from './notifications';
import { createTaskStore, type TaskStore } from './store';

export const TASK_POLL_ALARM = 'agentic-mouse/poll-tasks';
export const TASK_POLL_PERIOD_MINUTES = 0.5;

export interface TaskOrchestrator {
  createAgentTask(args: {
    destinationId: string;
    input: ActionInputFor<'send-to-agent'>;
    approval: TaskApproval;
    title?: string;
  }): Promise<{ taskId: TaskId; externalUrl?: string }>;
  handoff(args: {
    destinationId: string;
    input: ActionInputFor<'send-to-agent'>;
  }): Promise<ActionResult & { kind: 'handoff' }>;
  cancel(taskId: TaskId): Promise<void>;
  pause(taskId: TaskId): Promise<void>;
  resume(taskId: TaskId): Promise<void>;
  dismiss(taskId: TaskId): Promise<void>;
  pollActiveTasks(): Promise<void>;
  start(): Promise<void>;
  store: TaskStore;
}

function newTaskId(): string {
  return `task_${crypto.randomUUID()}`;
}

export function createTaskOrchestrator(store: TaskStore = createTaskStore()): TaskOrchestrator {
  let polling = false;

  async function resolveDestination(destinationId: string): Promise<AgentDestination> {
    const config = await loadDestinationsConfig();
    const destination = config.destinations.find((item) => item.id === destinationId);
    if (!destination) throw new Error(`Unknown destination: ${destinationId}`);
    return destination;
  }

  async function applyTransition(
    task: Task,
    event: Parameters<typeof transition>[1],
  ): Promise<Task> {
    const next: Task = {
      ...task,
      state: transition(task.state, event),
      updatedAt: new Date().toISOString(),
    };
    await store.upsert(next);
    if (next.state.status === 'completed' || next.state.status === 'failed') {
      if (!next.completionNotified) {
        await notifyTaskCompletion(next);
        const marked = { ...next, completionNotified: true };
        await store.upsert(marked);
        return marked;
      }
    }
    return next;
  }

  async function refreshBadge(): Promise<void> {
    await setActiveTaskBadge(countActiveTasks(await store.list()));
  }

  const orchestrator: TaskOrchestrator = {
    store,

    async start() {
      await refreshBadge();
      await browser.alarms.create(TASK_POLL_ALARM, { periodInMinutes: TASK_POLL_PERIOD_MINUTES });
      store.watch(() => {
        void refreshBadge();
      });
    },

    async createAgentTask({ destinationId, input, approval, title }) {
      const destination = await resolveDestination(destinationId);
      if (!canCreateTask(destination)) {
        throw new Error('Destination cannot create background tasks');
      }
      if (input.context.containsSensitiveData) {
        throw new Error('Sensitive content cannot be sent externally');
      }

      const createdAt = new Date().toISOString();
      const taskId = newTaskId();
      const task: Task = {
        request: {
          id: taskId,
          input: { ...input, destinationId },
          executor: { kind: 'agent', destination },
          approval,
          createdAt,
        },
        state: { status: 'queued' },
        updatedAt: createdAt,
        title:
          title ??
          taskTitle({
            request: {
              id: taskId,
              input: { ...input, destinationId },
              executor: { kind: 'agent', destination },
              approval,
              createdAt,
            },
            state: { status: 'queued' },
            updatedAt: createdAt,
          }),
      };

      // Local queued acknowledgement must land before any network call (< 500 ms budget).
      await store.upsert(task);

      const adapter = createDestinationAdapter(destination);
      if (!adapter.createTask) throw new Error('Adapter cannot create tasks');

      try {
        const created = await adapter.createTask(task.request, new AbortController().signal);
        const withExternal: Task = {
          ...task,
          external: {
            id: created.externalId,
            ...(created.externalRunId ? { runId: created.externalRunId } : {}),
            ...(created.externalUrl ? { url: created.externalUrl } : {}),
          },
          updatedAt: new Date().toISOString(),
        };
        await store.upsert(withExternal);
        await applyTransition(withExternal, {
          type: 'start',
          progress: { mode: 'indeterminate', label: 'Agent started' },
          update: {
            at: new Date().toISOString(),
            message: 'Cursor Cloud Agent accepted the task',
          },
        });
        return {
          taskId,
          ...(created.externalUrl ? { externalUrl: created.externalUrl } : {}),
        };
      } catch (error) {
        const message =
          error instanceof CursorApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Failed to create Cursor task';
        const code =
          error instanceof CursorApiError
            ? error.code === 'not-configured'
              ? 'permission-denied'
              : error.code === 'network'
                ? 'network'
                : 'provider'
            : 'provider';
        await applyTransition(task, {
          type: 'fail',
          failedAt: new Date().toISOString(),
          error: { code, message, retryable: code === 'network' || code === 'provider' },
        });
        throw error;
      }
    },

    async handoff({ destinationId, input }) {
      const destination = await resolveDestination(destinationId);
      if (canCreateTask(destination)) {
        throw new Error('Use createAgentTask for background-execution destinations');
      }
      const adapter = createDestinationAdapter(destination);
      if (!adapter.handoff) throw new Error('Destination does not support handoff');
      return adapter.handoff({ ...input, destinationId });
    },

    async cancel(taskId) {
      const task = await store.get(taskId);
      if (!task) throw new Error('Task not found');
      if (
        task.state.status !== 'queued' &&
        task.state.status !== 'running' &&
        task.state.status !== 'monitoring'
      ) {
        return;
      }

      if (task.external && task.request.executor.kind === 'agent') {
        const adapter = createDestinationAdapter(task.request.executor.destination);
        if (adapter.cancelTask) {
          try {
            await adapter.cancelTask({
              id: task.external.id,
              ...(task.external.runId ? { runId: task.external.runId } : {}),
            });
          } catch {
            // Still mark cancelled locally so the inbox stays honest.
          }
        }
      }
      await applyTransition(task, { type: 'cancel', cancelledAt: new Date().toISOString() });
    },

    async pause(taskId) {
      const task = await store.get(taskId);
      if (task?.state.status !== 'monitoring') return;
      await applyTransition(task, { type: 'pause-monitoring' });
    },

    async resume(taskId) {
      const task = await store.get(taskId);
      if (task?.state.status !== 'monitoring') return;
      await applyTransition(task, {
        type: 'resume-monitoring',
        nextCheckAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
    },

    async dismiss(taskId) {
      await store.remove(taskId);
      await refreshBadge();
    },

    async pollActiveTasks() {
      if (polling) return;
      polling = true;
      try {
        const tasks = await store.list();
        for (const task of tasks) {
          if (task.state.status !== 'running' && task.state.status !== 'queued') continue;
          if (!task.external || task.request.executor.kind !== 'agent') continue;
          const destination = task.request.executor.destination;
          const adapter: DestinationAdapter = createDestinationAdapter(destination);
          if (!adapter.pollTask) continue;
          try {
            const polled = await adapter.pollTask({
              id: task.external.id,
              ...(task.external.runId ? { runId: task.external.runId } : {}),
            });
            const mergedExternal = {
              id: task.external.id,
              ...(polled.externalRunId
                ? { runId: polled.externalRunId }
                : task.external.runId
                  ? { runId: task.external.runId }
                  : {}),
              ...(polled.externalUrl
                ? { url: polled.externalUrl }
                : task.external.url
                  ? { url: task.external.url }
                  : {}),
            };
            let stamped: Task = {
              ...task,
              external: mergedExternal,
              updatedAt: new Date().toISOString(),
            };
            await store.upsert(stamped);

            if (stamped.state.status === 'queued' && polled.state.status !== 'queued') {
              stamped = await applyTransition(stamped, {
                type: 'start',
                progress:
                  polled.state.status === 'running'
                    ? polled.state.progress
                    : { mode: 'indeterminate', label: 'Agent update' },
              });
            }

            switch (polled.state.status) {
              case 'running':
                if (stamped.state.status === 'running') {
                  await applyTransition(stamped, {
                    type: 'progress',
                    progress: polled.state.progress,
                    update: polled.state.updates[0],
                  });
                }
                break;
              case 'completed':
                await applyTransition(stamped, {
                  type: 'complete',
                  result: polled.state.result,
                  completedAt: polled.state.completedAt,
                });
                break;
              case 'failed':
                await applyTransition(stamped, {
                  type: 'fail',
                  error: polled.state.error,
                  failedAt: polled.state.failedAt,
                });
                break;
              case 'cancelled':
                await applyTransition(stamped, {
                  type: 'cancel',
                  cancelledAt: polled.state.cancelledAt,
                });
                break;
              case 'queued':
              case 'monitoring':
                break;
            }
          } catch {
            // Transient poll failures should not fail the task; retry on the next alarm.
          }
        }
      } finally {
        polling = false;
      }
    },
  };

  return orchestrator;
}
