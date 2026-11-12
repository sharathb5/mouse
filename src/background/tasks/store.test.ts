import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { Task } from '@/core/contracts';
import { createTaskStore, replaceAllTasks } from './store';

function sampleTask(id: string, status: Task['state']['status'] = 'queued'): Task {
  const now = '2026-11-12T04:00:00.000Z';
  return {
    request: {
      id,
      createdAt: now,
      approval: { kind: 'not-required' },
      executor: { kind: 'extension' },
      input: {
        actionId: 'send-to-agent',
        destinationId: 'cursor-default',
        context: {
          untrusted: true,
          source: {
            url: 'https://example.com',
            title: 'Example',
            capturedAt: now,
            frame: 'top',
          },
          target: { kind: 'page', blocks: [{ type: 'paragraph', text: 'Hi' }] },
          page: { kind: 'generic', confidence: 0, signals: [] },
          containsSensitiveData: false,
        },
      },
    },
    state:
      status === 'queued'
        ? { status: 'queued' }
        : status === 'running'
          ? { status: 'running', progress: { mode: 'indeterminate' }, updates: [] }
          : { status: 'cancelled', cancelledAt: now },
    updatedAt: now,
    title: `Task ${id}`,
  };
}

describe('TaskStore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('persists, lists, and watches tasks', async () => {
    const store = createTaskStore();
    const seen: number[] = [];
    const stop = store.watch((tasks) => {
      seen.push(tasks.length);
    });

    await store.upsert(sampleTask('a'));
    await store.upsert(sampleTask('b', 'running'));
    expect(await store.list()).toHaveLength(2);
    expect((await store.get('a'))?.title).toBe('Task a');

    await store.remove('a');
    expect(await store.list()).toHaveLength(1);

    await replaceAllTasks([sampleTask('c'), sampleTask('d')]);
    expect((await store.list()).map((task) => task.request.id).sort()).toEqual(['c', 'd']);
    stop();
    expect(seen.length).toBeGreaterThan(0);
  });
});
