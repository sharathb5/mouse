import { storage } from 'wxt/utils/storage';
import {
  parseTasksSnapshot,
  TasksSnapshotSchema,
  type Task,
  type TaskId,
  type TasksSnapshot,
} from '@/core/contracts';
import { countActiveTasks } from '@/core/tasks';
import { setActiveTaskBadge } from '@/platform/badge';

export const TASKS_STORAGE_KEY = 'local:tasks';

export interface TaskStore {
  list(): Promise<Task[]>;
  get(id: TaskId): Promise<Task | undefined>;
  upsert(task: Task): Promise<void>;
  remove(id: TaskId): Promise<void>;
  watch(cb: (tasks: Task[]) => void): () => void;
}

const tasksItem = storage.defineItem<unknown>(TASKS_STORAGE_KEY, { fallback: null });

async function readSnapshot(): Promise<TasksSnapshot> {
  return parseTasksSnapshot(await tasksItem.getValue());
}

async function writeSnapshot(snapshot: TasksSnapshot): Promise<void> {
  const valid = TasksSnapshotSchema.parse(snapshot);
  await tasksItem.setValue(valid);
  await setActiveTaskBadge(countActiveTasks(valid.tasks));
}

export function createTaskStore(): TaskStore {
  return {
    async list() {
      return (await readSnapshot()).tasks;
    },
    async get(id) {
      return (await readSnapshot()).tasks.find((task) => task.request.id === id);
    },
    async upsert(task) {
      const snapshot = await readSnapshot();
      const tasks = snapshot.tasks.filter((item) => item.request.id !== task.request.id);
      tasks.unshift(task);
      await writeSnapshot({ version: 1, tasks: tasks.slice(0, 200) });
    },
    async remove(id) {
      const snapshot = await readSnapshot();
      await writeSnapshot({
        version: 1,
        tasks: snapshot.tasks.filter((task) => task.request.id !== id),
      });
    },
    watch(cb) {
      return tasksItem.watch((value) => {
        cb(parseTasksSnapshot(value).tasks);
      });
    },
  };
}

/** Seed helper for tests and Playwright. */
export async function replaceAllTasks(tasks: Task[]): Promise<void> {
  await writeSnapshot({ version: 1, tasks });
}
