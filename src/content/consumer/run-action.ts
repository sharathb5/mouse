import type { ResolvedAction } from '@/core/actions';
import {
  type ActionEvent,
  type ActionId,
  type ActionInputFor,
  type ActionResult,
  type SelectedContext,
} from '@/core/contracts';
import { buildTrackInput } from './track-input';

export interface RunActionResult {
  result?: ActionResult;
  errorMessage?: string;
}

interface ExecutableAction {
  execute(input: ActionInputFor<ActionId>, signal: AbortSignal): AsyncIterable<ActionEvent>;
}

export async function runRegisteredAction(
  entry: ResolvedAction,
  executor: ExecutableAction,
  context: SelectedContext,
  signal: AbortSignal,
  doc: Document = document,
): Promise<RunActionResult> {
  const input = buildInput(entry.definition.id, context, doc);
  if (!input) {
    return {
      result: {
        kind: 'unavailable',
        actionId: entry.definition.id,
        reason: 'This action needs additional inputs that are not collected yet.',
      },
    };
  }

  let result: ActionResult | undefined;
  let errorMessage: string | undefined;

  try {
    for await (const event of executor.execute(input, signal)) {
      if (signal.aborted) {
        return {
          errorMessage: 'cancelled',
        };
      }
      switch (event.type) {
        case 'result':
          result = event.result;
          break;
        case 'error':
          errorMessage = event.error.message;
          break;
        case 'progress':
        case 'text-delta':
        case 'task-created':
          break;
      }
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Action failed';
  }

  if (result) return { result };
  return {
    errorMessage: errorMessage ?? 'Action finished without a result',
  };
}

function buildInput(
  actionId: ActionId,
  context: SelectedContext,
  doc: Document,
): ActionInputFor<ActionId> | null {
  switch (actionId) {
    case 'extract':
      return { actionId: 'extract', context, format: 'table' };
    case 'compare':
      return { actionId: 'compare', context, candidateUrls: [] };
    case 'track':
      return buildTrackInput(context, doc);
    case 'explain':
    case 'select-content':
    case 'send-to-agent':
    case 'summarize':
    case 'translate':
    case 'ask-follow-up':
    case 'simplify':
    case 'go-deeper':
    case 'example':
      return null;
  }
}
