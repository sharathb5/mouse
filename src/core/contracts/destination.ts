import { z } from 'zod';

/**
 * What a destination can genuinely do. Only `background-execution` destinations may
 * create tracked tasks; a prefilled chat link must never be presented as a running task.
 */
export const DestinationCapabilitySchema = z.enum([
  'background-execution',
  'prefill-only',
  'copy-only',
]);
export type DestinationCapability = z.infer<typeof DestinationCapabilitySchema>;

const base = {
  id: z.string().min(1),
  label: z.string().min(1).max(60),
  isDefault: z.boolean(),
};

export const CursorCloudAgentDestinationSchema = z.object({
  ...base,
  integration: z.literal('cursor-cloud-agent'),
  capability: z.literal('background-execution'),
  /** e.g. `github.com/org/repo`. Credentials are never stored here or exposed to pages. */
  repository: z.string().min(1).optional(),
  ref: z.string().min(1).optional(),
});
export type CursorCloudAgentDestination = z.infer<typeof CursorCloudAgentDestinationSchema>;

export const PrefillLinkDestinationSchema = z.object({
  ...base,
  integration: z.literal('prefill-link'),
  capability: z.literal('prefill-only'),
  provider: z.enum(['chatgpt', 'claude', 'gemini', 'perplexity', 'custom']),
  /** Must contain `{prompt}`; the URL is opened for the user, nothing runs in the background. */
  urlTemplate: z.url().refine((url) => url.includes('%7Bprompt%7D') || url.includes('{prompt}'), {
    message: 'urlTemplate must contain {prompt}',
  }),
});
export type PrefillLinkDestination = z.infer<typeof PrefillLinkDestinationSchema>;

export const ClipboardDestinationSchema = z.object({
  ...base,
  integration: z.literal('clipboard'),
  capability: z.literal('copy-only'),
});
export type ClipboardDestination = z.infer<typeof ClipboardDestinationSchema>;

export const AgentDestinationSchema = z.discriminatedUnion('integration', [
  CursorCloudAgentDestinationSchema,
  PrefillLinkDestinationSchema,
  ClipboardDestinationSchema,
]);
export type AgentDestination = z.infer<typeof AgentDestinationSchema>;

/** Destinations that can run work without the user's tab staying open. */
export const BackgroundDestinationSchema = CursorCloudAgentDestinationSchema;
export type BackgroundDestination = z.infer<typeof BackgroundDestinationSchema>;

export function canCreateTask(destination: AgentDestination): destination is BackgroundDestination {
  return destination.capability === 'background-execution';
}
