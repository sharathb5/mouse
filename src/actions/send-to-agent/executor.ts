import type { ActionExecutor } from '@/core/actions';
import type { ActionEvent } from '@/core/contracts';

/**
 * Marks Send to Agent as available in the menu. The content-script dialog owns the
 * interactive picker/approval flow and talks to the background directly; this executor
 * exists so the registry does not keep the action as "coming soon".
 */
export const sendToAgentExecutor: ActionExecutor<'send-to-agent'> = {
  actionId: 'send-to-agent',
  execute() {
    return resultStream();
  },
};

async function* resultStream(): AsyncGenerator<ActionEvent> {
  await Promise.resolve();
  yield {
    type: 'result',
    result: {
      kind: 'unavailable',
      actionId: 'send-to-agent',
      reason: 'Use the Send to Agent dialog from the context menu.',
    },
  };
}
