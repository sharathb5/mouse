import type {
  ActionInputFor,
  ActionResult,
  AgentDestination,
  TaskRequest,
  TaskState,
} from '@/core/contracts';

export interface CreateTaskResult {
  externalId: string;
  externalRunId?: string;
  externalUrl?: string;
}

export interface DestinationAdapter<D extends AgentDestination = AgentDestination> {
  readonly integration: D['integration'];
  createTask?(request: TaskRequest, signal: AbortSignal): Promise<CreateTaskResult>;
  pollTask?(
    external: { id: string; runId?: string },
    signal?: AbortSignal,
  ): Promise<{ state: TaskState; externalRunId?: string; externalUrl?: string }>;
  cancelTask?(external: { id: string; runId?: string }, signal?: AbortSignal): Promise<void>;
  handoff?(input: ActionInputFor<'send-to-agent'>): Promise<ActionResult & { kind: 'handoff' }>;
}
