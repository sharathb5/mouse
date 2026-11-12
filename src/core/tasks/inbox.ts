import type { TrackCondition } from '../contracts/action';
import { isActiveTask, type Task, type TaskState } from '../contracts/task';

const STATUS_RANK: Record<TaskState['status'], number> = {
  running: 0,
  queued: 1,
  monitoring: 2,
  failed: 3,
  completed: 4,
  cancelled: 5,
};

/** Inbox order: active work first, then failures, then settled tasks (newest updated first). */
export function sortTasksForInbox(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const rankDiff = STATUS_RANK[a.state.status] - STATUS_RANK[b.state.status];
    if (rankDiff !== 0) return rankDiff;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function countActiveTasks(tasks: readonly Task[]): number {
  return tasks.reduce((count, task) => count + (isActiveTask(task.state) ? 1 : 0), 0);
}

export type InboxKind = 'track' | 'agent' | 'handoff' | 'other';

/** Coarse kind for inbox chips — Track vs agent handoffs. */
export function inboxKind(task: Task): InboxKind {
  const input = task.request.input;
  if (input.actionId === 'track') return 'track';
  if (input.actionId === 'send-to-agent') {
    if (task.request.executor.kind === 'agent') return 'agent';
    if (task.state.status === 'completed' && task.state.result.kind === 'handoff') return 'handoff';
    return 'agent';
  }
  return 'other';
}

export function inboxKindLabel(kind: InboxKind): string {
  switch (kind) {
    case 'track':
      return 'Track';
    case 'agent':
      return 'Agent';
    case 'handoff':
      return 'Handoff';
    case 'other':
      return 'Task';
  }
}

export function describeTrackCondition(condition: TrackCondition): string {
  switch (condition.kind) {
    case 'price-below':
      return `Alert when price drops below ${condition.threshold.amount} ${condition.threshold.currency}`;
    case 'price-change':
      return 'Alert on any price change';
    case 'availability-change':
      return 'Alert when availability changes';
    case 'content-change':
      return condition.selectorHint
        ? `Alert when content changes (${condition.selectorHint})`
        : 'Alert when page content changes';
  }
}

export function taskTitle(task: Task): string {
  if (task.title) return task.title;
  const input = task.request.input;
  if (input.actionId === 'send-to-agent') {
    return summarizeContext(input.context.source.title, input.instructions);
  }
  if (input.actionId === 'track') {
    const fromTarget =
      input.context.target.kind === 'element' || input.context.target.kind === 'text-selection'
        ? input.context.target.text.split('\n')[0]?.trim()
        : undefined;
    const pageTitle = input.context.source.title.trim();
    const label =
      fromTarget && fromTarget.length > 0 ? fromTarget : pageTitle.length > 0 ? pageTitle : 'Page';
    return `Track · ${truncate(label, 60)}`;
  }
  return input.actionId;
}

/** Extra detail line under the title (condition, next check, handoff mode). */
export function taskDetail(task: Task): string | null {
  const input = task.request.input;
  if (input.actionId === 'track') {
    const parts = [describeTrackCondition(input.condition)];
    if (task.state.status === 'monitoring') {
      parts.push(
        task.state.paused ? 'Paused' : `Next check ${formatShortTime(task.state.nextCheckAt)}`,
      );
    }
    return parts.join(' · ');
  }
  if (
    input.actionId === 'send-to-agent' &&
    task.state.status === 'completed' &&
    task.state.result.kind === 'handoff'
  ) {
    switch (task.state.result.outcome.mode) {
      case 'task-created':
        return 'Agent task created';
      case 'prefill-opened':
        return 'Prefill link opened';
      case 'copied':
        return 'Copied to clipboard';
    }
  }
  return null;
}

function summarizeContext(pageTitle: string, instructions: string | undefined): string {
  const base = pageTitle.trim() || 'Untitled page';
  if (!instructions?.trim()) return `Send to Agent · ${truncate(base, 60)}`;
  return truncate(instructions.trim(), 80);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function formatShortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
