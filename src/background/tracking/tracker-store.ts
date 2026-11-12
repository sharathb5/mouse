import { storage } from 'wxt/utils/storage';
import {
  parseTrackerStoreState,
  TRACKER_STORE_VERSION,
  type Tracker,
  type TrackerStoreState,
} from '@/core/contracts';

export const TRACKER_STORAGE_KEY = 'local:agentic-mouse/trackers';

const trackersItem = storage.defineItem<unknown>(TRACKER_STORAGE_KEY, { fallback: null });

export interface TrackerStore {
  list(): Promise<Tracker[]>;
  get(id: string): Promise<Tracker | undefined>;
  upsert(tracker: Tracker): Promise<void>;
  remove(id: string): Promise<void>;
}

async function readState(): Promise<TrackerStoreState> {
  return parseTrackerStoreState(await trackersItem.getValue());
}

async function writeState(state: TrackerStoreState): Promise<void> {
  await trackersItem.setValue({
    version: TRACKER_STORE_VERSION,
    trackers: state.trackers,
  });
}

export function createTrackerStore(): TrackerStore {
  return {
    async list() {
      return (await readState()).trackers;
    },
    async get(id) {
      return (await readState()).trackers.find((tracker) => tracker.id === id);
    },
    async upsert(tracker) {
      const state = await readState();
      const next = state.trackers.filter((entry) => entry.id !== tracker.id);
      next.push(tracker);
      await writeState({ version: TRACKER_STORE_VERSION, trackers: next });
    },
    async remove(id) {
      const state = await readState();
      await writeState({
        version: TRACKER_STORE_VERSION,
        trackers: state.trackers.filter((tracker) => tracker.id !== id),
      });
    },
  };
}
