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
  /** Reserved for the optional Sheets export path; unused until OAuth ships. */
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
      const result: Extract<ActionResult, { kind: 'table' }> = {
        kind: 'table',
        columns,
        rows,
        sources: sourcesFor(items),
      };
      // Confirm the SheetsExporter seam is constructible without performing an export.
      expectSheetsExporter(sheets);
      yield { type: 'result', result };
    },
  };
}

function expectSheetsExporter(exporter: SheetsExporter): void {
  if (typeof exporter.export !== 'function') {
    throw new Error('SheetsExporter.export missing');
  }
}

export type { SheetsExporter } from './sheets';
export { UnconfiguredSheetsExporter } from './sheets';
