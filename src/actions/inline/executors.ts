import type {
  ActionError,
  ActionEvent,
  ActionId,
  ActionInput,
  SelectedContext,
} from '@/core/contracts';
import type { AnyActionExecutor } from '@/core/actions';
import { contextToUntrustedText } from '@/core/context-text';
import type { ModelProvider } from '@/background/model';
import { ModelProviderError } from '@/background/model';
import { INLINE_ACTION_IDS, type InlineActionId } from './ids';
import { purposeFor, systemPromptFor, userInstructionFor } from './prompts';

export type { InlineActionId };
export { INLINE_ACTION_IDS };

export interface InlineExecutorDeps {
  getProvider: () => Promise<ModelProvider>;
  getModelId: () => Promise<string>;
}

export function createInlineAiExecutors(deps: InlineExecutorDeps): AnyActionExecutor[] {
  return INLINE_ACTION_IDS.map((actionId) => createInlineAiExecutor(actionId, deps));
}

function createInlineAiExecutor(
  actionId: InlineActionId,
  deps: InlineExecutorDeps,
): AnyActionExecutor {
  return {
    actionId,
    async *execute(input: ActionInput, signal: AbortSignal): AsyncIterable<ActionEvent> {
      const context = (input as { context: SelectedContext }).context;
      if (context.containsSensitiveData) {
        yield {
          type: 'error',
          error: {
            code: 'sensitive-content',
            message: 'This selection includes sensitive fields and will not be sent to a model.',
            retryable: false,
          },
        };
        return;
      }

      const options = optionsFromInput(input);
      const instruction = userInstructionFor(actionId, options);
      const system = systemPromptFor(actionId);
      const untrustedContext = contextToUntrustedText(context);

      let provider: ModelProvider;
      let modelId: string;
      try {
        provider = await deps.getProvider();
        modelId = await deps.getModelId();
      } catch (error) {
        yield { type: 'error', error: toActionError(error) };
        return;
      }

      let text = '';
      try {
        for await (const delta of provider.stream(
          { system, untrustedContext, userInstruction: instruction, modelId },
          signal,
        )) {
          text += delta;
          yield { type: 'text-delta', delta };
        }
        yield {
          type: 'result',
          result: {
            kind: 'inline-text',
            purpose: purposeFor(actionId),
            format: 'markdown',
            text,
            sources: [context.source.url],
          },
        };
      } catch (error) {
        if (signal.aborted) {
          yield {
            type: 'error',
            error: { code: 'cancelled', message: 'Cancelled', retryable: false },
          };
          return;
        }
        yield { type: 'error', error: toActionError(error) };
      }
    },
  };
}

function optionsFromInput(
  input: { actionId: ActionId } & Record<string, unknown>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...input };
  delete rest.actionId;
  delete rest.context;
  return rest;
}

function toActionError(error: unknown): ActionError {
  if (error instanceof ModelProviderError) {
    const code =
      error.code === 'not-configured'
        ? 'provider'
        : error.code === 'cancelled'
          ? 'cancelled'
          : error.code === 'network'
            ? 'network'
            : 'provider';
    return {
      code,
      message: error.message,
      retryable: error.retryable,
    };
  }
  return {
    code: 'internal',
    message: error instanceof Error ? error.message : 'Unknown error',
    retryable: false,
  };
}
