import type { ActionEvent } from '@/core/contracts';
import type { AnyActionExecutor } from '@/core/actions';
import { INLINE_ACTION_IDS } from './ids';

/**
 * Stub executors registered in the content-script registry so the menu marks inline
 * actions available. Real execution for AI actions happens in the background via Port;
 * these stubs must never be invoked.
 */
export function createInlineAvailabilityStubs(): AnyActionExecutor[] {
  return INLINE_ACTION_IDS.map((actionId) => {
    const stub: AnyActionExecutor = {
      actionId,
      execute(): AsyncIterable<ActionEvent> {
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                await Promise.resolve();
                throw new Error(
                  `Content-script stub for "${actionId}" was invoked; use the background action runner.`,
                );
              },
            };
          },
        };
      },
    };
    return stub;
  });
}
