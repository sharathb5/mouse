import { createCompareExecutor } from '@/actions/compare';
import { createExtractExecutor } from '@/actions/extract';
import { createInlineAvailabilityStubs } from '@/actions/inline/availability';
import { createSelectContentExecutor } from '@/actions/inline/select-content';
import { sendToAgentExecutor } from '@/actions/send-to-agent';
import { createTrackExecutor } from '@/actions/track';
import { createActionRegistry, type ActionRegistry } from '@/core/actions';

/**
 * Registers Workstream A/B/C executors for the content-script menu. Document-dependent
 * Workstream C work only runs when execute() is called in a page context.
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
      }),
      createCompareExecutor({
        getDocument: () => document,
        getPageUrl: () => location.href,
      }),
      createTrackExecutor({
        getDocument: () => document,
        getPageUrl: () => location.href,
      }),
    ],
  });
}
