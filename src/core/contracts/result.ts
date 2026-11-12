import { z } from 'zod';
import { ActionIdSchema, TrackConditionSchema } from './action';
import { SelectedContextSchema } from './context';

const CellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const ColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'currency', 'url', 'date', 'boolean']),
});
export type Column = z.infer<typeof ColumnSchema>;

const sources = z.array(z.url()).max(50);

/** Structured outcome of an action. Results must be grounded: include sources when claims come from pages. */
export const ActionResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('inline-text'),
    purpose: z.enum([
      'explanation',
      'summary',
      'translation',
      'answer',
      'simplification',
      'deep-dive',
      'example',
    ]),
    format: z.enum(['markdown', 'plain']),
    text: z.string(),
    sources,
  }),
  z.object({ kind: z.literal('selection'), context: SelectedContextSchema }),
  z.object({
    kind: z.literal('table'),
    columns: z.array(ColumnSchema).min(1),
    rows: z.array(z.record(z.string(), CellSchema)),
    sources,
    /** Honest UX note (e.g. Sheets export unavailable). Never used to invent rows. */
    notice: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal('comparison'),
    attributes: z.array(ColumnSchema).min(1),
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          url: z.url(),
          values: z.record(z.string(), CellSchema),
        }),
      )
      .min(2),
    summary: z.string(),
    sources,
    /** Honest UX note (e.g. remote alternatives unconfigured). Never invents attributes. */
    notice: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal('handoff'),
    destinationId: z.string().min(1),
    outcome: z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('task-created'),
        taskId: z.string().min(1),
        externalUrl: z.url().optional(),
      }),
      z.object({ mode: z.literal('prefill-opened'), url: z.url() }),
      z.object({ mode: z.literal('copied') }),
    ]),
  }),
  z.object({
    kind: z.literal('tracking'),
    trackerId: z.string().min(1),
    condition: TrackConditionSchema,
    nextCheckAt: z.iso.datetime(),
  }),
  z.object({
    kind: z.literal('unavailable'),
    actionId: ActionIdSchema,
    reason: z.string().min(1),
  }),
]);
export type ActionResult = z.infer<typeof ActionResultSchema>;

export const ActionErrorSchema = z.object({
  code: z.enum([
    'unavailable',
    'invalid-input',
    'permission-denied',
    'approval-required',
    'sensitive-content',
    'network',
    'provider',
    'timeout',
    'cancelled',
    'internal',
  ]),
  message: z.string().min(1),
  retryable: z.boolean(),
});
export type ActionError = z.infer<typeof ActionErrorSchema>;
