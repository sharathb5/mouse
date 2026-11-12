import { z } from 'zod';
import { ActionErrorSchema, ActionResultSchema } from './result';
import { ActionIdSchema } from './action';
import { SelectedContextSchema } from './context';
import { TaskProgressSchema } from './task';

/** Default OpenRouter model; users can override in settings. */
export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

export const MODEL_PROVIDER_IDS = ['openrouter', 'mock'] as const;
export const ModelProviderIdSchema = z.enum(MODEL_PROVIDER_IDS);
export type ModelProviderId = z.infer<typeof ModelProviderIdSchema>;

/**
 * Content-script / popup-visible model settings. Never includes the API key — only whether
 * one is configured (background/storage owns the secret).
 */
export const ModelProviderSettingsSchema = z.object({
  providerId: ModelProviderIdSchema,
  modelId: z.string().min(1).max(200),
  /** True when an API key is stored (openrouter) or the mock provider is selected. */
  apiKeyConfigured: z.boolean(),
});
export type ModelProviderSettings = z.infer<typeof ModelProviderSettingsSchema>;

/** Persisted (non-secret) model preferences inside Settings. */
export const ModelPreferencesSchema = z.object({
  providerId: ModelProviderIdSchema,
  modelId: z.string().min(1).max(200),
});
export type ModelPreferences = z.infer<typeof ModelPreferencesSchema>;

export const DEFAULT_MODEL_PREFERENCES: ModelPreferences = {
  providerId: 'openrouter',
  modelId: DEFAULT_OPENROUTER_MODEL,
};

/** Port name for content ↔ background model streaming. */
export const MODEL_STREAM_PORT = 'agentic-mouse/model-stream';

/** Content → background: start a streaming completion. */
export const ModelStreamRequestSchema = z.object({
  type: z.literal('start'),
  requestId: z.string().min(1),
  system: z.string().min(1),
  untrustedContext: z.string(),
  userInstruction: z.string().min(1),
});
export type ModelStreamRequest = z.infer<typeof ModelStreamRequestSchema>;

export const ModelStreamAbortSchema = z.object({
  type: z.literal('abort'),
  requestId: z.string().min(1),
});
export type ModelStreamAbort = z.infer<typeof ModelStreamAbortSchema>;

export const ModelStreamClientMessageSchema = z.discriminatedUnion('type', [
  ModelStreamRequestSchema,
  ModelStreamAbortSchema,
]);
export type ModelStreamClientMessage = z.infer<typeof ModelStreamClientMessageSchema>;

/** Background → content: streamed tokens and terminal events. */
export const ModelStreamServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('delta'),
    requestId: z.string().min(1),
    delta: z.string(),
  }),
  z.object({
    type: z.literal('done'),
    requestId: z.string().min(1),
  }),
  z.object({
    type: z.literal('error'),
    requestId: z.string().min(1),
    error: ActionErrorSchema,
  }),
  z.object({
    type: z.literal('status'),
    requestId: z.string().min(1),
    settings: ModelProviderSettingsSchema,
  }),
]);
export type ModelStreamServerMessage = z.infer<typeof ModelStreamServerMessageSchema>;

/**
 * Port name for running a registered action from the content script and streaming
 * ActionEvents back. Credentials stay in the background.
 */
export const ACTION_RUN_PORT = 'agentic-mouse/action-run';

export const ActionRunRequestSchema = z.object({
  type: z.literal('start'),
  requestId: z.string().min(1),
  actionId: ActionIdSchema,
  context: SelectedContextSchema,
  /** Extra fields for actions that need them (question, language, etc.). */
  options: z.record(z.string(), z.unknown()).optional(),
});
export type ActionRunRequest = z.infer<typeof ActionRunRequestSchema>;

export const ActionRunAbortSchema = z.object({
  type: z.literal('abort'),
  requestId: z.string().min(1),
});
export type ActionRunAbort = z.infer<typeof ActionRunAbortSchema>;

export const ActionRunClientMessageSchema = z.discriminatedUnion('type', [
  ActionRunRequestSchema,
  ActionRunAbortSchema,
]);
export type ActionRunClientMessage = z.infer<typeof ActionRunClientMessageSchema>;

export const ActionRunServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    requestId: z.string().min(1),
    progress: TaskProgressSchema,
  }),
  z.object({
    type: z.literal('text-delta'),
    requestId: z.string().min(1),
    delta: z.string(),
  }),
  z.object({
    type: z.literal('result'),
    requestId: z.string().min(1),
    result: ActionResultSchema,
  }),
  z.object({
    type: z.literal('error'),
    requestId: z.string().min(1),
    error: ActionErrorSchema,
  }),
  z.object({
    type: z.literal('done'),
    requestId: z.string().min(1),
  }),
]);
export type ActionRunServerMessage = z.infer<typeof ActionRunServerMessageSchema>;
