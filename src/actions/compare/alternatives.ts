import type { ExtractedItem } from '@/core/contracts';
import { extractFromDocument, type SourceAdapter } from '@/core/sources';

/**
 * Retrieves alternative products/listings for Compare. Results must stay grounded:
 * every returned item carries source URLs from extracted page data — never invented.
 */
export interface AlternativesFindResult {
  items: ExtractedItem[];
  /**
   * How candidates were obtained. Tests using StaticAlternativesProvider must keep
   * `source: 'static-fixture'` so runs are never reported as live retrieval.
   */
  source: 'local-page' | 'page-links' | 'openrouter-ranked-links' | 'static-fixture' | 'none';
  /** Honest status for the UI when remote help is unavailable or unused. */
  notice?: string;
}

export interface AlternativesProvider {
  readonly id: string;
  find(item: ExtractedItem, signal: AbortSignal): Promise<AlternativesFindResult>;
}

export interface PageLinkCandidate {
  url: string;
  text: string;
}

/** Collect http(s) anchors from a document, de-duplicated. */
export function collectPageLinkCandidates(
  doc: Document,
  pageUrl: string,
  limit = 40,
): PageLinkCandidate[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: PageLinkCandidate[] = [];
  for (const anchor of Array.from(doc.querySelectorAll('a[href]'))) {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      continue;
    }
    if (absolute.protocol !== 'http:' && absolute.protocol !== 'https:') continue;
    absolute.hash = '';
    const hrefKey = absolute.href;
    if (seen.has(hrefKey)) continue;
    seen.add(hrefKey);
    out.push({
      url: hrefKey,
      text: (anchor.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Token overlap + path heuristics — free/local, no network. */
export function scoreLinkCandidate(
  seed: ExtractedItem,
  candidate: PageLinkCandidate,
  pageHost: string,
): number {
  const seedName = String(seed.name.value).toLowerCase();
  const seedTokens = new Set(seedName.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const haystack = `${candidate.text} ${candidate.url}`.toLowerCase();
  let score = 0;
  for (const token of seedTokens) {
    if (haystack.includes(token)) score += 2;
  }
  const pathHints = [
    'product',
    'item',
    'dp/',
    'listing',
    'job',
    'apartment',
    'property',
    'sku',
    'offer',
  ];
  for (const hint of pathHints) {
    if (haystack.includes(hint)) score += 1;
  }
  try {
    const host = new URL(candidate.url).hostname;
    if (host === pageHost) score += 1;
  } catch {
    // ignore
  }
  // Prefer not linking back to the seed itself.
  if (seed.url && candidate.url === seed.url) return -100;
  if (candidate.url === seed.name.sourceUrl) return -100;
  return score;
}

export function pickHeuristicLinks(
  seed: ExtractedItem,
  candidates: readonly PageLinkCandidate[],
  pageUrl: string,
  limit = 5,
): PageLinkCandidate[] {
  let pageHost = '';
  try {
    pageHost = new URL(pageUrl).hostname;
  } catch {
    pageHost = '';
  }
  return [...candidates]
    .map((candidate) => ({ candidate, score: scoreLinkCandidate(seed, candidate, pageHost) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/**
 * Local-DOM alternatives: other structured items already on the same page.
 * Never fabricates rows — only returns ExtractedItem values from adapters.
 */
export class LocalPageAlternativesProvider implements AlternativesProvider {
  readonly id = 'local-page';

  constructor(
    private readonly deps: {
      getDocument: () => Document;
      getPageUrl: () => string;
      adapters?: readonly SourceAdapter[];
    },
  ) {}

  find(item: ExtractedItem, signal: AbortSignal): Promise<AlternativesFindResult> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    const pageUrl = this.deps.getPageUrl();
    const items = extractFromDocument(this.deps.getDocument(), pageUrl, this.deps.adapters).filter(
      (candidate) => candidate.id !== item.id,
    );
    if (items.length > 0) {
      return Promise.resolve({ items, source: 'local-page' as const });
    }
    return Promise.resolve({
      items,
      source: 'none' as const,
      notice:
        'No other structured items on this page. Remote alternative search needs OpenRouter (Settings) or candidate URLs.',
    });
  }
}

export type RankPageLinksFn = (
  seed: ExtractedItem,
  links: readonly PageLinkCandidate[],
  signal: AbortSignal,
) => Promise<{ urls: string[]; usedOpenRouter: boolean; notice?: string }>;

/**
 * Real alternatives adapter: local page siblings first, then ranked page links fetched
 * and re-extracted with SourceAdapters. Optional OpenRouter only ranks URLs that already
 * appear on the page (never invents destinations or prices).
 */
export class PageLinkAlternativesProvider implements AlternativesProvider {
  readonly id = 'page-links';

  constructor(
    private readonly deps: {
      getDocument: () => Document;
      getPageUrl: () => string;
      adapters?: readonly SourceAdapter[];
      fetchDocument: (url: string, signal: AbortSignal) => Promise<Document | null>;
      /** When provided, may use OpenRouter (if configured) to rank on-page links. */
      rankLinks?: RankPageLinksFn;
      maxFetches?: number;
    },
  ) {}

  async find(item: ExtractedItem, signal: AbortSignal): Promise<AlternativesFindResult> {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const pageUrl = this.deps.getPageUrl();
    const doc = this.deps.getDocument();
    const local = extractFromDocument(doc, pageUrl, this.deps.adapters).filter(
      (candidate) => candidate.id !== item.id,
    );

    const allLinks = collectPageLinkCandidates(doc, pageUrl);
    let ranked: PageLinkCandidate[] = [];
    let source: AlternativesFindResult['source'] = local.length > 0 ? 'local-page' : 'none';
    let notice: string | undefined;

    if (this.deps.rankLinks && allLinks.length > 0) {
      const rankedResult = await this.deps.rankLinks(item, allLinks, signal);
      const byUrl = new Map(allLinks.map((link) => [link.url, link]));
      ranked = rankedResult.urls
        .map((url) => byUrl.get(url))
        .filter((link): link is PageLinkCandidate => link !== undefined);
      if (rankedResult.usedOpenRouter && ranked.length > 0) {
        source = 'openrouter-ranked-links';
      }
      notice = rankedResult.notice;
    }

    if (ranked.length === 0 && allLinks.length > 0) {
      ranked = pickHeuristicLinks(item, allLinks, pageUrl, this.deps.maxFetches ?? 5);
      if (ranked.length > 0 && source === 'none') source = 'page-links';
      notice ??=
        'OpenRouter is not configured for ranking alternatives; using local link heuristics only. Add an OpenRouter key in Settings for structured help.';
    }

    const fetched: ExtractedItem[] = [];
    const maxFetches = this.deps.maxFetches ?? 5;
    for (const link of ranked.slice(0, maxFetches)) {
      // fetchDocument honors AbortSignal; avoid re-checking signal.aborted (narrowed after the
      // entry guard above even though abortion can still happen asynchronously).
      if (item.url !== undefined && link.url === item.url) continue;
      const remoteDoc = await this.deps.fetchDocument(link.url, signal);
      if (!remoteDoc) continue;
      for (const extracted of extractFromDocument(remoteDoc, link.url, this.deps.adapters)) {
        if (extracted.id === item.id) continue;
        fetched.push(extracted);
      }
    }

    const items = [...local, ...fetched];
    if (items.length === 0) {
      return {
        items: [],
        source: 'none',
        notice:
          notice ??
          'No grounded alternatives found on this page. Configure OpenRouter in Settings for link ranking, or pass candidate URLs.',
      };
    }

    if (fetched.length > 0 && source === 'local-page') source = 'page-links';

    return {
      items,
      source,
      ...(notice ? { notice } : {}),
    };
  }
}

/** MOCKED: returns no alternatives. Labeled so tests never claim real retrieval. */
export class EmptyAlternativesProvider implements AlternativesProvider {
  readonly id = 'empty-mock';

  find(_item: ExtractedItem, signal: AbortSignal): Promise<AlternativesFindResult> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return Promise.resolve({
      items: [],
      source: 'none',
      notice: 'MOCKED EmptyAlternativesProvider — not live web retrieval.',
    });
  }
}

/**
 * MOCKED: returns a fixed list of alternatives supplied by the caller (fixture / unit tests).
 * Do not report these as live web results.
 */
export class StaticAlternativesProvider implements AlternativesProvider {
  readonly id = 'static-fixture-mock';

  constructor(private readonly alternatives: readonly ExtractedItem[]) {}

  find(item: ExtractedItem, signal: AbortSignal): Promise<AlternativesFindResult> {
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return Promise.resolve({
      items: this.alternatives.filter((alt) => alt.id !== item.id),
      source: 'static-fixture',
      notice: 'MOCKED StaticAlternativesProvider — fixture data, not live web retrieval.',
    });
  }
}
