import type { TaskEvent } from '../contracts/task-events';
import type { TaskProgress, TaskState, TaskUpdate } from '../contracts/task';

export class IllegalTaskTransitionError extends Error {
  readonly from: TaskState['status'];
  readonly event: TaskEvent['type'];

  constructor(from: TaskState['status'], event: TaskEvent['type']) {
    super(`Illegal task transition: ${from} + ${event}`);
    this.name = 'IllegalTaskTransitionError';
    this.from = from;
    this.event = event;
  }
}

/**
 * Pure task state machine. Exhaustively tested; no I/O.
 * Terminal states (completed/failed/cancelled) reject further events.
 */
export function transition(state: TaskState, event: TaskEvent): TaskState {
  switch (event.type) {
    case 'enqueue':
      if (state.status !== 'queued') illegal(state, event);
      return { status: 'queued' };

    case 'start':
      if (state.status !== 'queued' && state.status !== 'running') illegal(state, event);
      return {
        status: 'running',
        progress: event.progress,
        updates: appendUpdate(state.status === 'running' ? state.updates : [], event.update),
      };

    case 'progress':
      if (state.status !== 'running') illegal(state, event);
      return {
        status: 'running',
        progress: event.progress,
        updates: appendUpdate(state.updates, event.update),
      };

    case 'update':
      if (state.status !== 'running') illegal(state, event);
      return {
        status: 'running',
        progress: state.progress,
        updates: appendUpdate(state.updates, event.update),
      };

    case 'enter-monitoring':
      if (
        state.status !== 'queued' &&
        state.status !== 'running' &&
        state.status !== 'monitoring'
      ) {
        illegal(state, event);
      }
      return {
        status: 'monitoring',
        nextCheckAt: event.nextCheckAt,
        paused: event.paused,
        ...(event.lastCheckedAt !== undefined ? { lastCheckedAt: event.lastCheckedAt } : {}),
      };

    case 'pause-monitoring':
      if (state.status !== 'monitoring' || state.paused) illegal(state, event);
      return { ...state, paused: true };

    case 'resume-monitoring':
      if (state.status !== 'monitoring' || !state.paused) illegal(state, event);
      return { ...state, paused: false, nextCheckAt: event.nextCheckAt };

    case 'complete':
      if (
        state.status !== 'queued' &&
        state.status !== 'running' &&
        state.status !== 'monitoring'
      ) {
        illegal(state, event);
      }
      return {
        status: 'completed',
        result: event.result,
        completedAt: event.completedAt,
      };

    case 'fail':
      if (
        state.status !== 'queued' &&
        state.status !== 'running' &&
        state.status !== 'monitoring'
      ) {
        illegal(state, event);
      }
      return {
        status: 'failed',
        error: event.error,
        failedAt: event.failedAt,
      };

    case 'cancel':
      if (
        state.status !== 'queued' &&
        state.status !== 'running' &&
        state.status !== 'monitoring'
      ) {
        illegal(state, event);
      }
      return { status: 'cancelled', cancelledAt: event.cancelledAt };

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function appendUpdate(updates: TaskUpdate[], update: TaskUpdate | undefined): TaskUpdate[] {
  if (!update) return updates;
  return [...updates, update].slice(-200);
}

function illegal(state: TaskState, event: TaskEvent): never {
  throw new IllegalTaskTransitionError(state.status, event.type);
}

/** Map Cursor Cloud Agent run statuses onto our TaskState progress labels. */
export function progressFromCursorRunStatus(
  status: string,
): Extract<TaskProgress, { mode: 'indeterminate' }> {
  switch (status) {
    case 'CREATING':
      return { mode: 'indeterminate', label: 'Creating agent…' };
    case 'RUNNING':
      return { mode: 'indeterminate', label: 'Agent working…' };
    case 'WAITING_FOR_BACKGROUND_WORK':
      return { mode: 'indeterminate', label: 'Waiting on background work…' };
    default:
      return { mode: 'indeterminate', label: status };
  }
}
