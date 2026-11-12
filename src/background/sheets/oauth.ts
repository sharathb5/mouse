import { browser } from 'wxt/browser';
import {
  GOOGLE_ACCOUNTS_HOST_PERMISSION,
  SHEETS_API_HOST_PERMISSION,
  SHEETS_SCOPE,
} from '@/actions/extract/sheets';
import {
  clearGoogleSheetsAccessToken,
  getValidGoogleSheetsAccessToken,
  loadGoogleSheetsCredentials,
  saveGoogleSheetsAccessToken,
} from '@/platform/google-sheets-credentials';

export async function ensureSheetsHostPermissions(): Promise<boolean> {
  try {
    const origins = [SHEETS_API_HOST_PERMISSION, GOOGLE_ACCOUNTS_HOST_PERMISSION];
    const already = await browser.permissions.contains({ origins });
    if (already) return true;
    return await browser.permissions.request({ origins });
  } catch {
    return false;
  }
}

/**
 * Interactive Google OAuth via chrome.identity.launchWebAuthFlow.
 * Requires a user-supplied OAuth client ID (Chrome extension type recommended).
 */
export async function connectGoogleSheets(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const creds = await loadGoogleSheetsCredentials();
  if (!creds.oauthClientId) {
    return {
      ok: false,
      reason:
        'Add a Google OAuth client ID in Settings before connecting. Use a Chrome extension OAuth client from Google Cloud Console.',
    };
  }

  const granted = await ensureSheetsHostPermissions();
  if (!granted) {
    return { ok: false, reason: 'Google Sheets host permission was not granted.' };
  }

  const redirectUri = browser.identity.getRedirectURL();
  const params = new URLSearchParams({
    client_id: creds.oauthClientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: SHEETS_SCOPE,
    prompt: 'consent',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  let redirectUrl: string | undefined;
  try {
    redirectUrl = await browser.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Google sign-in was cancelled or failed.',
    };
  }

  if (!redirectUrl) {
    return { ok: false, reason: 'Google sign-in did not return a redirect URL.' };
  }

  const token = parseImplicitToken(redirectUrl);
  if (!token) {
    return { ok: false, reason: 'Google OAuth did not return an access token.' };
  }

  await saveGoogleSheetsAccessToken(
    token.accessToken,
    token.expiresIn ? Date.now() + token.expiresIn * 1000 : undefined,
  );
  return { ok: true };
}

export async function disconnectGoogleSheets(): Promise<void> {
  await clearGoogleSheetsAccessToken();
}

export async function resolveSheetsAccessToken(): Promise<string | null> {
  return getValidGoogleSheetsAccessToken();
}

function parseImplicitToken(
  redirectUrl: string,
): { accessToken: string; expiresIn?: number } | null {
  try {
    const url = new URL(redirectUrl);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    const accessToken = hash.get('access_token');
    if (!accessToken) return null;
    const expiresRaw = hash.get('expires_in');
    const expiresIn = expiresRaw ? Number(expiresRaw) : undefined;
    return {
      accessToken,
      ...(expiresIn !== undefined && Number.isFinite(expiresIn) ? { expiresIn } : {}),
    };
  } catch {
    return null;
  }
}
