import type { ActionEvent, ActionInputFor } from '@/core/contracts';
import type { ActionExecutor } from '@/core/actions';

export function createSelectContentExecutor(): ActionExecutor<'select-content'> {
  return {
    actionId: 'select-content',
    async *execute(input: ActionInputFor<'select-content'>): AsyncIterable<ActionEvent> {
      await Promise.resolve();
      yield { type: 'result', result: { kind: 'selection', context: input.context } };
    },
  };
}
