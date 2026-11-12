import { describe, expect, it } from 'vitest';
import type { ExtractedItem, SelectedContext } from '../contracts';
import { filterItemsBySelectedContext } from './filter-by-context';

function item(name: string): ExtractedItem {
  return {
    id: `item-${name}`,
    kind: 'product',
    name: { value: name, sourceUrl: 'https://example.com' },
    fields: {},
    adapterId: 'test',
    url: 'https://example.com',
  };
}

function context(text: string, kind: 'element' | 'page' = 'element'): SelectedContext {
  return {
    untrusted: true,
    source: {
      url: 'https://example.com',
      title: 'Shop',
      capturedAt: '2026-11-12T04:00:00.000Z',
      frame: 'top',
    },
    target:
      kind === 'page'
        ? { kind: 'page', blocks: [] }
        : {
            kind: 'element',
            element: { kind: 'unknown', confidence: 0.8, signals: ['test'], sensitive: false },
            text,
            blocks: [{ type: 'paragraph', text }],
          },
    page: { kind: 'listing', confidence: 0.8, signals: [], listingType: 'product', itemCount: 3 },
    containsSensitiveData: false,
  };
}

describe('filterItemsBySelectedContext', () => {
  const items = [item('Cedar Desk Lamp'), item('Oak Monitor Stand'), item('Wool Desk Mat')];

  it('narrows to the outlined product when its name is in the selection', () => {
    const filtered = filterItemsBySelectedContext(items, context('Cedar Desk Lamp — $79'));
    expect(filtered.map((entry) => entry.name.value)).toEqual(['Cedar Desk Lamp']);
  });

  it('keeps the full list for page-scoped context', () => {
    expect(filterItemsBySelectedContext(items, context('', 'page'))).toHaveLength(3);
  });

  it('falls back to all items when nothing matches', () => {
    expect(filterItemsBySelectedContext(items, context('Unrelated chrome text'))).toHaveLength(3);
  });
});
