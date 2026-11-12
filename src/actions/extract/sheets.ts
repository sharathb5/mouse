import type { ActionResult } from '@/core/contracts';

type TableResult = Extract<ActionResult, { kind: 'table' }>;

/**
 * Optional Google Sheets export. V1 ships the interface only — OAuth via chrome.identity is an
 * open product decision. Callers must not claim a real export succeeded when using the mock.
 */
export interface SheetsExporter {
  export(result: TableResult): Promise<{ url: string }>;
}

/** MOCKED: refuses export and surfaces that Sheets is not configured. */
export class UnconfiguredSheetsExporter implements SheetsExporter {
  export(result: TableResult): Promise<{ url: string }> {
    return Promise.reject(
      new Error(
        `Google Sheets export is not configured (open decision: chrome.identity OAuth). Received ${result.columns.length} columns.`,
      ),
    );
  }
}
