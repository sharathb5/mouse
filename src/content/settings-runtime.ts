import { storage } from 'wxt/utils/storage';
import { isActionId, type ActionId } from '@/core/contracts/action-ids';
import type { Settings, TriggerMode } from '@/core/contracts';
import {
  DEFAULT_PINNED_ACTIONS,
  DEFAULT_SETTINGS,
  MAX_PINNED_ACTIONS,
  SETTINGS_VERSION,
} from '@/core/contracts/settings-defaults';

/**
 * Zod-free settings load/watch for the content-script hot path.
 * Defaults come from `settings-defaults` (shared with the Zod settings module).
 */
const SETTINGS_STORAGE_KEY = 'local:settings';
const settingsItem = storage.defineItem<unknown>(SETTINGS_STORAGE_KEY, { fallback: null });

function normalizePinnedActionIds(raw: unknown): ActionId[] {
  if (!Array.isArray(raw)) return [...DEFAULT_PINNED_ACTIONS];
  const seen = new Set<ActionId>();
  for (const value of raw) {
    if (typeof value === 'string' && isActionId(value) && !seen.has(value)) {
      seen.add(value);
    }
    if (seen.size === MAX_PINNED_ACTIONS) break;
  }
  return [...seen];
}

function parseTriggerMode(raw: unknown): TriggerMode {
  return raw === 'right-click' || raw === 'shift-right-click' ? raw : DEFAULT_SETTINGS.triggerMode;
}

function parseModel(raw: unknown): Settings['model'] {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS.model };
  const record = raw as Record<string, unknown>;
  const providerId =
    record.providerId === 'openrouter' || record.providerId === 'mock'
      ? record.providerId
      : DEFAULT_SETTINGS.model.providerId;
  const modelId =
    typeof record.modelId === 'string' && record.modelId.length > 0
      ? record.modelId
      : DEFAULT_SETTINGS.model.modelId;
  return { providerId, modelId };
}

function parseNotifications(raw: unknown): Settings['notifications'] {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS.notifications };
  const record = raw as Record<string, unknown>;
  return {
    taskCompleted:
      typeof record.taskCompleted === 'boolean'
        ? record.taskCompleted
        : DEFAULT_SETTINGS.notifications.taskCompleted,
    trackConditionMet:
      typeof record.trackConditionMet === 'boolean'
        ? record.trackConditionMet
        : DEFAULT_SETTINGS.notifications.trackConditionMet,
  };
}

/** Defensive parse mirrored from `parseSettings`, without pulling Zod into the content shell. */
export function parseContentSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return structuredClone(DEFAULT_SETTINGS);
  const record = raw as Record<string, unknown>;
  return {
    version: SETTINGS_VERSION,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_SETTINGS.enabled,
    triggerMode: parseTriggerMode(record.triggerMode),
    pinnedActionIds:
      record.pinnedActionIds === undefined
        ? [...DEFAULT_PINNED_ACTIONS]
        : normalizePinnedActionIds(record.pinnedActionIds),
    model: parseModel(record.model),
    notifications: parseNotifications(record.notifications),
  };
}

export async function loadContentSettings(): Promise<Settings> {
  return parseContentSettings(await settingsItem.getValue());
}

export function watchContentSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(parseContentSettings(value)));
}
