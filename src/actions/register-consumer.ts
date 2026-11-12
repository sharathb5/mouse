import { createCompareExecutor, PageLinkAlternativesProvider } from '@/actions/compare';
import { createExtractExecutor } from '@/actions/extract';
import { createInlineAvailabilityStubs } from '@/actions/inline/availability';
import { createSelectContentExecutor } from '@/actions/inline/select-content';
import { sendToAgentExecutor } from '@/actions/send-to-agent';
import { createTrackExecutor } from '@/actions/track';
import { createActionRegistry, type ActionRegistry } from '@/core/actions';
import {
  fetchDocumentForCompare,
  rankLinksViaBackground,
} from '@/content/consumer/alternatives-client';
import { BackgroundSheetsExporter } from '@/content/consumer/sheets-client';

/**
 * Registers Workstream A/B/C executors for the content-script menu. Document-dependent
 * Workstream C work only runs when execute() is called in a page context.
 *
 * Sheets status/export go through the background so OAuth tokens never enter the content script.
 */
export function createConsumerActionRegistry(): ActionRegistry {
  return createActionRegistry({
    executors: [
      sendToAgentExecutor,
      createSelectContentExecutor(),
      ...createInlineAvailabilityStubs(),
      createExtractExecutor({
        getDocument: () => document,
        getPageUrl: () => location.href,
        sheets: new BackgroundSheetsExporter(),
      }),
      createCompareExecutor({
        getDocument: () => document,
        getPageUrl: () => location.href,
        fetchDocument: fetchDocumentForCompare,
        alternatives: new PageLinkAlternativesProvider({
          getDocument: () => document,
          getPageUrl: () => location.href,
          fetchDocument: fetchDocumentForCompare,
          rankLinks: rankLinksViaBackground,
        }),
      }),
      createTrackExecutor({
        getDocument: () => document,
        getPageUrl: () => location.href,
      }),
    ],
  });
}
