import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TaskRequest } from '@/core/contracts';
import { createCursorCloudAgentAdapter } from './cursor-cloud-agent';

/** MOCKED: unit tests use a fake fetch; they do not contact api.cursor.com. */
describe('createCursorCloudAgentAdapter (MOCKED)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const destination = {
    id: 'cursor-default',
    label: 'Cursor Cloud Agent',
    isDefault: true,
    integration: 'cursor-cloud-agent' as const,
    capability: 'background-execution' as const,
    repository: 'github.com/sharathb5/mouse',
    ref: 'main',
  };

  const request: TaskRequest = {
    id: 'task_1',
    createdAt: '2026-11-12T04:00:00.000Z',
    approval: { kind: 'explicit', approvedAt: '2026-11-12T04:00:00.000Z' },
    executor: { kind: 'agent', destination },
    input: {
      actionId: 'send-to-agent',
      destinationId: 'cursor-default',
      instructions: 'Add tests',
      context: {
        untrusted: true,
        source: {
          url: 'https://example.com/page',
          title: 'Example',
          capturedAt: '2026-11-12T04:00:00.000Z',
          frame: 'top',
        },
        target: {
          kind: 'text-selection',
          text: 'Hello',
          blocks: [{ type: 'paragraph', text: 'Hello' }],
        },
        page: { kind: 'generic', confidence: 0.2, signals: [] },
        containsSensitiveData: false,
      },
    },
  };

  it('POSTs /v1/agents with Bearer auth and delimited prompt', async () => {
    const fetchImpl = vi.fn((): Promise<Response> =>
      Promise.resolve(
        Response.json({
          agent: {
            id: 'bc-test',
            url: 'https://cursor.com/agents/bc-test',
            latestRunId: 'run-1',
          },
          run: { id: 'run-1', status: 'CREATING' },
        }),
      ),
    );

    const adapter = createCursorCloudAgentAdapter({
      destination,
      fetchImpl: fetchImpl,
      getApiKey: () => Promise.resolve('test-key'),
    });

    if (!adapter.createTask) throw new Error('missing createTask');
    const created = await adapter.createTask(request, new AbortController().signal);
    expect(created).toEqual({
      externalId: 'bc-test',
      externalRunId: 'run-1',
      externalUrl: 'https://cursor.com/agents/bc-test',
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]?.[0]).toBe('https://api.cursor.com/v1/agents');
    const init = calls[0]?.[1] ?? {};
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer test-key');
    const bodyText = typeof init.body === 'string' ? init.body : '{}';
    const body = JSON.parse(bodyText) as {
      prompt: { text: string };
      repos: { url: string; startingRef?: string }[];
    };
    expect(body.prompt.text).toContain('<untrusted-page-content>');
    expect(body.prompt.text).toContain('Hello');
    expect(body.repos[0]).toEqual({
      url: 'https://github.com/sharathb5/mouse',
      startingRef: 'main',
    });
  });

  it('maps FINISHED runs to completed task state', async () => {
    const fetchImpl = vi.fn((url: string): Promise<Response> => {
      if (url.endsWith('/v1/agents/bc-test')) {
        return Promise.resolve(
          Response.json({
            id: 'bc-test',
            status: 'IDLE',
            url: 'https://cursor.com/agents/bc-test',
            latestRunId: 'run-1',
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          id: 'run-1',
          agentId: 'bc-test',
          status: 'FINISHED',
          result: 'All done',
        }),
      );
    });

    const adapter = createCursorCloudAgentAdapter({
      destination,
      fetchImpl,
      getApiKey: () => Promise.resolve('test-key'),
      now: () => '2026-11-12T04:10:00.000Z',
    });

    if (!adapter.pollTask) throw new Error('missing pollTask');
    const polled = await adapter.pollTask({ id: 'bc-test', runId: 'run-1' });
    expect(polled.state.status).toBe('completed');
    if (polled.state.status === 'completed') {
      expect(polled.state.result).toMatchObject({ kind: 'inline-text', text: 'All done' });
    }
  });

  it('fails clearly when no API key is configured', async () => {
    const adapter = createCursorCloudAgentAdapter({
      destination,
      fetchImpl: vi.fn(),
      getApiKey: () => Promise.resolve(undefined),
    });
    if (!adapter.createTask) throw new Error('missing createTask');
    await expect(adapter.createTask(request, new AbortController().signal)).rejects.toThrow(
      /not configured/i,
    );
  });
});
