import { z } from 'zod';
import { TrackConditionSchema } from './action';
import { MoneySchema } from './classification';
import { ProvenancedValueSchema } from './extracted-item';
import { TaskIdSchema } from './task';

export const TRACKER_STORE_VERSION = 1;

export const TrackerAvailabilitySchema = z.enum([
  'in-stock',
  'out-of-stock',
  'preorder',
  'unknown',
]);
export type TrackerAvailability = z.infer<typeof TrackerAvailabilitySchema>;

/** Point-in-time observation of a tracked page. */
export const TrackerSnapshotSchema = z.object({
  capturedAt: z.iso.datetime(),
  sourceUrl: z.url(),
  fields: z.record(z.string(), ProvenancedValueSchema),
  price: MoneySchema.optional(),
  availability: TrackerAvailabilitySchema.optional(),
});
export type TrackerSnapshot = z.infer<typeof TrackerSnapshotSchema>;

export const TrackerSchema = z.object({
  id: z.string().min(1).max(128),
  taskId: TaskIdSchema,
  url: z.url(),
  title: z.string().max(1000),
  condition: TrackConditionSchema,
  createdAt: z.iso.datetime(),
  paused: z.boolean(),
  lastSnapshot: TrackerSnapshotSchema.optional(),
  /** Set when a condition-met notification was already sent for the current satisfied state. */
  lastNotifiedAt: z.iso.datetime().optional(),
  nextCheckAt: z.iso.datetime(),
  /** True after the condition was met and the user was notified once. */
  conditionMet: z.boolean().default(false),
  /**
   * Tab that started the tracker, when known. Used for open-tab snapshot extraction without
   * requiring the `tabs` permission to read tab URLs.
   */
  sourceTabId: z.number().int().nonnegative().optional(),
});
export type Tracker = z.infer<typeof TrackerSchema>;

export const TrackerStoreStateSchema = z.object({
  version: z.literal(TRACKER_STORE_VERSION),
  trackers: z.array(TrackerSchema),
});
export type TrackerStoreState = z.infer<typeof TrackerStoreStateSchema>;

export function parseTrackerStoreState(raw: unknown): TrackerStoreState {
  const full = TrackerStoreStateSchema.safeParse(raw);
  if (full.success) return full.data;
  if (typeof raw !== 'object' || raw === null) {
    return { version: TRACKER_STORE_VERSION, trackers: [] };
  }
  const record = raw as Record<string, unknown>;
  const trackers = Array.isArray(record.trackers)
    ? record.trackers.flatMap((entry) => {
        const parsed = TrackerSchema.safeParse(entry);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return { version: TRACKER_STORE_VERSION, trackers };
}
