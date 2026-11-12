import type { ActionId } from './action-ids';

/**
 * Zod-free settings constants. Modules on the content-script hot path import from here
 * so evaluating them does not load the contracts schema graph.
 */

export const SETTINGS_VERSION = 1 as const;
export const MAX_PINNED_ACTIONS = 8;

export const DEFAULT_PINNED_ACTIONS: readonly ActionId[] = [
  'explain',
  'select-content',
  'send-to-agent',
];

export const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';

export const DEFAULT_MODEL_PREFERENCES = {
  providerId: 'openrouter' as const,
  modelId: DEFAULT_OPENROUTER_MODEL,
};

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  taskCompleted: true,
  trackConditionMet: true,
};

export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  enabled: true,
  triggerMode: 'shift-right-click' as const,
  pinnedActionIds: [...DEFAULT_PINNED_ACTIONS] as ActionId[],
  model: { ...DEFAULT_MODEL_PREFERENCES },
  notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
};
