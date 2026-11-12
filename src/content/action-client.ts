import { browser } from 'wxt/browser';
import {
  ACTION_RUN_PORT,
  ActionRunServerMessageSchema,
  type ActionId,
  type ActionRunServerMessage,
  type SelectedContext,
} from '@/core/contracts';

export interface RunActionHandlers {
  onTextDelta?: (delta: string) => void;
  onResult?: (result: Extract<ActionRunServerMessage, { type: 'result' }>['result']) => void;
  onError?: (error: Extract<ActionRunServerMessage, { type: 'error' }>['error']) => void;
  onDone?: () => void;
}

/**
 * Asks the background service worker to run an action and streams events back.
 * Page content is sent as validated SelectedContext; API keys never leave the background.
 */
export function runActionInBackground(
  actionId: ActionId,
  context: SelectedContext,
  options: Record<string, unknown> = {},
  handlers: RunActionHandlers = {},
): { abort: () => void; requestId: string } {
  const requestId = crypto.randomUUID();
  const port = browser.runtime.connect({ name: ACTION_RUN_PORT });
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    try {
      port.disconnect();
    } catch {
      /* already disconnected */
    }
  };

  port.onMessage.addListener((message: unknown) => {
    const parsed = ActionRunServerMessageSchema.safeParse(message);
    if (!parsed.success || parsed.data.requestId !== requestId) return;
    switch (parsed.data.type) {
      case 'text-delta':
        handlers.onTextDelta?.(parsed.data.delta);
        break;
      case 'result':
        handlers.onResult?.(parsed.data.result);
        break;
      case 'error':
        handlers.onError?.(parsed.data.error);
        break;
      case 'progress':
        break;
      case 'done':
        handlers.onDone?.();
        finish();
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    if (!settled) {
      handlers.onDone?.();
      settled = true;
    }
  });

  port.postMessage({
    type: 'start',
    requestId,
    actionId,
    context,
    options,
  });

  return {
    requestId,
    abort: () => {
      try {
        port.postMessage({ type: 'abort', requestId });
      } catch {
        /* ignore */
      }
      finish();
    },
  };
}
