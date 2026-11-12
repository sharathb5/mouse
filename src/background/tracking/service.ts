import { browser } from 'wxt/browser';
import {
  BackgroundMessageSchema,
  type BackgroundMessage,
  type Task,
  type TrackMutationResponse,
  type TrackStartResponse,
  type Tracker,
} from '@/core/contracts';
import { createTaskStore, type TaskStore } from '@/background/tasks';
import { countActiveTasks } from '@/core/tasks';
import { setActiveTaskBadge } from '@/platform/badge';
import { nextCheckIso, runTrackerCheck } from './check';
import { attachAlarmListener, clearTrackerSchedule, scheduleTracker } from './scheduler';
import { createTrackerStore, type TrackerStore } from './tracker-store';

const TRACK_MESSAGE_TYPES = new Set([
  'agentic-mouse/track/start',
  'agentic-mouse/track/pause',
  'agentic-mouse/track/resume',
  'agentic-mouse/track/cancel',
  'agentic-mouse/track/check-now',
  'agentic-mouse/track/list',
]);

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function refreshBadge(tasks: TaskStore): Promise<void> {
  await setActiveTaskBadge(countActiveTasks(await tasks.list()));
}

async function handleStart(
  message: Extract<BackgroundMessage, { type: 'agentic-mouse/track/start' }>,
  deps: { trackers: TrackerStore; tasks: TaskStore },
  sourceTabId?: number,
): Promise<TrackStartResponse> {
  const now = new Date().toISOString();
  const nextCheckAt = nextCheckIso();
  const taskId = newId('task');
  const trackerId = newId('trk');

  const task: Task = {
    request: {
      id: taskId,
      input: {
        actionId: 'track',
        context: {
          untrusted: true,
          source: {
            url: message.url,
            title: message.title,
            capturedAt: now,
            frame: 'top',
          },
          target: { kind: 'page', blocks: [] },
          page: { kind: 'product', confidence: 0.5, signals: ['track-start'] },
          containsSensitiveData: false,
        },
        condition: message.condition,
      },
      executor: { kind: 'extension' },
      approval: { kind: 'not-required' },
      createdAt: now,
    },
    state: {
      status: 'monitoring',
      lastCheckedAt: now,
      nextCheckAt,
      paused: false,
    },
    updatedAt: now,
  };

  const tracker: Tracker = {
    id: trackerId,
    taskId,
    url: message.url,
    title: message.title,
    condition: message.condition,
    createdAt: now,
    paused: false,
    lastSnapshot: message.initialSnapshot,
    nextCheckAt,
    conditionMet: false,
    ...(sourceTabId === undefined ? {} : { sourceTabId }),
  };

  await deps.tasks.upsert(task);
  await deps.trackers.upsert(tracker);
  await scheduleTracker(tracker);
  await refreshBadge(deps.tasks);

  // Request optional host permission for offline checks (best-effort; may need a user gesture).
  try {
    const origin = new URL(message.url).origin + '/*';
    void browser.permissions.request({ origins: [origin] });
  } catch {
    // Content-script snapshot path still works when the tab is open.
  }

  return { ok: true, trackerId, taskId, nextCheckAt };
}

