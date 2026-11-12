import { browser } from 'wxt/browser';
import type { ExtractedItem } from '@/core/contracts';
import { AlternativesRankResponseSchema } from '@/core/contracts';
import type { PageLinkCandidate, RankPageLinksFn } from '@/actions/compare/alternatives';

/** Content → background OpenRouter ranking of on-page links (credentials stay in SW). */
export const rankLinksViaBackground: RankPageLinksFn = async (seed, links, signal) => {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  const payload = {
    type: 'agentic-mouse/alternatives/rank-links' as const,
    seed: {
      name: seed.name.value,
      kind: seed.kind,
      ...(seed.url ? { url: seed.url } : {}),
      fields: Object.fromEntries(
        Object.entries(seed.fields).map(([key, value]) => [key, value.value]),
      ),
    },
    links: links.map((link) => ({ url: link.url, text: link.text })),
  };

  const raw: unknown = await Promise.race([
    browser.runtime.sendMessage(payload),
    abortPromise(signal),
  ]);

  const parsed = AlternativesRankResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      urls: [],
      usedOpenRouter: false,
      notice: 'Could not reach alternatives ranking; using local link heuristics only.',
    };
  }

  return {
    urls: parsed.data.urls,
    usedOpenRouter: parsed.data.usedOpenRouter,
    ...(parsed.data.notice ? { notice: parsed.data.notice } : {}),
  };
};

export async function fetchDocumentForCompare(
  url: string,
  signal: AbortSignal,
): Promise<Document | null> {
  try {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (!response.ok) return null;
    const html = await response.text();
    return new DOMParser().parseFromString(html, 'text/html');
  } catch {
    return null;
  }
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
      once: true,
    });
  });
}

/** Exported for tests that need a seed-shaped item without importing content wiring. */
export function seedSummary(
  item: ExtractedItem,
): Pick<ExtractedItem, 'name' | 'kind' | 'url' | 'fields'> {
  return {
    name: item.name,
    kind: item.kind,
    fields: item.fields,
    ...(item.url ? { url: item.url } : {}),
  };
}

export type { PageLinkCandidate };
