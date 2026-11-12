import type { ExtractedItem } from '../contracts';
import { jsonLdAdapter } from './json-ld';
import { microdataAdapter } from './microdata';
import { openGraphAdapter } from './open-graph';
import type { SourceAdapter } from './types';

export type { SourceAdapter } from './types';
export { jsonLdAdapter } from './json-ld';
export { microdataAdapter } from './microdata';
export { openGraphAdapter } from './open-graph';

export const DEFAULT_SOURCE_ADAPTERS: readonly SourceAdapter[] = [
  jsonLdAdapter,
  microdataAdapter,
  openGraphAdapter,
];

/**
 * Runs matching adapters and de-duplicates by (kind, name, url). JSON-LD wins over
 * microdata/Open Graph when they describe the same entity.
 */
export function extractFromDocument(
  doc: Document,
  pageUrl: string | URL,
  adapters: readonly SourceAdapter[] = DEFAULT_SOURCE_ADAPTERS,
): ExtractedItem[] {
  const url = pageUrl instanceof URL ? pageUrl : new URL(pageUrl);
  const seen = new Set<string>();
  const items: ExtractedItem[] = [];
  for (const adapter of adapters) {
    if (!adapter.matches(url, doc)) continue;
    for (const item of adapter.extractItems(doc, url)) {
      const key = `${item.kind}|${String(item.name.value).toLowerCase()}|${item.url ?? url.href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}
