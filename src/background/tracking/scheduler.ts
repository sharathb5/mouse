import { browser } from 'wxt/browser';
import type { Tracker } from '@/core/contracts';
import { DEFAULT_CHECK_INTERVAL_MINUTES, runTrackerCheck } from './check';
import type { TrackerStore } from './tracker-store';
import type { TaskStore } from '@/core/tasks/store';

export const TRACK_ALARM_PREFIX = 'agentic-mouse/track/';

export function alarmNameFor(trackerId: string): string {
  return `${TRACK_ALARM_PREFIX}${trackerId}`;
}

export function trackerIdFromAlarm(name: string): string | null {
  return name.startsWith(TRACK_ALARM_PREFIX) ? name.slice(TRACK_ALARM_PREFIX.length) : null;
}

export async function scheduleTracker(tracker: Tracker): Promise<void> {
  if (tracker.paused) {
    await browser.alarms.clear(alarmNameFor(tracker.id));
    return;
  }
  const when = Date.parse(tracker.nextCheckAt);
  await browser.alarms.create(alarmNameFor(tracker.id), {
    when: Number.isFinite(when) ? when : Date.now() + DEFAULT_CHECK_INTERVAL_MINUTES * 60_000,
    periodInMinutes: DEFAULT_CHECK_INTERVAL_MINUTES,
  });
}

export async function clearTrackerSchedule(trackerId: string): Promise<void> {
  await browser.alarms.clear(alarmNameFor(trackerId));
}

export function attachAlarmListener(deps: {
  trackers: TrackerStore;
  tasks: TaskStore;
}): () => void {
  const listener = (alarm: { name: string }) => {
    const trackerId = trackerIdFromAlarm(alarm.name);
    if (!trackerId) return;
    void (async () => {
      const tracker = await deps.trackers.get(trackerId);
      if (!tracker || tracker.paused) return;
      await runTrackerCheck(tracker, deps);
    })();
  };
  browser.alarms.onAlarm.addListener(listener);
  return () => browser.alarms.onAlarm.removeListener(listener);
}
