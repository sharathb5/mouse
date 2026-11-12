import type { Browser } from 'wxt/browser';
import {
  AlternativesBackgroundMessageSchema,
  ExtractedItemKindSchema,
  type ExtractedItem,
} from '@/core/contracts';
import { rankAlternativeLinks } from './rank-links';

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function createAlternativesMessageHandler() {
  return (
    message: unknown,
    _sender: Browser.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    const parsed = AlternativesBackgroundMessageSchema.safeParse(message);
    if (!parsed.success) return false;

    const controller = new AbortController();
    void (async () => {
      try {
        const request = parsed.data;
        const kind = ExtractedItemKindSchema.safeParse(request.seed.kind);
        const provenance = request.seed.url ?? request.links[0]?.url ?? 'https://example.com/';
        const seed: Pick<ExtractedItem, 'name' | 'kind' | 'url' | 'fields'> = {
          name: { value: request.seed.name, sourceUrl: provenance },
          kind: kind.success ? kind.data : 'other',
          fields: Object.fromEntries(
            Object.entries(request.seed.fields).map(([key, value]) => [
              key,
              { value, sourceUrl: provenance },
            ]),
          ),
        };
        if (request.seed.url) seed.url = request.seed.url;

        const result = await rankAlternativeLinks({
          seed,
          links: request.links,
          signal: controller.signal,
        });
        sendResponse({
          ok: true,
          urls: result.urls,
          usedOpenRouter: result.usedOpenRouter,
          ...(result.notice ? { notice: result.notice } : {}),
        });
      } catch (error) {
        if (isAbortError(error)) {
          sendResponse({
            ok: true,
            urls: [],
            usedOpenRouter: false,
            notice: 'Alternatives ranking cancelled.',
          });
          return;
        }
        sendResponse({
          ok: true,
          urls: [],
          usedOpenRouter: false,
          notice: error instanceof Error ? error.message : 'Alternatives ranking failed.',
        });
      }
    })();

    return true;
  };
}
