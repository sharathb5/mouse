import { storage } from 'wxt/utils/storage';

/**
 * OpenRouter (and future) API keys. Only the background service worker and the popup
 * settings UI should read/write this item — never expose it to content scripts or pages.
 */
export const MODEL_API_KEY_STORAGE_KEY = 'local:modelApiKey';

const apiKeyItem = storage.defineItem<string | null>(MODEL_API_KEY_STORAGE_KEY, {
  fallback: null,
});

export async function loadModelApiKey(): Promise<string | null> {
  const value = await apiKeyItem.getValue();
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function saveModelApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await apiKeyItem.removeValue();
    return;
  }
  await apiKeyItem.setValue(trimmed);
}

export async function clearModelApiKey(): Promise<void> {
  await apiKeyItem.removeValue();
}

export async function hasModelApiKey(): Promise<boolean> {
  return (await loadModelApiKey()) !== null;
}
