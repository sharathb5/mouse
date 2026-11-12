import { storage } from 'wxt/utils/storage';
import { z } from 'zod';

/**
 * Secrets live only in extension storage and are read exclusively by the background
 * service worker. Never send raw keys to content scripts or page contexts.
 */
export const CREDENTIALS_STORAGE_KEY = 'local:credentials';

const CredentialsSchema = z.object({
  version: z.literal(1),
  cursorApiKey: z.string().min(1).max(512).optional(),
});
type Credentials = z.infer<typeof CredentialsSchema>;

const credentialsItem = storage.defineItem<unknown>(CREDENTIALS_STORAGE_KEY, { fallback: null });

function parseCredentials(raw: unknown): Credentials {
  const parsed = CredentialsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return { version: 1 };
}

export async function getCursorApiKey(): Promise<string | undefined> {
  const creds = parseCredentials(await credentialsItem.getValue());
  return creds.cursorApiKey;
}

export async function isCursorConfigured(): Promise<boolean> {
  return (await getCursorApiKey()) !== undefined;
}

export async function setCursorApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error('API key must not be empty');
  await credentialsItem.setValue({ version: 1, cursorApiKey: trimmed } satisfies Credentials);
}

export async function clearCursorApiKey(): Promise<void> {
  await credentialsItem.setValue({ version: 1 } satisfies Credentials);
}
