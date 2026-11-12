import {
  SelectedContextSchema,
  UNCLASSIFIED_PAGE,
  type PageClassification,
  type SelectedContext,
} from '@/core/contracts';
import { extractFromDocument } from '@/core/sources';

function classifyFromItems(url: string): PageClassification {
  try {
    const items = extractFromDocument(document, url);
    if (items.some((item) => item.kind === 'product' || item.kind === 'offer')) {
      return {
        kind: 'product',
        confidence: 0.7,
        signals: ['consumer-source-adapter'],
      };
    }
    if (items.some((item) => item.kind === 'job')) {
      return {
        kind: 'listing',
        confidence: 0.7,
        signals: ['consumer-source-adapter'],
        listingType: 'job',
        itemCount: items.length,
      };
    }
    if (items.some((item) => item.kind === 'residence')) {
      return {
        kind: 'listing',
        confidence: 0.7,
        signals: ['consumer-source-adapter'],
        listingType: 'apartment',
        itemCount: items.length,
      };
    }
    if (items.length > 1) {
      return {
        kind: 'listing',
        confidence: 0.6,
        signals: ['consumer-source-adapter'],
        listingType: 'product',
        itemCount: items.length,
      };
    }
  } catch {
    // Fall through to unclassified.
  }
  return UNCLASSIFIED_PAGE;
}

/**
 * Minimal SelectedContext builder for Workstream C until Workstream A's extraction lands.
 * Uses page-level target and local source adapters for classification hints only.
 */
export function buildPageSelectedContext(): SelectedContext {
  const url = location.href;
  return SelectedContextSchema.parse({
    untrusted: true,
    source: {
      url,
      title: document.title.slice(0, 1000),
      language: document.documentElement.lang || undefined,
      capturedAt: new Date().toISOString(),
      frame: window === window.top ? 'top' : 'subframe',
    },
    target: {
      kind: 'page',
      blocks: [],
    },
    page: classifyFromItems(url),
    containsSensitiveData: Boolean(
      document.querySelector(
        'input[type="password"], input[autocomplete="cc-number"], input[autocomplete="one-time-code"]',
      ),
    ),
  });
}
