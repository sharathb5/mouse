import { browser } from 'wxt/browser';
import {
  ExtractSnapshotResponseSchema,
  type Tracker,
  type TrackerSnapshot,
} from '@/core/contracts';
import { evaluateCondition } from '@/core/tracking';
import { snapshotFromDocument } from '@/core/tracking';
import { notifyTrackConditionMet } from './notifications';
import type { TrackerStore } from './tracker-store';
import type { TaskStore } from '@/core/tasks/store';

export const DEFAULT_CHECK_INTERVAL_MINUTES = 15;

export function nextCheckIso(from = new Date(), minutes = DEFAULT_CHECK_INTERVAL_MINUTES): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

async function snapshotFromTabId(tabId: number): Promise<TrackerSnapshot | null> {
  try {
    const response = ExtractSnapshotResponseSchema.parse(
      await browser.tabs.sendMessage(tabId, { type: 'agentic-mouse/extract-snapshot' }),
    );
    return response.ok ? response.snapshot : null;
  } catch {
    return null;
  }
}

async function snapshotFromOpenTab(
  url: string,
  preferredTabId?: number,
): Promise<TrackerSnapshot | null> {
  if (preferredTabId !== undefined) {
    const preferred = await snapshotFromTabId(preferredTabId);
    if (preferred) return preferred;
  }

  // Without the `tabs` permission, tab.url is often unavailable; prefer sourceTabId above.
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id === undefined || !tab.url || !urlsLooselyEqual(tab.url, url)) continue;
      const snapshot = await snapshotFromTabId(tab.id);
      if (snapshot) return snapshot;
    }
  } catch {
    return null;
  }
  return null;
}

function urlsLooselyEqual(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}

/**
 * Attempts a background fetch when optional host permission is already granted.
 * Returns null when permission is missing or the response cannot be parsed.
 */
async function snapshotFromFetch(url: string): Promise<TrackerSnapshot | null> {
  try {
    const origin = new URL(url).origin + '/*';
    const granted = await browser.permissions.contains({ origins: [origin] });
    if (!granted) return null;
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) return null;
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return snapshotFromDocument(doc, url);
  } catch {
    return null;
  }
}

export async function collectSnapshot(
  url: string,
  preferredTabId?: number,
): Promise<TrackerSnapshot | null> {
  return (await snapshotFromOpenTab(url, preferredTabId)) ?? (await snapshotFromFetch(url));
}

export async function runTrackerCheck(
  tracker: Tracker,
  deps: { trackers: TrackerStore; tasks: TaskStore },
): Promise<{ met: boolean; tracker: Tracker }> {
  if (tracker.paused) {
    return { met: false, tracker };
  }

  const current = await collectSnapshot(tracker.url, tracker.sourceTabId);
  const checkedAt = new Date().toISOString();
  const nextCheckAt = nextCheckIso();

  if (!current) {
    const skipped: Tracker = { ...tracker, nextCheckAt };
    await deps.trackers.upsert(skipped);
    await syncMonitoringTask(deps.tasks, skipped, checkedAt, 'Check skipped: page not reachable');
    return { met: false, tracker: skipped };
  }

  const met = evaluateCondition(tracker.condition, tracker.lastSnapshot, current);
  let next: Tracker = {
    ...tracker,
    lastSnapshot: current,
    nextCheckAt,
  };

  if (met && !tracker.conditionMet) {
    next = {
      ...next,
      conditionMet: true,
      lastNotifiedAt: checkedAt,
    };
    await deps.trackers.upsert(next);
    await notifyTrackConditionMet(next);
    await syncMonitoringTask(deps.tasks, next, checkedAt, 'Condition met');
    return { met: true, tracker: next };
  }

  await deps.trackers.upsert(next);
  await syncMonitoringTask(deps.tasks, next, checkedAt, met ? 'Condition still met' : 'No change');
  return { met: false, tracker: next };
}

async function syncMonitoringTask(
  tasks: TaskStore,
  tracker: Tracker,
  checkedAt: string,
  message: string,
): Promise<void> {
  const existing = await tasks.get(tracker.taskId);
  if (!existing) return;
  await tasks.upsert({
    ...existing,
    updatedAt: checkedAt,
    state: {
      status: 'monitoring',
      lastCheckedAt: checkedAt,
      nextCheckAt: tracker.nextCheckAt,
      paused: tracker.paused,
    },
  });
  // Monitoring state has no updates array; message is retained for future inbox wiring.
  if (existing.state.status === 'running' && message.length === 0) {
    return;
  }
}
