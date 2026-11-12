import { z } from 'zod';
import { ActionIdSchema, type ActionId } from './action';
import { DEFAULT_MODEL_PREFERENCES, ModelPreferencesSchema, type ModelPreferences } from './model';

export const SETTINGS_VERSION = 1;
export const MAX_PINNED_ACTIONS = 8;

export const DEFAULT_PINNED_ACTIONS: readonly ActionId[] = [
  'explain',
  'select-content',
  'send-to-agent',
];

/**
 * - `shift-right-click` (default): Shift + right-click opens Agentic Mouse; right-click is native.
 * - `right-click` (reversed): right-click opens Agentic Mouse; Shift + right-click is native.
 */
export const TriggerModeSchema = z.enum(['shift-right-click', 'right-click']);
export type TriggerMode = z.infer<typeof TriggerModeSchema>;

export const PinnedActionsSchema = z
  .array(ActionIdSchema)
  .max(MAX_PINNED_ACTIONS)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Pinned actions must be unique' });

export const SettingsSchema = z.object({
  version: z.literal(SETTINGS_VERSION),
  enabled: z.boolean(),
  triggerMode: TriggerModeSchema,
  pinnedActionIds: PinnedActionsSchema,
  /** Non-secret model preferences. API keys live in a separate storage item. */
  model: ModelPreferencesSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  enabled: true,
  triggerMode: 'shift-right-click',
  pinnedActionIds: [...DEFAULT_PINNED_ACTIONS],
  model: { ...DEFAULT_MODEL_PREFERENCES },
};

/** Drops unknown and duplicate ids, preserving order, and caps the list length. */
export function normalizePinnedActionIds(raw: unknown): ActionId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PINNED_ACTIONS];
  const seen = new Set<ActionId>();
  for (const value of raw) {
    const parsed = ActionIdSchema.safeParse(value);
    if (parsed.success && !seen.has(parsed.data)) seen.add(parsed.data);
    if (seen.size === MAX_PINNED_ACTIONS) break;
  }
  return [...seen];
}

function parseModelPreferences(raw: unknown): ModelPreferences {
  const parsed = ModelPreferencesSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_MODEL_PREFERENCES };
  const record = raw as Record<string, unknown>;
  const providerId = ModelPreferencesSchema.shape.providerId.safeParse(record.providerId);
  const modelId = ModelPreferencesSchema.shape.modelId.safeParse(record.modelId);
  return {
    providerId: providerId.success ? providerId.data : DEFAULT_MODEL_PREFERENCES.providerId,
    modelId: modelId.success ? modelId.data : DEFAULT_MODEL_PREFERENCES.modelId,
  };
}

/**
 * Reads persisted settings defensively. Storage may hold data from an older build or be
 * hand-edited, so each field falls back to its default independently instead of
 * discarding the user's other preferences.
 */
export function parseSettings(raw: unknown): Settings {
  const full = SettingsSchema.safeParse(raw);
  if (full.success) return full.data;
  if (typeof raw !== 'object' || raw === null) return structuredClone(DEFAULT_SETTINGS);

  const record = raw as Record<string, unknown>;
  const enabled = z.boolean().safeParse(record.enabled);
  const triggerMode = TriggerModeSchema.safeParse(record.triggerMode);
  return {
    version: SETTINGS_VERSION,
    enabled: enabled.success ? enabled.data : DEFAULT_SETTINGS.enabled,
    triggerMode: triggerMode.success ? triggerMode.data : DEFAULT_SETTINGS.triggerMode,
    pinnedActionIds:
      record.pinnedActionIds === undefined
        ? [...DEFAULT_PINNED_ACTIONS]
        : normalizePinnedActionIds(record.pinnedActionIds),
    model: parseModelPreferences(record.model),
  };
}
