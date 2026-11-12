import type { ActionResult } from '@/core/contracts';

type TableResult = Extract<ActionResult, { kind: 'table' }>;

export type SheetsExporterStatus = { configured: false; reason: string } | { configured: true };

/**
 * Optional Google Sheets export. Copy/CSV remain the primary paths; Sheets is only
 * available when the user has configured OAuth credentials.
 */
export interface SheetsExporter {
  readonly id: string;
  status(): Promise<SheetsExporterStatus>;
  export(result: TableResult): Promise<{ url: string }>;
}

/** Honest refusal when Google OAuth / Sheets credentials are missing. */
export class UnconfiguredSheetsExporter implements SheetsExporter {
  readonly id = 'sheets-unconfigured';

  status(): Promise<SheetsExporterStatus> {
    return Promise.resolve({
      configured: false,
      reason:
        'Google Sheets export is not configured. Copy or download CSV instead, or connect Google in Settings.',
    });
  }

  async export(result: TableResult): Promise<{ url: string }> {
    const status = await this.status();
    const reason = !status.configured ? status.reason : 'Google Sheets export is not configured.';
    throw new SheetsNotConfiguredError(`${reason} (table had ${result.columns.length} columns).`);
  }
}

export class SheetsNotConfiguredError extends Error {
  readonly code = 'not-configured' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SheetsNotConfiguredError';
  }
}

export interface GoogleSheetsApi {
  createSpreadsheet(
    title: string,
    accessToken: string,
    signal: AbortSignal,
  ): Promise<{ id: string; url: string }>;
  writeValues(
    spreadsheetId: string,
    values: string[][],
    accessToken: string,
    signal: AbortSignal,
  ): Promise<void>;
}

export const SHEETS_API_HOST_PERMISSION = 'https://sheets.googleapis.com/*';
export const GOOGLE_ACCOUNTS_HOST_PERMISSION = 'https://accounts.google.com/*';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

/** Real Sheets API v4 client (fetch-based). Credentials stay with the caller (background). */
export function createGoogleSheetsApi(fetchImpl: typeof fetch = fetch): GoogleSheetsApi {
  return {
    async createSpreadsheet(title, accessToken, signal) {
      const response = await fetchImpl('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ properties: { title } }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Sheets create failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        );
      }
      const body = (await response.json()) as { spreadsheetId?: string; spreadsheetUrl?: string };
      if (!body.spreadsheetId || !body.spreadsheetUrl) {
        throw new Error('Sheets create returned no spreadsheet id/url');
      }
      return { id: body.spreadsheetId, url: body.spreadsheetUrl };
    },

    async writeValues(spreadsheetId, values, accessToken, signal) {
      const range = 'Sheet1!A1';
      const response = await fetchImpl(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        {
          method: 'PUT',
          signal,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
        },
      );
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Sheets write failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        );
      }
    },
  };
}

export function tableToSheetValues(result: TableResult): string[][] {
  const header = result.columns.map((column) => column.label);
  const rows = result.rows.map((row) =>
    result.columns.map((column) => {
      const value = row[column.key];
      if (value === null || value === undefined) return '';
      return String(value);
    }),
  );
  return [header, ...rows];
}

export interface GoogleSheetsExporterDeps {
  getAccessToken: (signal: AbortSignal) => Promise<string | null>;
  api?: GoogleSheetsApi;
  titleFor?: (result: TableResult) => string;
}

/**
 * Real Google Sheets exporter. Requires a configured OAuth access token provider.
 * When the token is missing, status/export stay honestly unconfigured — never fake a URL.
 */
export class GoogleSheetsExporter implements SheetsExporter {
  readonly id = 'google-sheets';
  private readonly api: GoogleSheetsApi;
  private readonly titleFor: (result: TableResult) => string;

  constructor(private readonly deps: GoogleSheetsExporterDeps) {
    this.api = deps.api ?? createGoogleSheetsApi();
    this.titleFor = deps.titleFor ?? (() => `Agentic Mouse extract ${new Date().toISOString()}`);
  }

  async status(): Promise<SheetsExporterStatus> {
    // Probe without a user gesture: only report configured when a token can be resolved.
    try {
      const token = await this.deps.getAccessToken(new AbortController().signal);
      if (!token) {
        return {
          configured: false,
          reason:
            'Google Sheets is not connected. Copy or download CSV, or connect Google OAuth in Settings.',
        };
      }
      return { configured: true };
    } catch {
      return {
        configured: false,
        reason:
          'Google Sheets is not connected. Copy or download CSV, or connect Google OAuth in Settings.',
      };
    }
  }

  async export(
    result: TableResult,
    signal: AbortSignal = new AbortController().signal,
  ): Promise<{ url: string }> {
    const token = await this.deps.getAccessToken(signal);
    if (!token) {
      throw new SheetsNotConfiguredError(
        'Google Sheets export requires a connected Google account (Settings → Google Sheets).',
      );
    }
    const created = await this.api.createSpreadsheet(this.titleFor(result), token, signal);
    await this.api.writeValues(created.id, tableToSheetValues(result), token, signal);
    return { url: created.url };
  }
}
