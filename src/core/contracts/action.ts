import { z } from 'zod';
import { SelectedContextSchema } from './context';
import { MoneySchema } from './classification';

export const ACTION_IDS = [
  'explain',
  'select-content',
  'send-to-agent',
  'summarize',
  'translate',
  'ask-follow-up',
  'simplify',
  'go-deeper',
  'example',
  'compare',
  'extract',
  'track',
] as const;
export const ActionIdSchema = z.enum(ACTION_IDS);
export type ActionId = z.infer<typeof ActionIdSchema>;

export const ActionCategorySchema = z.enum(['understand', 'select', 'delegate', 'real-world']);
export type ActionCategory = z.infer<typeof ActionCategorySchema>;

/**
 * Whether invoking the action shares page content outside the browser.
 * - `none`: processed locally.
 * - `on-invoke`: sent to a model/provider when the user invokes it (the invocation is consent).
 * - `requires-approval`: consequential external action; needs explicit approval or a trusted
 *   site-agent rule before anything is sent.
 */
export const DataEgressSchema = z.enum(['none', 'on-invoke', 'requires-approval']);
export type DataEgress = z.infer<typeof DataEgressSchema>;

/** Static description of an action. Runtime availability is derived by the registry. */
export const ActionDefinitionSchema = z.object({
  id: ActionIdSchema,
  label: z.string().min(1).max(32),
  description: z.string().min(1).max(160),
  category: ActionCategorySchema,
  dataEgress: DataEgressSchema,
  /** Whether results stream into the inline panel (Workstream A) or become a task (Workstream B). */
  presentation: z.enum(['inline-panel', 'selection', 'task']),
});
export type ActionDefinition = z.infer<typeof ActionDefinitionSchema>;

export const ActionAvailabilitySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available') }),
  z.object({ status: z.literal('coming-soon'), reason: z.string().min(1) }),
  z.object({ status: z.literal('blocked'), reason: z.string().min(1) }),
]);
export type ActionAvailability = z.infer<typeof ActionAvailabilitySchema>;

export const TrackConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('price-below'), threshold: MoneySchema }),
  z.object({ kind: z.literal('price-change') }),
  z.object({ kind: z.literal('availability-change') }),
  z.object({ kind: z.literal('content-change'), selectorHint: z.string().optional() }),
]);
export type TrackCondition = z.infer<typeof TrackConditionSchema>;

const context = SelectedContextSchema;

/** Per-action inputs. Every `ActionId` must have exactly one variant (enforced by tests). */
export const ActionInputSchema = z.discriminatedUnion('actionId', [
  z.object({ actionId: z.literal('explain'), context }),
  z.object({ actionId: z.literal('select-content'), context }),
  z.object({
    actionId: z.literal('send-to-agent'),
    context,
    destinationId: z.string().min(1),
    instructions: z.string().max(4000).optional(),
    savedActionId: z.string().min(1).optional(),
  }),
  z.object({
    actionId: z.literal('summarize'),
    context,
    length: z.enum(['brief', 'standard', 'detailed']),
  }),
  z.object({
    actionId: z.literal('translate'),
    context,
    targetLanguage: z.string().min(2).max(35),
  }),
  z.object({
    actionId: z.literal('ask-follow-up'),
    context,
    question: z.string().min(1).max(2000),
    conversationId: z.string().min(1).optional(),
  }),
  z.object({
    actionId: z.literal('simplify'),
    context,
    readingLevel: z.enum(['child', 'general', 'non-expert']),
  }),
  z.object({ actionId: z.literal('go-deeper'), context }),
  z.object({ actionId: z.literal('example'), context }),
  z.object({
    actionId: z.literal('compare'),
    context,
    candidateUrls: z.array(z.url()).max(10),
  }),
  z.object({
    actionId: z.literal('extract'),
    context,
    format: z.enum(['table']),
  }),
  z.object({
    actionId: z.literal('track'),
    context,
    condition: TrackConditionSchema,
  }),
]);
export type ActionInput = z.infer<typeof ActionInputSchema>;
export type ActionInputFor<A extends ActionId> = Extract<ActionInput, { actionId: A }>;
