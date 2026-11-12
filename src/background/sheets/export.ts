import type { ActionResult } from '@/core/contracts';
import {
  GoogleSheetsExporter,
  createGoogleSheetsApi,
  type SheetsExporterStatus,
} from '@/actions/extract/sheets';
import { isGoogleSheetsConfigured } from '@/platform/google-sheets-credentials';
import { resolveSheetsAccessToken, ensureSheetsHostPermissions } from './oauth';

type TableResult = Extract<ActionResult, { kind: 'table' }>;

export async function sheetsStatus(): Promise<SheetsExporterStatus> {
  if (!(await isGoogleSheetsConfigured())) {
    return {
      configured: false,
      reason:
        'Google Sheets is not connected. Copy or download CSV, or connect Google OAuth in Settings.',
    };
  }
  return { configured: true };
}

export async function exportTableToSheets(
  result: TableResult,
  signal: AbortSignal = new AbortController().signal,
): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  const status = await sheetsStatus();
  if (!status.configured) {
    return { ok: false, reason: status.reason };
  }

  const granted = await ensureSheetsHostPermissions();
  if (!granted) {
    return { ok: false, reason: 'Google Sheets host permission was not granted.' };
  }

  const exporter = new GoogleSheetsExporter({
    getAccessToken: async () => resolveSheetsAccessToken(),
    api: createGoogleSheetsApi(),
  });

  try {
    const { url } = await exporter.export(result, signal);
    return { ok: true, url };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Sheets export failed.',
    };
  }
}
