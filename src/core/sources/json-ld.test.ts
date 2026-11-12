import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractFromDocument, jsonLdAdapter } from './index';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/pages');

function load(name: string): Document {
  const html = readFileSync(join(fixtures, name), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('jsonLdAdapter', () => {
  it('extracts product offers from a JSON-LD graph', () => {
    const doc = load('products.html');
    const url = new URL('http://127.0.0.1:4321/products.html');
    expect(jsonLdAdapter.matches(url, doc)).toBe(true);
    const items = jsonLdAdapter.extractItems(doc, url);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.name.value)).toEqual([
      'Cedar Desk Lamp',
      'Oak Monitor Stand',
      'Wool Desk Mat',
    ]);
    expect(items[0]?.fields.price?.value).toBe(79);
    expect(items[0]?.fields.currency?.value).toBe('USD');
    expect(items[0]?.fields.availability?.value).toBe('in-stock');
    expect(items[2]?.fields.availability?.value).toBe('out-of-stock');
    for (const item of items) {
      expect(item.name.sourceUrl).toMatch(/^http/);
      expect(item.fields.price?.sourceUrl).toMatch(/^http/);
    }
  });

  it('extracts job postings', () => {
    const items = extractFromDocument(load('jobs.html'), 'http://127.0.0.1:4321/jobs.html');
    expect(items.filter((item) => item.kind === 'job')).toHaveLength(2);
    const frontend = items.find((item) => item.name.value === 'Frontend Engineer');
    expect(frontend?.fields.company?.value).toBe('Northbeam');
    expect(frontend?.fields.salary?.value).toBe(145000);
    expect(frontend?.fields.location?.value).toBe('Remote');
  });
});
