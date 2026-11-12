import type { ActionInputFor, ClipboardDestination } from '@/core/contracts';
import { buildAgentPrompt } from './prompt';
import type { DestinationAdapter } from './types';

export function createClipboardAdapter(
  destination: ClipboardDestination,
): DestinationAdapter<ClipboardDestination> {
  return {
    integration: 'clipboard',
    async handoff(input: ActionInputFor<'send-to-agent'>) {
      if (input.context.containsSensitiveData) {
        throw new Error('Refusing to copy sensitive content');
      }
      const prompt = buildAgentPrompt(input);
      if (!('clipboard' in navigator) || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('Clipboard API is unavailable in this context');
      }
      await navigator.clipboard.writeText(prompt);
      return {
        kind: 'handoff',
        destinationId: destination.id,
        outcome: { mode: 'copied' },
      };
    },
  };
}
