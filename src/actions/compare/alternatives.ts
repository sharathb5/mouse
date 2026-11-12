import type { ExtractedItem } from '@/core/contracts';

/**
 * Retrieves alternative products/listings for Compare. The real source (user-provided URLs,
 * free search API, etc.) is an open product decision — no paid infrastructure.
 */
export interface AlternativesProvider {
  find(item: ExtractedItem, signal: AbortSignal): Promise<ExtractedItem[]>;
}

/** MOCKED: returns no alternatives. Labeled so tests never claim real retrieval. */
export class EmptyAlternativesProvider implements AlternativesProvider {
  find(item: ExtractedItem, signal: AbortSignal): Promise<ExtractedItem[]> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    // item is accepted for interface parity; this mock never uses page content.
    return Promise.resolve(item.id ? [] : []);
  }
}

/**
 * MOCKED: returns a fixed list of alternatives supplied by the caller (fixture / unit tests).
 * Do not report these as live web results.
 */
export class StaticAlternativesProvider implements AlternativesProvider {
  constructor(private readonly alternatives: readonly ExtractedItem[]) {}

  find(item: ExtractedItem, signal: AbortSignal): Promise<ExtractedItem[]> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    // Keep alternatives that are not the seed item itself.
    return Promise.resolve(this.alternatives.filter((alt) => alt.id !== item.id));
  }
}
