import { describe, expect, it } from 'vitest';
import type { Task } from '../contracts/task';
import {
  countActiveTasks,
  describeTrackCondition,
  inboxKind,
  sortTasksForInbox,
  taskDetail,
  taskTitle,
} from './inbox';

function task(
  id: string,
  status: Task['state']['status'],
  updatedAt: string,
  overrides: Partial<Task> = {},
): Task {
  const state: Task['state'] =
    status === 'queued'
      ? { status: 'queued' }
      : status === 'running'
        ? { status: 'running', progress: { mode: 'indeterminate' }, updates: [] }
        : status === 'monitoring'
          ? {
              status: 'monitoring',
              nextCheckAt: '2026-11-12T05:00:00.000Z',
              paused: false,
            }
          : status === 'completed'
            ? {
                status: 'completed',
                result: {
                  kind: 'unavailable',
                  actionId: 'send-to-agent',
                  reason: 'done',
                },
                completedAt: updatedAt,
              }
            : status === 'failed'
              ? {
                  status: 'failed',
                  error: { code: 'internal', message: 'x', retryable: false },
                  failedAt: updatedAt,
                }
              : { status: 'cancelled', cancelledAt: updatedAt };

  return {
    request: {
      id,
      input: {
        actionId: 'send-to-agent',
        destinationId: 'cursor-default',
        context: {
          untrusted: true,
          source: {
            url: 'https://example.com',
            title: 'Example',
            capturedAt: updatedAt,
            frame: 'top',
          },
          target: { kind: 'page', blocks: [{ type: 'paragraph', text: 'Hi' }] },
          page: { kind: 'generic', confidence: 0.5, signals: [] },
          containsSensitiveData: false,
        },
      },
      executor: { kind: 'extension' },
      approval: { kind: 'not-required' },
      createdAt: updatedAt,
    },
    state,
    updatedAt,
    ...overrides,
  };
}

describe('inbox helpers', () => {
  it('sorts active work before settled tasks', () => {
    const tasks = [
      task('c', 'completed', '2026-11-12T04:03:00.000Z'),
      task('r', 'running', '2026-11-12T04:01:00.000Z'),
      task('q', 'queued', '2026-11-12T04:02:00.000Z'),
      task('m', 'monitoring', '2026-11-12T04:00:00.000Z'),
    ];
    expect(sortTasksForInbox(tasks).map((t) => t.request.id)).toEqual(['r', 'q', 'm', 'c']);
  });

  it('counts only active tasks for the badge', () => {
    expect(
      countActiveTasks([
        task('1', 'running', '2026-11-12T04:00:00.000Z'),
        task('2', 'completed', '2026-11-12T04:00:00.000Z'),
        task('3', 'monitoring', '2026-11-12T04:00:00.000Z'),
      ]),
    ).toBe(2);
  });

  it('prefers an explicit title', () => {
    expect(taskTitle(task('1', 'queued', '2026-11-12T04:00:00.000Z', { title: 'Custom' }))).toBe(
      'Custom',
    );
  });

  it('labels Track tasks and describes conditions', () => {
    const track = task('t', 'monitoring', '2026-11-12T04:00:00.000Z', {
      request: {
        id: 't',
        createdAt: '2026-11-12T04:00:00.000Z',
        approval: { kind: 'not-required' },
        executor: { kind: 'extension' },
        input: {
          actionId: 'track',
          condition: { kind: 'price-below', threshold: { amount: 50, currency: 'USD' } },
          context: {
            untrusted: true,
            source: {
              url: 'https://example.com/p',
              title: 'Lamp',
              capturedAt: '2026-11-12T04:00:00.000Z',
              frame: 'top',
            },
            target: {
              kind: 'element',
              element: { kind: 'unknown', confidence: 0.5, signals: [], sensitive: false },
              text: 'Cedar Desk Lamp — $79',
              blocks: [{ type: 'paragraph', text: 'Cedar Desk Lamp — $79' }],
            },
            page: { kind: 'product', confidence: 0.8, signals: [] },
            containsSensitiveData: false,
          },
        },
      },
    });
    expect(inboxKind(track)).toBe('track');
    expect(taskTitle(track)).toContain('Track');
    expect(taskTitle(track)).toContain('Cedar Desk Lamp');
    expect(
      describeTrackCondition({ kind: 'price-below', threshold: { amount: 50, currency: 'USD' } }),
    ).toContain('50');
    expect(taskDetail(track)).toContain('price drops below');
  });
});
