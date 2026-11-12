import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ExtractedItem, SelectedContext } from '@/core/contracts';
import { createCompareExecutor } from './executor';
import { StaticAlternativesProvider } from './alternatives';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/pages');

const context: SelectedContext = {
  untrusted: true,
  source: {
    url: 'http://127.0.0.1:4321/products.html',
    title: 'Products',
    capturedAt: '2026-11-12T04:00:00.000Z',
    frame: 'top',
  },
  target: { kind: 'page', blocks: [] },
  page: { kind: 'listing', confidence: 0.8, signals: ['test'], listingType: 'product' },
  containsSensitiveData: false,
};

describe('createCompareExecutor', () => {
  it('compares local listing items with per-value sources', async () => {
    const html = readFileSync(join(fixtures, 'products.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const executor = createCompareExecutor({
      getDocument: () => doc,
      getPageUrl: () => context.source.url,
    });
    const events = [];
    for await (const event of executor.execute(
      { actionId: 'compare', context, candidateUrls: [] },
      new AbortController().signal,
    )) {
      events.push(event);
    }
    const result = events.find((event) => event.type === 'result');
    if (result?.type !== 'result' || result.result.kind !== 'comparison') {
      throw new Error('expected comparison');
    }
    expect(result.result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.result.sources.length).toBeGreaterThan(0);
    expect(result.result.summary).toContain('Compared');
    expect(result.result.summary).toMatch(/lowest listed price|lists a price/i);
  });

  it('merges MOCKED alternatives from StaticAlternativesProvider', async () => {
    const html = readFileSync(join(fixtures, 'product-track.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const alt: ExtractedItem = {
      id: 'alt-1',
      kind: 'product',
      name: { value: 'Alt Lamp', sourceUrl: 'https://alt.example/lamp' },
      url: 'https://alt.example/lamp',
      fields: {
        price: { value: 90, sourceUrl: 'https://alt.example/lamp' },
        currency: { value: 'USD', sourceUrl: 'https://alt.example/lamp' },
      },
      adapterId: 'mock-alternatives',
    };
    const executor = createCompareExecutor({
      getDocument: () => doc,
      getPageUrl: () => 'http://127.0.0.1:4321/product-track.html',
      // MOCKED: static fixture alternatives, not live web retrieval.
      alternatives: new StaticAlternativesProvider([alt]),
    });
    const events = [];
    for await (const event of executor.execute(
      {
        actionId: 'compare',
        context: {
          ...context,
          source: { ...context.source, url: 'http://127.0.0.1:4321/product-track.html' },
        },
        candidateUrls: [],
      },
      new AbortController().signal,
    )) {
      events.push(event);
    }
    const result = events.find((event) => event.type === 'result');
    if (result?.type !== 'result' || result.result.kind !== 'comparison') {
      throw new Error('expected comparison');
    }
    expect(result.result.items.some((item) => item.name === 'Alt Lamp')).toBe(true);
    expect(result.result.notice).toMatch(/MOCKED/i);
  });
});
