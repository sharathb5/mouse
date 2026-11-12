import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { SelectedContext, TrackStartResponse } from '@/core/contracts';
import { createTrackExecutor } from './executor';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/pages');

const context: SelectedContext = {
  untrusted: true,
  source: {
    url: 'http://127.0.0.1:4321/product-track.html',
    title: 'Trackable Lamp',
    capturedAt: '2026-11-12T04:00:00.000Z',
    frame: 'top',
  },
  target: { kind: 'page', blocks: [] },
  page: { kind: 'product', confidence: 0.9, signals: ['test'] },
  containsSensitiveData: false,
};

describe('createTrackExecutor', () => {
  it('creates a tracking result via the background start hook', async () => {
    const html = readFileSync(join(fixtures, 'product-track.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const startTrack = vi.fn((): Promise<TrackStartResponse> =>
      Promise.resolve({
        ok: true,
        trackerId: 'trk-1',
        taskId: 'task-1',
        nextCheckAt: '2026-11-12T04:15:00.000Z',
      }),
    );
    const executor = createTrackExecutor({
      getDocument: () => doc,
      getPageUrl: () => context.source.url,
      startTrack,
    });
    const events = [];
    for await (const event of executor.execute(
      {
        actionId: 'track',
        context,
        condition: { kind: 'price-below', threshold: { amount: 95, currency: 'USD' } },
      },
      new AbortController().signal,
    )) {
      events.push(event);
    }
    expect(startTrack).toHaveBeenCalledOnce();
    expect(events.some((event) => event.type === 'task-created')).toBe(true);
    const result = events.find((event) => event.type === 'result');
    expect(result).toMatchObject({
      type: 'result',
      result: { kind: 'tracking', trackerId: 'trk-1' },
    });
  });
});
