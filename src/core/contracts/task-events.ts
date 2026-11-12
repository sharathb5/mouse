import { z } from 'zod';
import { ActionErrorSchema, ActionResultSchema } from './result';
import { TaskProgressSchema, TaskUpdateSchema } from './task';

/**
 * Inputs to the pure task state machine. Callers apply `transition(state, event)`;
 * persistence and side effects live outside `src/core`.
 */
export const TaskEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('enqueue') }),
  z.object({
    type: z.literal('start'),
    progress: TaskProgressSchema.default({ mode: 'indeterminate' }),
    update: TaskUpdateSchema.optional(),
  }),
  z.object({
    type: z.literal('progress'),
    progress: TaskProgressSchema,
    update: TaskUpdateSchema.optional(),
  }),
  z.object({ type: z.literal('update'), update: TaskUpdateSchema }),
  z.object({
    type: z.literal('enter-monitoring'),
    nextCheckAt: z.iso.datetime(),
    lastCheckedAt: z.iso.datetime().optional(),
    paused: z.boolean().default(false),
  }),
  z.object({ type: z.literal('pause-monitoring') }),
  z.object({
    type: z.literal('resume-monitoring'),
    nextCheckAt: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('complete'),
    result: ActionResultSchema,
    completedAt: z.iso.datetime(),
  }),
  z.object({
    type: z.literal('fail'),
    error: ActionErrorSchema,
    failedAt: z.iso.datetime(),
  }),
  z.object({ type: z.literal('cancel'), cancelledAt: z.iso.datetime() }),
]);
export type TaskEvent = z.infer<typeof TaskEventSchema>;
