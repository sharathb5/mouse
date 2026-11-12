import { z } from 'zod';
import { TrackConditionSchema } from './action';
import { SelectedContextSchema } from './context';
import { AgentDestinationSchema } from './destination';
import { SavedActionSchema, TrustedRuleSchema } from './destinations-config';
import { ModelProviderSettingsSchema } from './model';
import { TaskApprovalSchema, TaskIdSchema, TaskSchema } from './task';
import { TrackerSnapshotSchema } from './tracker';

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
  /** Workstream C: ask an open tab to extract a tracker snapshot from its live DOM. */
  z.object({ type: z.literal('agentic-mouse/extract-snapshot') }),
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

export const ExtractSnapshotResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), snapshot: TrackerSnapshotSchema }),
  z.object({ ok: z.literal(false), reason: z.string().min(1) }),
]);
export type ExtractSnapshotResponse = z.infer<typeof ExtractSnapshotResponseSchema>;

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
 * Popup → background messages for model provider settings.
 * Never carry API keys in responses to content scripts; only a configured flag.
 */
export const ModelBackgroundMessageSchema = z.discriminatedUnion('type', [
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
export type ModelBackgroundMessage = z.infer<typeof ModelBackgroundMessageSchema>;

/** Content → background messages for Track lifecycle (Workstream C). */
export const TrackBackgroundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agentic-mouse/track/start'),
    url: z.url(),
    title: z.string().max(1000),
    condition: TrackConditionSchema,
    initialSnapshot: TrackerSnapshotSchema,
  }),
  z.object({ type: z.literal('agentic-mouse/track/pause'), trackerId: z.string().min(1) }),
  z.object({ type: z.literal('agentic-mouse/track/resume'), trackerId: z.string().min(1) }),
  z.object({ type: z.literal('agentic-mouse/track/cancel'), trackerId: z.string().min(1) }),
  z.object({ type: z.literal('agentic-mouse/track/check-now'), trackerId: z.string().min(1) }),
  z.object({ type: z.literal('agentic-mouse/track/list') }),
]);
export type TrackBackgroundMessage = z.infer<typeof TrackBackgroundMessageSchema>;

const PageLinkCandidateMessageSchema = z.object({
  url: z.url(),
  text: z.string().max(200),
});

/**
 * Compare alternatives: optional OpenRouter ranking of on-page links.
 * Credentials stay in the background; content only sends link candidates already on the page.
 */
export const AlternativesBackgroundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('agentic-mouse/alternatives/rank-links'),
    seed: z.object({
      name: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      kind: z.string().min(1),
      url: z.url().optional(),
      fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    }),
    links: z.array(PageLinkCandidateMessageSchema).max(40),
  }),
]);
export type AlternativesBackgroundMessage = z.infer<typeof AlternativesBackgroundMessageSchema>;

export const AlternativesRankResponseSchema = z.object({
  ok: z.literal(true),
  urls: z.array(z.url()).max(5),
  usedOpenRouter: z.boolean(),
  notice: z.string().max(500).optional(),
});
export type AlternativesRankResponse = z.infer<typeof AlternativesRankResponseSchema>;

const TableExportPayloadSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        type: z.enum(['text', 'number', 'currency', 'url', 'date', 'boolean']),
      }),
    )
    .min(1),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  sources: z.array(z.url()).max(50),
});

/** Google Sheets status / connect / export (credentials never returned to content). */
export const SheetsBackgroundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agentic-mouse/sheets/status') }),
  z.object({
    type: z.literal('agentic-mouse/sheets/set-client-id'),
    clientId: z.string().max(256),
  }),
  z.object({ type: z.literal('agentic-mouse/sheets/connect') }),
  z.object({ type: z.literal('agentic-mouse/sheets/disconnect') }),
  z.object({
    type: z.literal('agentic-mouse/sheets/export'),
    table: TableExportPayloadSchema,
  }),
]);
export type SheetsBackgroundMessage = z.infer<typeof SheetsBackgroundMessageSchema>;

export const SheetsStatusResponseSchema = z.object({
  ok: z.literal(true),
  configured: z.boolean(),
  clientIdConfigured: z.boolean(),
  reason: z.string().max(500).optional(),
});
export type SheetsStatusResponse = z.infer<typeof SheetsStatusResponseSchema>;

export const SheetsExportResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), url: z.url() }),
  z.object({ ok: z.literal(false), reason: z.string().min(1) }),
]);
export type SheetsExportResponse = z.infer<typeof SheetsExportResponseSchema>;

/** Union of popup/content → background one-shot messages. */
export const BackgroundMessageSchema = z.union([
  ModelBackgroundMessageSchema,
  TrackBackgroundMessageSchema,
  AlternativesBackgroundMessageSchema,
  SheetsBackgroundMessageSchema,
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

export const TrackStartResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    trackerId: z.string().min(1),
    taskId: z.string().min(1),
    nextCheckAt: z.iso.datetime(),
  }),
  z.object({ ok: z.literal(false), reason: z.string().min(1) }),
]);
export type TrackStartResponse = z.infer<typeof TrackStartResponseSchema>;

export const TrackMutationResponseSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
});
export type TrackMutationResponse = z.infer<typeof TrackMutationResponseSchema>;
