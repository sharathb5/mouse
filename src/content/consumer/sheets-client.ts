import { browser } from 'wxt/browser';
import type { ActionResult } from '@/core/contracts';
import { SheetsExportResponseSchema, SheetsStatusResponseSchema } from '@/core/contracts';
import {
  SheetsNotConfiguredError,
  type SheetsExporter,
  type SheetsExporterStatus,
} from '@/actions/extract/sheets';

type TableResult = Extract<ActionResult, { kind: 'table' }>;

/**
 * Content-script SheetsExporter that never sees OAuth tokens. Status and export
 * are delegated to the background service worker.
 */
export class BackgroundSheetsExporter implements SheetsExporter {
  readonly id = 'sheets-background';

  async status(): Promise<SheetsExporterStatus> {
    try {
      const raw: unknown = await browser.runtime.sendMessage({
        type: 'agentic-mouse/sheets/status',
      });
      const parsed = SheetsStatusResponseSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          configured: false,
          reason: 'Google Sheets status unavailable. Copy or download CSV instead.',
        };
      }
      if (!parsed.data.configured) {
        return {
          configured: false,
          reason:
            parsed.data.reason ??
            'Google Sheets is not connected. Copy or download CSV, or connect Google OAuth in Settings.',
        };
      }
      return { configured: true };
    } catch {
      return {
        configured: false,
        reason: 'Google Sheets status unavailable. Copy or download CSV instead.',
      };
    }
  }

  async export(result: TableResult): Promise<{ url: string }> {
    const raw: unknown = await browser.runtime.sendMessage({
      type: 'agentic-mouse/sheets/export',
      table: {
        columns: result.columns,
        rows: result.rows,
        sources: result.sources,
      },
    });
    const parsed = SheetsExportResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SheetsNotConfiguredError(
        'Google Sheets export failed (invalid response). Copy or download CSV instead.',
      );
    }
    if (!parsed.data.ok) {
      throw new SheetsNotConfiguredError(parsed.data.reason);
    }
    return { url: parsed.data.url };
  }
}
