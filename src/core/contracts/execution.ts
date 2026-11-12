import { z } from 'zod';
import { ActionErrorSchema, ActionResultSchema } from './result';
import { TaskIdSchema, TaskProgressSchema } from './task';

/** Events an action executor yields. Inline actions stream `text-delta`s before a final `result`. */
export const ActionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('progress'), progress: TaskProgressSchema }),
  z.object({ type: z.literal('text-delta'), delta: z.string() }),
  z.object({ type: z.literal('task-created'), taskId: TaskIdSchema }),
  z.object({ type: z.literal('result'), result: ActionResultSchema }),
  z.object({ type: z.literal('error'), error: ActionErrorSchema }),
]);
export type ActionEvent = z.infer<typeof ActionEventSchema>;
