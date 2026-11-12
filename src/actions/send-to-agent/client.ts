import { browser } from 'wxt/browser';
import {
  BackgroundResponseSchema,
  type BackgroundRequest,
  type BackgroundResponse,
  type SendToAgentInput,
  type TaskApproval,
} from '@/core/contracts';

async function send(request: BackgroundRequest): Promise<BackgroundResponse> {
  const raw: unknown = await browser.runtime.sendMessage(request);
  return BackgroundResponseSchema.parse(raw);
}

export async function listDestinations() {
  const response = await send({ type: 'agentic-mouse/list-destinations' });
  if (response.type !== 'destinations') {
    throw new Error(response.type === 'error' ? response.message : 'Unexpected response');
  }
  return response;
}

export async function createAgentTask(args: {
  destinationId: string;
  input: SendToAgentInput;
  approval: TaskApproval;
  title?: string;
}) {
  const response = await send({
    type: 'agentic-mouse/create-agent-task',
    destinationId: args.destinationId,
    input: args.input,
    approval: args.approval,
    ...(args.title ? { title: args.title } : {}),
  });
  if (response.type === 'task-created') return response;
  if (response.type === 'error') throw new Error(response.message);
  throw new Error('Unexpected response');
}

export async function handoffToDestination(args: {
  destinationId: string;
  input: SendToAgentInput;
}) {
  const response = await send({
    type: 'agentic-mouse/handoff',
    destinationId: args.destinationId,
    input: args.input,
  });
  if (response.type === 'handoff-result') return response.result;
  if (response.type === 'error') throw new Error(response.message);
  throw new Error('Unexpected response');
}
