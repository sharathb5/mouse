import { browser } from 'wxt/browser';
import { createActionRegistry, type ActionRegistry, type AnyActionExecutor } from '@/core/actions';
import {
  ACTION_RUN_PORT,
  ActionIdSchema,
  ActionInputSchema,
  ActionRunClientMessageSchema,
  type ActionId,
  type ActionInput,
  type ActionRunServerMessage,
  type SelectedContext,
} from '@/core/contracts';
import { createInlineAiExecutors } from '@/actions/inline/executors';
import { createSelectContentExecutor } from '@/actions/inline/select-content';
import { resolveModelProvider } from '@/background/model';
import { loadSettings } from '@/platform/settings-store';
import { loadModelApiKey } from '@/platform/model-secrets';

function buildRegistry(): ActionRegistry {
  const deps = {
    getProvider: async () => {
      const settings = await loadSettings();
      const apiKey = await loadModelApiKey();
      return resolveModelProvider(settings.model, apiKey);
    },
    getModelId: async () => (await loadSettings()).model.modelId,
  };

  const executors: AnyActionExecutor[] = [
    createSelectContentExecutor(),
    ...createInlineAiExecutors(deps),
  ];
  return createActionRegistry({ executors });
}

export function registerActionRunPort(registry: ActionRegistry = buildRegistry()): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== ACTION_RUN_PORT) return;

    const controllers = new Map<string, AbortController>();

    const send = (message: ActionRunServerMessage) => {
      try {
        port.postMessage(message);
      } catch {
        /* port closed */
      }
    };

    port.onMessage.addListener((raw: unknown) => {
      const parsed = ActionRunClientMessageSchema.safeParse(raw);
      if (!parsed.success) return;

      if (parsed.data.type === 'abort') {
        controllers.get(parsed.data.requestId)?.abort();
        controllers.delete(parsed.data.requestId);
        return;
      }

      const { requestId, actionId, context, options } = parsed.data;
      const controller = new AbortController();
      controllers.set(requestId, controller);
      void runAction(
        registry,
        requestId,
        actionId,
        context,
        options ?? {},
        controller.signal,
        send,
      ).finally(() => {
        controllers.delete(requestId);
        send({ type: 'done', requestId });
      });
    });

    port.onDisconnect.addListener(() => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    });
  });
}

async function runAction(
  registry: ActionRegistry,
  requestId: string,
  actionId: ActionId,
  context: SelectedContext,
  options: Record<string, unknown>,
  signal: AbortSignal,
  send: (message: ActionRunServerMessage) => void,
): Promise<void> {
  const executor = registry.getExecutor(actionId);
  if (!executor) {
    send({
      type: 'error',
      requestId,
      error: {
        code: 'unavailable',
        message: `Action "${actionId}" is not available yet.`,
        retryable: false,
      },
    });
    return;
  }

  const input = buildInput(actionId, context, options);
  if (!input) {
    send({
      type: 'error',
      requestId,
      error: {
        code: 'invalid-input',
        message: `Could not build input for action "${actionId}".`,
        retryable: false,
      },
    });
    return;
  }

  try {
    for await (const event of executor.execute(input, signal)) {
      if (signal.aborted) break;
      switch (event.type) {
        case 'text-delta':
          send({ type: 'text-delta', requestId, delta: event.delta });
          break;
        case 'progress':
          send({ type: 'progress', requestId, progress: event.progress });
          break;
        case 'result':
          send({ type: 'result', requestId, result: event.result });
          break;
        case 'error':
          send({ type: 'error', requestId, error: event.error });
          break;
        case 'task-created':
          break;
      }
    }
  } catch (error) {
    send({
      type: 'error',
      requestId,
      error: {
        code: 'internal',
        message: error instanceof Error ? error.message : 'Action failed',
        retryable: false,
      },
    });
  }
}

function buildInput(
  actionId: ActionId,
  context: SelectedContext,
  options: Record<string, unknown>,
): ActionInput | null {
  const parsedId = ActionIdSchema.safeParse(actionId);
  if (!parsedId.success) return null;

  const base = { actionId: parsedId.data, context, ...options };
  switch (parsedId.data) {
    case 'summarize':
      return ActionInputSchema.parse({
        actionId: 'summarize',
        context,
        length: options.length ?? 'standard',
      });
    case 'translate':
      return ActionInputSchema.parse({
        actionId: 'translate',
        context,
        targetLanguage: options.targetLanguage ?? 'en',
      });
    case 'ask-follow-up':
      return ActionInputSchema.parse({
        actionId: 'ask-follow-up',
        context,
        question: options.question ?? 'What should I know about this?',
      });
    case 'simplify':
      return ActionInputSchema.parse({
        actionId: 'simplify',
        context,
        readingLevel: options.readingLevel ?? 'general',
      });
    case 'explain':
    case 'go-deeper':
    case 'example':
    case 'select-content':
      return ActionInputSchema.parse({ actionId: parsedId.data, context });
    case 'send-to-agent':
    case 'compare':
    case 'extract':
    case 'track':
      return ActionInputSchema.safeParse(base).success ? ActionInputSchema.parse(base) : null;
  }
}
