import { storage } from 'wxt/utils/storage';
import { parseSettings, SettingsSchema, type Settings } from '@/core/contracts';

/** Settings live in `chrome.storage.local`; webpages cannot read or write them. */
export const SETTINGS_STORAGE_KEY = 'local:settings';

const settingsItem = storage.defineItem<unknown>(SETTINGS_STORAGE_KEY, { fallback: null });

export async function loadSettings(): Promise<Settings> {
  return parseSettings(await settingsItem.getValue());
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const valid = SettingsSchema.parse(settings);
  await settingsItem.setValue(valid);
  return valid;
}

export async function updateSettings(update: (current: Settings) => Settings): Promise<Settings> {
  return saveSettings(update(await loadSettings()));
}

export function watchSettings(onChange: (settings: Settings) => void): () => void {
  return settingsItem.watch((value) => onChange(parseSettings(value)));
}
