import { browser } from 'wxt/browser';
import type { ActionExecutor } from '@/core/actions';
import type {
  ActionEvent,
  ActionResult,
  BackgroundMessage,
  TrackStartResponse,
} from '@/core/contracts';
import { snapshotFromDocument } from '@/core/tracking';

export interface TrackExecutorDeps {
  getDocument: () => Document;
  getPageUrl?: () => string;
  /** Override for tests; defaults to runtime messaging to the background tracker. */
  startTrack?: (
    message: Extract<BackgroundMessage, { type: 'agentic-mouse/track/start' }>,
  ) => Promise<TrackStartResponse>;
}

async function defaultStartTrack(
  message: Extract<BackgroundMessage, { type: 'agentic-mouse/track/start' }>,
): Promise<TrackStartResponse> {
  const response: TrackStartResponse = await browser.runtime.sendMessage(message);
  return response;
}

export function createTrackExecutor(deps: TrackExecutorDeps): ActionExecutor<'track'> {
  const startTrack = deps.startTrack ?? defaultStartTrack;

  return {
    actionId: 'track',
    async *execute(input, signal): AsyncIterable<ActionEvent> {
      if (input.context.containsSensitiveData) {
        yield {
          type: 'error',
          error: {
            code: 'sensitive-content',
            message: 'Track will not monitor sensitive fields.',
            retryable: false,
          },
        };
        return;
      }

      yield {
        type: 'progress',
        progress: { mode: 'indeterminate', label: 'Creating tracker' },
      };

      const pageUrl = deps.getPageUrl?.() ?? input.context.source.url;
      const snapshot = snapshotFromDocument(
        deps.getDocument(),
        pageUrl,
        new Date().toISOString(),
        input.context,
      );
      if (!snapshot) {
        yield {
          type: 'result',
          result: {
            kind: 'unavailable',
            actionId: 'track',
            reason: 'No trackable product or listing data found on this page.',
          },
        };
        return;
      }

      if (signal.aborted) {
        yield {
          type: 'error',
          error: { code: 'cancelled', message: 'Track cancelled.', retryable: false },
        };
        return;
      }

      const response = await startTrack({
        type: 'agentic-mouse/track/start',
        url: pageUrl,
        title: String(snapshot.fields.name?.value ?? '') || input.context.source.title || pageUrl,
        condition: input.condition,
        initialSnapshot: snapshot,
        context: input.context,
      });
      if (!response.ok) {
        yield {
          type: 'error',
          error: {
            code: 'internal',
            message: response.reason,
            retryable: true,
          },
        };
        return;
      }

      yield { type: 'task-created', taskId: response.taskId };

      const result: Extract<ActionResult, { kind: 'tracking' }> = {
        kind: 'tracking',
        trackerId: response.trackerId,
        condition: input.condition,
        nextCheckAt: response.nextCheckAt,
      };
      yield { type: 'result', result };
    },
  };
}
