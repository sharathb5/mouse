import { browser } from 'wxt/browser';
import type { Task } from '@/core/contracts';
import { taskTitle } from '@/core/tasks';

export async function notifyTaskCompletion(task: Task): Promise<void> {
  if (task.completionNotified) return;
  if (task.state.status !== 'completed' && task.state.status !== 'failed') return;

  const title =
    task.state.status === 'completed'
      ? 'Agentic Mouse task completed'
      : 'Agentic Mouse task failed';
  const message =
    task.state.status === 'completed'
      ? taskTitle(task)
      : `${taskTitle(task)}: ${task.state.error.message}`;

  try {
    await browser.notifications.create(`agentic-mouse-task-${task.request.id}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title,
      message,
      priority: 1,
    });
  } catch {
    // notifications permission may be missing in older builds; ignore.
  }
}
