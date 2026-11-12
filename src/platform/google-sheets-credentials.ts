import { storage } from 'wxt/utils/storage';
import { z } from 'zod';

/**
 * Google Sheets OAuth client id + access token. Background / popup only —
 * never expose tokens to content scripts or pages.
 */
export const GOOGLE_SHEETS_CREDENTIALS_KEY = 'local:googleSheetsCredentials';

const GoogleSheetsCredentialsSchema = z.object({
  version: z.literal(1),
  /** Chrome-extension or web OAuth client ID from Google Cloud Console. */
  oauthClientId: z.string().min(1).max(256).optional(),
  accessToken: z.string().min(1).max(4096).optional(),
  /** Epoch ms when accessToken expires; optional if unknown. */
  expiresAt: z.number().int().positive().optional(),
});
export type GoogleSheetsCredentials = z.infer<typeof GoogleSheetsCredentialsSchema>;

const credentialsItem = storage.defineItem<unknown>(GOOGLE_SHEETS_CREDENTIALS_KEY, {
  fallback: null,
});

function parse(raw: unknown): GoogleSheetsCredentials {
  const parsed = GoogleSheetsCredentialsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return { version: 1 };
}

export async function loadGoogleSheetsCredentials(): Promise<GoogleSheetsCredentials> {
  return parse(await credentialsItem.getValue());
}

export async function saveGoogleSheetsClientId(clientId: string): Promise<void> {
  const trimmed = clientId.trim();
  const current = await loadGoogleSheetsCredentials();
  if (!trimmed) {
    const next: GoogleSheetsCredentials = { version: 1 };
    if (current.accessToken) {
      next.accessToken = current.accessToken;
      if (current.expiresAt !== undefined) next.expiresAt = current.expiresAt;
    }
    await credentialsItem.setValue(next);
    return;
  }
  const next: GoogleSheetsCredentials = { version: 1, oauthClientId: trimmed };
  if (current.accessToken) next.accessToken = current.accessToken;
  if (current.expiresAt !== undefined) next.expiresAt = current.expiresAt;
  await credentialsItem.setValue(next);
}

export async function saveGoogleSheetsAccessToken(
  accessToken: string,
  expiresAt?: number,
): Promise<void> {
  const current = await loadGoogleSheetsCredentials();
  const next: GoogleSheetsCredentials = { version: 1, accessToken: accessToken.trim() };
  if (current.oauthClientId) next.oauthClientId = current.oauthClientId;
  if (expiresAt !== undefined) next.expiresAt = expiresAt;
  await credentialsItem.setValue(next);
}

export async function clearGoogleSheetsAccessToken(): Promise<void> {
  const current = await loadGoogleSheetsCredentials();
  const next: GoogleSheetsCredentials = { version: 1 };
  if (current.oauthClientId) next.oauthClientId = current.oauthClientId;
  await credentialsItem.setValue(next);
}

export async function clearGoogleSheetsCredentials(): Promise<void> {
  await credentialsItem.setValue({ version: 1 } satisfies GoogleSheetsCredentials);
}

export async function isGoogleSheetsConfigured(): Promise<boolean> {
  const creds = await loadGoogleSheetsCredentials();
  if (!creds.accessToken) return false;
  if (creds.expiresAt !== undefined && Date.now() >= creds.expiresAt - 30_000) return false;
  return true;
}

export async function getValidGoogleSheetsAccessToken(): Promise<string | null> {
  const creds = await loadGoogleSheetsCredentials();
  if (!creds.accessToken) return null;
  if (creds.expiresAt !== undefined && Date.now() >= creds.expiresAt - 30_000) return null;
  return creds.accessToken;
}
