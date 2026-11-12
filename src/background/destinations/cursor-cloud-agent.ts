import { z } from 'zod';
import type { CursorCloudAgentDestination, TaskRequest, TaskState } from '@/core/contracts';
import { progressFromCursorRunStatus } from '@/core/tasks';
import { getCursorApiKey } from '@/platform/credentials-store';
import { buildAgentPrompt, repositoryToUrl } from './prompt';
import type { CreateTaskResult, DestinationAdapter } from './types';

/** Official Cloud Agents API host (https://cursor.com/docs/cloud-agent/api/endpoints). */
export const CURSOR_API_BASE = 'https://api.cursor.com';
export const CURSOR_API_ORIGIN_PATTERN = 'https://api.cursor.com/*';

const CreateAgentResponseSchema = z.object({
  agent: z.object({
    id: z.string().min(1),
    url: z.url().optional(),
    latestRunId: z.string().min(1).optional(),
  }),
  run: z
    .object({
      id: z.string().min(1),
      status: z.string().min(1),
    })
    .optional(),
});

const AgentResponseSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  url: z.url().optional(),
  latestRunId: z.string().min(1).optional(),
});

const RunResponseSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1).optional(),
  status: z.enum([
    'CREATING',
    'RUNNING',
    'WAITING_FOR_BACKGROUND_WORK',
    'FINISHED',
    'ERROR',
    'CANCELLED',
    'EXPIRED',
  ]),
  result: z.string().optional(),
  durationMs: z.number().optional(),
});

export class CursorApiError extends Error {
  readonly status: number;
  readonly code: 'not-configured' | 'network' | 'provider';

  constructor(message: string, status: number, code: CursorApiError['code'] = 'provider') {
    super(message);
    this.name = 'CursorApiError';
    this.status = status;
    this.code = code;
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface CursorCloudAgentAdapterOptions {
  destination: CursorCloudAgentDestination;
  fetchImpl?: FetchLike;
  getApiKey?: () => Promise<string | undefined>;
  now?: () => string;
}

export function createCursorCloudAgentAdapter(
  options: CursorCloudAgentAdapterOptions,
): DestinationAdapter<CursorCloudAgentDestination> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const getApiKey = options.getApiKey ?? getCursorApiKey;
  const now = options.now ?? (() => new Date().toISOString());

  async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const apiKey = await getApiKey();
    if (!apiKey) {
      throw new CursorApiError(
        'Cursor API key is not configured. Add it in the Agentic Mouse popup.',
        0,
        'not-configured',
      );
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${apiKey}`);
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');
    try {
      return await fetchImpl(`${CURSOR_API_BASE}${path}`, { ...init, headers });
    } catch (error) {
      throw new CursorApiError(
        error instanceof Error ? error.message : 'Network request failed',
        0,
        'network',
      );
    }
  }

  return {
    integration: 'cursor-cloud-agent',

    async createTask(request: TaskRequest, signal: AbortSignal): Promise<CreateTaskResult> {
      if (request.input.actionId !== 'send-to-agent') {
        throw new CursorApiError('Cursor adapter only accepts send-to-agent inputs', 400);
      }
      if (request.input.context.containsSensitiveData) {
        throw new CursorApiError('Refusing to send sensitive content to Cursor', 400);
      }

      const body: Record<string, unknown> = {
        prompt: { text: buildAgentPrompt(request.input) },
        name: truncateName(request.input.context.source.title || 'Agentic Mouse task'),
      };

      const repository = options.destination.repository;
      if (repository) {
        body.repos = [
          {
            url: repositoryToUrl(repository),
            ...(options.destination.ref ? { startingRef: options.destination.ref } : {}),
          },
        ];
        body.autoCreatePR = true;
      }

      const response = await authorizedFetch('/v1/agents', {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
      });
      if (!response.ok) {
        throw await toApiError(response);
      }
      const parsed = CreateAgentResponseSchema.parse(await response.json());
      const result: CreateTaskResult = {
        externalId: parsed.agent.id,
      };
      const runId = parsed.run?.id ?? parsed.agent.latestRunId;
      if (runId) result.externalRunId = runId;
      if (parsed.agent.url) result.externalUrl = parsed.agent.url;
      return result;
    },

    async pollTask(external) {
      const agentResponse = await authorizedFetch(`/v1/agents/${encodeURIComponent(external.id)}`);
      if (!agentResponse.ok) throw await toApiError(agentResponse);
      const agent = AgentResponseSchema.parse(await agentResponse.json());
      const runId = external.runId ?? agent.latestRunId;
      if (!runId) {
        return {
          state: {
            status: 'running' as const,
            progress: progressFromCursorRunStatus('CREATING'),
            updates: [],
          },
          ...(agent.url ? { externalUrl: agent.url } : {}),
        };
      }

      const runResponse = await authorizedFetch(
        `/v1/agents/${encodeURIComponent(external.id)}/runs/${encodeURIComponent(runId)}`,
      );
      if (!runResponse.ok) throw await toApiError(runResponse);
      const run = RunResponseSchema.parse(await runResponse.json());
      return {
        state: mapRunToTaskState(run, now()),
        externalRunId: run.id,
        ...(agent.url ? { externalUrl: agent.url } : {}),
      };
    },

    async cancelTask(external) {
      const runId = external.runId;
      if (!runId) {
        // Archive when we lack a run id; cancellation of an unknown run is not possible.
        const response = await authorizedFetch(
          `/v1/agents/${encodeURIComponent(external.id)}/archive`,
          { method: 'POST' },
        );
        if (!response.ok && response.status !== 409) throw await toApiError(response);
        return;
      }
      const response = await authorizedFetch(
        `/v1/agents/${encodeURIComponent(external.id)}/runs/${encodeURIComponent(runId)}/cancel`,
        { method: 'POST' },
      );
      if (!response.ok && response.status !== 409) throw await toApiError(response);
    },
  };
}

function mapRunToTaskState(run: z.infer<typeof RunResponseSchema>, timestamp: string): TaskState {
  switch (run.status) {
    case 'CREATING':
    case 'RUNNING':
    case 'WAITING_FOR_BACKGROUND_WORK':
      return {
        status: 'running',
        progress: progressFromCursorRunStatus(run.status),
        updates: [
          {
            at: timestamp,
            message: progressFromCursorRunStatus(run.status).label ?? run.status,
          },
        ],
      };
    case 'FINISHED':
      return {
        status: 'completed',
        completedAt: timestamp,
        result: {
          kind: 'inline-text',
          purpose: 'answer',
          format: 'plain',
          text: run.result?.trim() ?? 'Cursor Cloud Agent finished.',
          sources: [],
        },
      };
    case 'CANCELLED':
      return { status: 'cancelled', cancelledAt: timestamp };
    case 'ERROR':
    case 'EXPIRED':
      return {
        status: 'failed',
        failedAt: timestamp,
        error: {
          code: 'provider',
          message: run.result?.trim() ?? `Cursor run ended with status ${run.status}`,
          retryable: run.status === 'ERROR',
        },
      };
  }
}

async function toApiError(response: Response): Promise<CursorApiError> {
  let detail = response.statusText || 'Cursor API error';
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record.message === 'string') detail = record.message;
      else if (typeof record.error === 'string') detail = record.error;
    }
  } catch {
    // ignore body parse failures
  }
  return new CursorApiError(
    detail,
    response.status,
    response.status >= 500 ? 'network' : 'provider',
  );
}

function truncateName(value: string): string {
  const trimmed = value.trim() || 'Agentic Mouse task';
  return trimmed.length <= 100 ? trimmed : `${trimmed.slice(0, 99)}…`;
}
