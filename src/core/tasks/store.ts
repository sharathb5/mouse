import type { Task, TaskId } from '../contracts';

/**
 * Shared TaskStore surface. Workstream B owns the chrome.storage implementation
 * (`createTaskStore` in `@/background/tasks`). This module keeps a pure interface plus an
 * in-memory fake for unit tests.
 */
export interface TaskStore {
  list(): Promise<Task[]>;
  get(id: TaskId): Promise<Task | undefined>;
  upsert(task: Task): Promise<void>;
  remove(id: TaskId): Promise<void>;
  watch(onChange: (tasks: Task[]) => void): () => void;
}

/** In-memory TaskStore for unit tests. */
export function createMemoryTaskStore(seed: Task[] = []): TaskStore {
  const tasks = new Map<string, Task>(seed.map((task) => [task.request.id, task]));
  const listeners = new Set<(tasks: Task[]) => void>();

  const emit = () => {
    const snapshot = [...tasks.values()];
    for (const listener of listeners) listener(snapshot);
  };

  return {
    list() {
      return Promise.resolve([...tasks.values()]);
    },
    get(id) {
      return Promise.resolve(tasks.get(id));
    },
    upsert(task) {
      tasks.set(task.request.id, task);
      emit();
      return Promise.resolve();
    },
    remove(id) {
      tasks.delete(id);
      emit();
      return Promise.resolve();
    },
    watch(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
