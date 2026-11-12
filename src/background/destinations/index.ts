import type { AgentDestination } from '@/core/contracts';
import { createClipboardAdapter } from './clipboard';
import { createCursorCloudAgentAdapter } from './cursor-cloud-agent';
import { createPrefillLinkAdapter } from './prefill-link';
import type { DestinationAdapter } from './types';

export type { CreateTaskResult, DestinationAdapter } from './types';
export {
  CURSOR_API_BASE,
  CURSOR_API_ORIGIN_PATTERN,
  CursorApiError,
  createCursorCloudAgentAdapter,
} from './cursor-cloud-agent';
export { createPrefillLinkAdapter } from './prefill-link';
export { createClipboardAdapter } from './clipboard';
export { buildAgentPrompt, fillPrefillUrl, formatContext, repositoryToUrl } from './prompt';

export function createDestinationAdapter(destination: AgentDestination): DestinationAdapter {
  switch (destination.integration) {
    case 'cursor-cloud-agent':
      return createCursorCloudAgentAdapter({ destination });
    case 'prefill-link':
      return createPrefillLinkAdapter(destination);
    case 'clipboard':
      return createClipboardAdapter(destination);
  }
}
