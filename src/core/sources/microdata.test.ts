import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { microdataAdapter } from './microdata';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/pages');

describe('microdataAdapter', () => {
  it('extracts apartment listings from itemscope markup', () => {
    const html = readFileSync(join(fixtures, 'apartments.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const url = new URL('http://127.0.0.1:4321/apartments.html');
    const items = microdataAdapter.extractItems(doc, url);
    expect(items).toHaveLength(2);
    expect(items[0]?.name.value).toBe('Sunlit Studio on Pine');
    expect(items[0]?.fields.price?.value).toBe(1850);
    expect(items[0]?.fields.bedrooms?.value).toBe(0);
    expect(items[1]?.fields.bathrooms?.value).toBe(2);
    expect(items.every((item) => item.adapterId === 'microdata')).toBe(true);
  });
});
