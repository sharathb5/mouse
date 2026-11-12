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

export function taskTitle(task: Task): string {
  if (task.title) return task.title;
  const input = task.request.input;
  if (input.actionId === 'send-to-agent') {
    return summarizeContext(input.context.source.title, input.instructions);
  }
  return input.actionId;
}

function summarizeContext(pageTitle: string, instructions: string | undefined): string {
  const base = pageTitle.trim() || 'Untitled page';
  if (!instructions?.trim()) return `Send to Agent · ${truncate(base, 60)}`;
  return truncate(instructions.trim(), 80);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
