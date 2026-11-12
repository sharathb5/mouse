import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ExtractedItem } from '@/core/contracts';
import { extractFromDocument } from '@/core/sources';
import {
  LocalPageAlternativesProvider,
  PageLinkAlternativesProvider,
  collectPageLinkCandidates,
  pickHeuristicLinks,
  scoreLinkCandidate,
} from './alternatives';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/pages');

describe('local alternatives heuristics', () => {
  it('scores same-host product-like links above unrelated ones', () => {
    const seed: ExtractedItem = {
      id: 'seed',
      kind: 'product',
      name: { value: 'Cedar Desk Lamp', sourceUrl: 'http://127.0.0.1:4321/products.html#lamp' },
      url: 'http://127.0.0.1:4321/products.html#lamp',
      fields: {},
      adapterId: 'test',
    };
    const product = scoreLinkCandidate(
      seed,
      { url: 'http://127.0.0.1:4321/product/oak-stand', text: 'Oak Monitor Stand' },
      '127.0.0.1',
    );
    const unrelated = scoreLinkCandidate(
      seed,
      { url: 'https://other.example/about', text: 'About us' },
      '127.0.0.1',
    );
    expect(product).toBeGreaterThan(unrelated);
  });

  it('LocalPageAlternativesProvider returns sibling products from the listing fixture', async () => {
    const html = readFileSync(join(fixtures, 'products.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pageUrl = 'http://127.0.0.1:4321/products.html';
    const items = extractFromDocument(doc, pageUrl);
    const seed = items[0];
    expect(seed).toBeDefined();
    if (!seed) return;

    const provider = new LocalPageAlternativesProvider({
      getDocument: () => doc,
      getPageUrl: () => pageUrl,
    });
    const result = await provider.find(seed, new AbortController().signal);
    expect(result.source).toBe('local-page');
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items.every((item) => item.name.sourceUrl)).toBe(true);
  });

  it('PageLinkAlternativesProvider fetches ranked links and extracts grounded items', async () => {
    const listingHtml = readFileSync(join(fixtures, 'products.html'), 'utf8');
    const listingDoc = new DOMParser().parseFromString(listingHtml, 'text/html');
    const seedHtml = `<!doctype html><html><head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Trackable Lamp',
        offers: {
          '@type': 'Offer',
          price: '100.00',
          priceCurrency: 'USD',
          url: 'http://127.0.0.1:4321/product-track.html',
        },
      })}</script>
    </head><body>
      <h1>Trackable Lamp</h1>
      <a href="http://127.0.0.1:4321/products.html#stand">Oak Monitor Stand product</a>
      <a href="http://127.0.0.1:4321/about">About</a>
    </body></html>`;
    const seedDoc = new DOMParser().parseFromString(seedHtml, 'text/html');
    const seedUrl = 'http://127.0.0.1:4321/product-track.html';
    const seed = extractFromDocument(seedDoc, seedUrl)[0];
    expect(seed).toBeDefined();
    if (!seed) return;

    const links = collectPageLinkCandidates(seedDoc, seedUrl);
    expect(pickHeuristicLinks(seed, links, seedUrl).length).toBeGreaterThan(0);

    const provider = new PageLinkAlternativesProvider({
      getDocument: () => seedDoc,
      getPageUrl: () => seedUrl,
      fetchDocument: (url) => {
        if (url.includes('products.html')) return Promise.resolve(listingDoc);
        return Promise.resolve(null);
      },
      // Simulate unconfigured OpenRouter — local heuristics only.
      rankLinks: () =>
        Promise.resolve({
          urls: [],
          usedOpenRouter: false,
          notice:
            'OpenRouter is not configured; using local link heuristics only. Add an OpenRouter API key in Settings for structured alternative ranking.',
        }),
    });

    const result = await provider.find(seed, new AbortController().signal);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.notice).toMatch(/OpenRouter is not configured/i);
    expect(result.source === 'page-links' || result.source === 'local-page').toBe(true);
    expect(result.items.every((item) => typeof item.name.sourceUrl === 'string')).toBe(true);
  });
});
