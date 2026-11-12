import { z } from 'zod';
import { ActionInputSchema } from './action';
import { BackgroundDestinationSchema } from './destination';
import { ActionErrorSchema, ActionResultSchema } from './result';

export const TaskIdSchema = z.string().min(1).max(128);
export type TaskId = z.infer<typeof TaskIdSchema>;

/** Use `indeterminate` whenever reliable numeric progress is unavailable. */
export const TaskProgressSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('determinate'),
    fraction: z.number().min(0).max(1),
    label: z.string().max(120).optional(),
  }),
  z.object({ mode: z.literal('indeterminate'), label: z.string().max(120).optional() }),
]);
export type TaskProgress = z.infer<typeof TaskProgressSchema>;

export const TaskUpdateSchema = z.object({
  at: z.iso.datetime(),
  message: z.string().min(1).max(500),
});
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;

/** Where a task runs. Only genuine background-capable destinations or the extension itself. */
export const TaskExecutorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('agent'), destination: BackgroundDestinationSchema }),
  /** Work the extension performs itself, e.g. Track monitoring via alarms. */
  z.object({ kind: z.literal('extension') }),
]);
export type TaskExecutor = z.infer<typeof TaskExecutorSchema>;

/** How consent was obtained for a consequential external action. */
export const TaskApprovalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('explicit'), approvedAt: z.iso.datetime() }),
  z.object({ kind: z.literal('trusted-rule'), ruleId: z.string().min(1) }),
  z.object({ kind: z.literal('not-required') }),
]);
export type TaskApproval = z.infer<typeof TaskApprovalSchema>;

export const TaskRequestSchema = z.object({
  id: TaskIdSchema,
  input: ActionInputSchema,
  executor: TaskExecutorSchema,
  approval: TaskApprovalSchema,
  createdAt: z.iso.datetime(),
});
export type TaskRequest = z.infer<typeof TaskRequestSchema>;

export const TaskStateSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('queued') }),
  z.object({
    status: z.literal('running'),
    progress: TaskProgressSchema,
    updates: z.array(TaskUpdateSchema).max(200),
  }),
  z.object({
    status: z.literal('monitoring'),
    lastCheckedAt: z.iso.datetime().optional(),
    nextCheckAt: z.iso.datetime(),
    paused: z.boolean(),
  }),
  z.object({
    status: z.literal('completed'),
    result: ActionResultSchema,
    completedAt: z.iso.datetime(),
  }),
  z.object({
    status: z.literal('failed'),
    error: ActionErrorSchema,
    failedAt: z.iso.datetime(),
  }),
  z.object({ status: z.literal('cancelled'), cancelledAt: z.iso.datetime() }),
]);
export type TaskState = z.infer<typeof TaskStateSchema>;
export type TaskStatus = TaskState['status'];

export const TaskSchema = z.object({
  request: TaskRequestSchema,
  state: TaskStateSchema,
  updatedAt: z.iso.datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

/** Counted on the toolbar badge. */
export function isActiveTask(state: TaskState): boolean {
  return state.status === 'queued' || state.status === 'running' || state.status === 'monitoring';
}
