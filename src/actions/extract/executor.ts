import type { ActionExecutor } from '@/core/actions';
import type { ActionEvent, ActionResult } from '@/core/contracts';
import { normalize, sourcesFor } from '@/core/normalize';
import { extractFromDocument, type SourceAdapter } from '@/core/sources';
import type { SheetsExporter } from './sheets';
import { UnconfiguredSheetsExporter } from './sheets';

export interface ExtractExecutorDeps {
  getDocument: () => Document;
  getPageUrl?: () => string;
  adapters?: readonly SourceAdapter[];
  /** Optional Sheets export path; status is reflected as a table notice. */
  sheets?: SheetsExporter;
}

export function createExtractExecutor(deps: ExtractExecutorDeps): ActionExecutor<'extract'> {
  const sheets = deps.sheets ?? new UnconfiguredSheetsExporter();

  return {
    actionId: 'extract',
    async *execute(input, signal): AsyncIterable<ActionEvent> {
      if (signal.aborted) {
        yield {
          type: 'error',
          error: { code: 'cancelled', message: 'Extract cancelled.', retryable: false },
        };
        return;
      }

      if (input.context.containsSensitiveData) {
        yield {
          type: 'error',
          error: {
            code: 'sensitive-content',
            message: 'Extract will not process sensitive fields.',
            retryable: false,
          },
        };
        return;
      }

      yield {
        type: 'progress',
        progress: { mode: 'indeterminate', label: 'Extracting structured rows' },
      };

      await Promise.resolve();

      const doc = deps.getDocument();
      const pageUrl = deps.getPageUrl?.() ?? input.context.source.url;
      const items = extractFromDocument(doc, pageUrl, deps.adapters);
      if (items.length === 0) {
        yield {
          type: 'result',
          result: {
            kind: 'unavailable',
            actionId: 'extract',
            reason: 'No structured product, job, or listing data found on this page.',
          },
        };
        return;
      }

      const { columns, rows } = normalize(items);
      const sheetsStatus = await sheets.status();
      const notice = !sheetsStatus.configured
        ? sheetsStatus.reason
        : 'Google Sheets export is available from this result.';

      const result: Extract<ActionResult, { kind: 'table' }> = {
        kind: 'table',
        columns,
        rows,
        sources: sourcesFor(items),
        notice,
      };
      yield { type: 'result', result };
    },
  };
}

export type { SheetsExporter, SheetsExporterStatus } from './sheets';
export {
  UnconfiguredSheetsExporter,
  GoogleSheetsExporter,
  SheetsNotConfiguredError,
  createGoogleSheetsApi,
  tableToSheetValues,
  SHEETS_API_HOST_PERMISSION,
  GOOGLE_ACCOUNTS_HOST_PERMISSION,
  SHEETS_SCOPE,
} from './sheets';
