import { browser } from 'wxt/browser';
import { useEffect, useState } from 'react';
import { BackgroundResponseSchema, type BackgroundRequest, type Task } from '@/core/contracts';
import { sortTasksForInbox, taskTitle } from '@/core/tasks';
import { WalkingCat } from './WalkingCat';

async function send(request: BackgroundRequest) {
  const raw: unknown = await browser.runtime.sendMessage(request);
  return BackgroundResponseSchema.parse(raw);
}

export function InboxPanel() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      send({ type: 'agentic-mouse/list-tasks' })
        .then((response) => {
          if (!active) return;
          if (response.type === 'tasks') {
            setTasks(sortTasksForInbox(response.tasks));
            setError(null);
            return;
          }
          setError(response.type === 'error' ? response.message : 'Failed to load tasks');
        })
        .catch((err: unknown) => {
          if (active) setError(err instanceof Error ? err.message : 'Failed to load tasks');
        });

    void load();
    const interval = window.setInterval(() => void load(), 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function runCommand(
    taskId: string,
    command: 'cancel' | 'pause' | 'resume' | 'dismiss' | 'open-result',
  ) {
    await send({ type: 'agentic-mouse/task-command', taskId, command });
    const response = await send({ type: 'agentic-mouse/list-tasks' });
    if (response.type === 'tasks') setTasks(sortTasksForInbox(response.tasks));
  }

  if (error) {
    return (
      <div className="inbox-empty" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (tasks === null) {
    return (
      <div className="inbox-empty" data-testid="inbox-loading">
        <p>Loading tasks…</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="inbox-empty" data-testid="inbox-empty">
        <WalkingCat
          state={{
            status: 'monitoring',
            nextCheckAt: new Date().toISOString(),
            paused: true,
          }}
        />
        <h2>No tasks yet</h2>
        <p>
          Work you delegate to agents, comparisons, and trackers will show up here with live
          progress.
        </p>
      </div>
    );
  }

  return (
    <ul className="inbox-list" data-testid="inbox-list">
      {tasks.map((task) => (
        <li
          key={task.request.id}
          className="inbox-item"
          data-testid="inbox-item"
          data-status={task.state.status}
          data-task-id={task.request.id}
        >
          <div className="inbox-item-header">
            <strong>{taskTitle(task)}</strong>
            <span className="inbox-status">{task.state.status}</span>
          </div>
          <WalkingCat state={task.state} />
          {task.state.status === 'running' && task.state.updates[task.state.updates.length - 1] && (
            <p className="inbox-update">
              {task.state.updates[task.state.updates.length - 1]?.message}
            </p>
          )}
          {task.state.status === 'failed' && (
            <p className="inbox-update error">{task.state.error.message}</p>
          )}
          {task.external?.url && (
            <button
              type="button"
              className="link-btn"
              onClick={() => void runCommand(task.request.id, 'open-result')}
            >
              Open agent run
            </button>
          )}
          <div className="inbox-controls">
            {(task.state.status === 'queued' || task.state.status === 'running') && (
              <button type="button" onClick={() => void runCommand(task.request.id, 'cancel')}>
                Cancel
              </button>
            )}
            {task.state.status === 'monitoring' && !task.state.paused && (
              <button type="button" onClick={() => void runCommand(task.request.id, 'pause')}>
                Pause
              </button>
            )}
            {task.state.status === 'monitoring' && task.state.paused && (
              <button type="button" onClick={() => void runCommand(task.request.id, 'resume')}>
                Resume
              </button>
            )}
            {(task.state.status === 'completed' ||
              task.state.status === 'failed' ||
              task.state.status === 'cancelled') && (
              <button type="button" onClick={() => void runCommand(task.request.id, 'dismiss')}>
                Dismiss
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
