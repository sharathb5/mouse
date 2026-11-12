import { browser } from 'wxt/browser';
import type { ActionInputFor, PrefillLinkDestination } from '@/core/contracts';
import { buildAgentPrompt, fillPrefillUrl } from './prompt';
import type { DestinationAdapter } from './types';

export function createPrefillLinkAdapter(
  destination: PrefillLinkDestination,
): DestinationAdapter<PrefillLinkDestination> {
  return {
    integration: 'prefill-link',
    async handoff(input: ActionInputFor<'send-to-agent'>) {
      if (input.context.containsSensitiveData) {
        throw new Error('Refusing to open a prefill link with sensitive content');
      }
      const prompt = buildAgentPrompt(input);
      const url = fillPrefillUrl(destination.urlTemplate, prompt);
      await browser.tabs.create({ url, active: true });
      return {
        kind: 'handoff',
        destinationId: destination.id,
        outcome: { mode: 'prefill-opened', url },
      };
    },
  };
}
