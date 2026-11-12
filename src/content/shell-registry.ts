import { INLINE_ACTION_IDS } from '@/actions/inline/ids';
import {
  createActionRegistry,
  type ActionRegistry,
  type AnyActionExecutor,
} from '@/core/actions/registry';
import type { ActionEvent, ActionId } from '@/core/contracts';

const SHELL_AVAILABLE_IDS = [
  ...INLINE_ACTION_IDS,
  'select-content',
  'send-to-agent',
  'extract',
  'compare',
  'track',
] as const satisfies readonly ActionId[];

/**
 * Tiny availability stubs so the menu can mark implemented actions available without
 * importing React panels, Zod validators, or consumer executor implementations.
 * Controllers must not call these stubs' execute(); they lazy-load real work on select.
 */
function availabilityStub(actionId: ActionId): AnyActionExecutor {
  const stub: AnyActionExecutor = {
    actionId,
    execute(): AsyncIterable<ActionEvent> {
      return {
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              await Promise.resolve();
              throw new Error(
                `Shell availability stub for "${actionId}" was invoked; load the real executor.`,
              );
            },
          };
        },
      };
    },
  };
  return stub;
}

export function createShellActionRegistry(): ActionRegistry {
  return createActionRegistry({
    executors: SHELL_AVAILABLE_IDS.map((id) => availabilityStub(id)),
  });
}
