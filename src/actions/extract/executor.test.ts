import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SelectedContext } from '@/core/contracts';
import { createExtractExecutor } from './executor';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/pages');

function contextFor(url: string): SelectedContext {
  return {
    untrusted: true,
    source: {
      url,
      title: 'Fixture',
      capturedAt: '2026-11-12T04:00:00.000Z',
      frame: 'top',
    },
    target: { kind: 'page', blocks: [] },
    page: { kind: 'listing', confidence: 0.8, signals: ['test'], listingType: 'product' },
    containsSensitiveData: false,
  };
}

describe('createExtractExecutor', () => {
  it('yields a grounded table for product fixtures', async () => {
    const html = readFileSync(join(fixtures, 'products.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const executor = createExtractExecutor({
      getDocument: () => doc,
      getPageUrl: () => 'http://127.0.0.1:4321/products.html',
    });
    const events = [];
    for await (const event of executor.execute(
      {
        actionId: 'extract',
        context: contextFor('http://127.0.0.1:4321/products.html'),
        format: 'table',
      },
      new AbortController().signal,
    )) {
      events.push(event);
    }
    const result = events.find((event) => event.type === 'result');
    expect(result?.type).toBe('result');
    if (result?.type !== 'result' || result.result.kind !== 'table') {
      throw new Error('expected table result');
    }
    expect(result.result.rows).toHaveLength(3);
    expect(result.result.rows.some((row) => row.name === 'Cedar Desk Lamp')).toBe(true);
    expect(result.result.sources.length).toBeGreaterThan(0);
    expect(result.result.notice).toMatch(/Google Sheets/i);
  });
});