async function handleMutation(
  type: 'pause' | 'resume' | 'cancel' | 'check-now',
  trackerId: string,
  deps: { trackers: TrackerStore; tasks: TaskStore },
): Promise<TrackMutationResponse> {
  const tracker = await deps.trackers.get(trackerId);
  if (!tracker) return { ok: false, reason: 'Tracker not found' };

  if (type === 'cancel') {
    await deps.trackers.remove(trackerId);
    await clearTrackerSchedule(trackerId);
    const task = await deps.tasks.get(tracker.taskId);
    if (task) {
      await deps.tasks.upsert({
        ...task,
        updatedAt: new Date().toISOString(),
        state: { status: 'cancelled', cancelledAt: new Date().toISOString() },
      });
    }
    await refreshBadge(deps.tasks);
    return { ok: true };
  }

  if (type === 'check-now') {
    await runTrackerCheck(tracker, deps);
    await refreshBadge(deps.tasks);
    return { ok: true };
  }

  const paused = type === 'pause';
  const next: Tracker = {
    ...tracker,
    paused,
    nextCheckAt: paused ? tracker.nextCheckAt : nextCheckIso(),
  };
  await deps.trackers.upsert(next);
  await scheduleTracker(next);
  const task = await deps.tasks.get(tracker.taskId);
  if (task) {
    await deps.tasks.upsert({
      ...task,
      updatedAt: new Date().toISOString(),
      state: {
        status: 'monitoring',
        lastCheckedAt: task.state.status === 'monitoring' ? task.state.lastCheckedAt : undefined,
        nextCheckAt: next.nextCheckAt,
        paused,
      },
    });
  }
  await refreshBadge(deps.tasks);
  return { ok: true };
}

export interface TrackingService {
  trackers: TrackerStore;
  tasks: TaskStore;
}

export interface TrackingTestApi {
  checkNow(trackerId: string): Promise<TrackMutationResponse>;
  list(): Promise<{ ok: true; trackers: Tracker[]; tasks: Task[] }>;
  pause(trackerId: string): Promise<TrackMutationResponse>;
  resume(trackerId: string): Promise<TrackMutationResponse>;
  cancel(trackerId: string): Promise<TrackMutationResponse>;
}

type TrackingGlobal = typeof globalThis & {
  __agenticMouseTracking?: TrackingTestApi;
};

export function startTrackingService(
  overrides: Partial<{ trackers: TrackerStore; tasks: TaskStore }> = {},
): TrackingService {
  const trackers = overrides.trackers ?? createTrackerStore();
  // Prefer Workstream B's authoritative TaskStore / inbox over any C-local temporary store.
  const tasks = overrides.tasks ?? createTaskStore();
  const deps = { trackers, tasks };

  attachAlarmListener(deps);

  const api: TrackingTestApi = {
    checkNow: (trackerId) => handleMutation('check-now', trackerId, deps),
    list: async () => ({ ok: true, trackers: await trackers.list(), tasks: await tasks.list() }),
    pause: (trackerId) => handleMutation('pause', trackerId, deps),
    resume: (trackerId) => handleMutation('resume', trackerId, deps),
    cancel: (trackerId) => handleMutation('cancel', trackerId, deps),
  };
  // Playwright drives Track checks through this SW-local API because runtime.sendMessage
  // from a service worker does not deliver to its own onMessage listener.
  (globalThis as TrackingGlobal).__agenticMouseTracking = api;

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    const parsed = BackgroundMessageSchema.safeParse(message);
    if (!parsed.success || !TRACK_MESSAGE_TYPES.has(parsed.data.type)) return undefined;

    const respond = async () => {
      switch (parsed.data.type) {
        case 'agentic-mouse/track/start':
          return handleStart(parsed.data, deps, sender.tab?.id);
        case 'agentic-mouse/track/pause':
          return handleMutation('pause', parsed.data.trackerId, deps);
        case 'agentic-mouse/track/resume':
          return handleMutation('resume', parsed.data.trackerId, deps);
        case 'agentic-mouse/track/cancel':
          return handleMutation('cancel', parsed.data.trackerId, deps);
        case 'agentic-mouse/track/check-now':
          return handleMutation('check-now', parsed.data.trackerId, deps);
        case 'agentic-mouse/track/list':
          return { ok: true, trackers: await trackers.list(), tasks: await tasks.list() };
      }
    };

    void respond().then(sendResponse);
    return true;
  });

  void (async () => {
    for (const tracker of await trackers.list()) {
      if (!tracker.paused) await scheduleTracker(tracker);
    }
    await refreshBadge(tasks);
  })();

  return { trackers, tasks };
}
