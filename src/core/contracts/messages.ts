import { z } from 'zod';
import { SelectedContextSchema } from './context';
import { AgentDestinationSchema } from './destination';
import { SavedActionSchema, TrustedRuleSchema } from './destinations-config';
import { ModelProviderSettingsSchema } from './model';
import { TaskApprovalSchema, TaskIdSchema, TaskSchema } from './task';

/** Manifest command name for the fallback keyboard shortcut (see wxt.config.ts). */
export const OPEN_MENU_COMMAND = 'open-agentic-mouse';

/**
 * Extension-internal messages (background/popup -> content script). Webpages cannot send
 * these, but every receiver still validates payloads before acting on them.
 */
export const ContentScriptMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agentic-mouse/ping') }),
  z.object({
    type: z.literal('agentic-mouse/open-menu'),
    source: z.enum(['shortcut']),
  }),
]);
export type ContentScriptMessage = z.infer<typeof ContentScriptMessageSchema>;

export const PingResponseSchema = z.object({
  ok: z.literal(true),
  /** Settings and the Shadow DOM UI are loaded, so gestures will be handled. */
  ready: z.boolean(),
  menuOpen: z.boolean(),
});
export type PingResponse = z.infer<typeof PingResponseSchema>;

export const OpenMenuResponseSchema = z.object({ opened: z.boolean() });
export type OpenMenuResponse = z.infer<typeof OpenMenuResponseSchema>;

export const TaskInboxCommandSchema = z.enum([
  'cancel',
  'pause',
  'resume',
  'dismiss',
  'open-result',
]);
export type TaskInboxCommand = z.infer<typeof TaskInboxCommandSchema>;

/** Send-to-Agent input shape used by background messages (mirrors ActionInput variant). */
export const SendToAgentInputSchema = z.object({
  actionId: z.literal('send-to-agent'),
  context: SelectedContextSchema,
  destinationId: z.string().min(1),
  instructions: z.string().max(4000).optional(),
  savedActionId: z.string().min(1).optional(),
});
export type SendToAgentInput = z.infer<typeof SendToAgentInputSchema>;

export const HandoffResultSchema = z.object({
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
});
export type HandoffResult = z.infer<typeof HandoffResultSchema>;

/**
 * Messages handled by the background service worker. Content scripts never receive API
 * keys; credential writes are accepted only from extension pages (checked at runtime).
 */
export const BackgroundRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agentic-mouse/list-destinations') }),
  z.object({ type: z.literal('agentic-mouse/list-tasks') }),
  z.object({ type: z.literal('agentic-mouse/credentials-status') }),
  z.object({
    type: z.literal('agentic-mouse/set-cursor-api-key'),
    apiKey: z.string().min(1).max(512),
  }),
  z.object({ type: z.literal('agentic-mouse/clear-cursor-api-key') }),
  z.object({
    type: z.literal('agentic-mouse/save-destinations'),
    destinations: z.array(AgentDestinationSchema).min(1),
    savedActions: z.array(SavedActionSchema).max(50).optional(),
    trustedRules: z.array(TrustedRuleSchema).max(100).optional(),
  }),
  z.object({
    type: z.literal('agentic-mouse/create-agent-task'),
    destinationId: z.string().min(1),
    input: SendToAgentInputSchema,
    approval: TaskApprovalSchema,
    title: z.string().min(1).max(120).optional(),
  }),
  z.object({
    type: z.literal('agentic-mouse/handoff'),
    destinationId: z.string().min(1),
    input: SendToAgentInputSchema,
  }),
  z.object({
    type: z.literal('agentic-mouse/task-command'),
    taskId: TaskIdSchema,
    command: TaskInboxCommandSchema,
  }),
]);
export type BackgroundRequest = z.infer<typeof BackgroundRequestSchema>;

export const BackgroundResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('destinations'),
    destinations: z.array(AgentDestinationSchema),
    savedActions: z.array(SavedActionSchema),
    trustedRules: z.array(TrustedRuleSchema),
  }),
  z.object({ type: z.literal('tasks'), tasks: z.array(TaskSchema) }),
  z.object({
    type: z.literal('credentials-status'),
    cursorConfigured: z.boolean(),
  }),
  z.object({ type: z.literal('ok') }),
  z.object({
    type: z.literal('task-created'),
    taskId: TaskIdSchema,
    externalUrl: z.url().optional(),
  }),
  z.object({
    type: z.literal('handoff-result'),
    result: HandoffResultSchema,
  }),
  z.object({
    type: z.literal('error'),
    code: z.enum([
      'invalid-request',
      'not-found',
      'permission-denied',
      'approval-required',
      'not-configured',
      'network',
      'provider',
      'internal',
    ]),
    message: z.string().min(1),
  }),
]);
export type BackgroundResponse = z.infer<typeof BackgroundResponseSchema>;

/**
 * Popup/content → background one-shot messages for model provider settings.
 * Never carry API keys in responses to content scripts; only a configured flag.
 */
export const BackgroundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agentic-mouse/model-settings') }),
  z.object({
    type: z.literal('agentic-mouse/set-model-api-key'),
    apiKey: z.string(),
  }),
  z.object({ type: z.literal('agentic-mouse/clear-model-api-key') }),
  z.object({
    type: z.literal('agentic-mouse/request-openrouter-permission'),
  }),
]);
export type BackgroundMessage = z.infer<typeof BackgroundMessageSchema>;

export const ModelSettingsResponseSchema = z.object({
  ok: z.literal(true),
  settings: ModelProviderSettingsSchema,
});
export type ModelSettingsResponse = z.infer<typeof ModelSettingsResponseSchema>;

export const SetApiKeyResponseSchema = z.object({
  ok: z.literal(true),
  settings: ModelProviderSettingsSchema,
});
export type SetApiKeyResponse = z.infer<typeof SetApiKeyResponseSchema>;

export const PermissionResponseSchema = z.object({
  ok: z.literal(true),
  granted: z.boolean(),
});
export type PermissionResponse = z.infer<typeof PermissionResponseSchema>;
