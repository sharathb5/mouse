import { classifyElement, classifyPage } from '@/core/classification';
import {
  SelectedContextSchema,
  type ContentBlock,
  type SelectedContext,
  type SelectionTarget,
} from '@/core/contracts';
import { blocksToPlainText, contextToUntrustedText } from '@/core/context-text';
import { extractBlocks } from './blocks';

export { contextToUntrustedText };

export interface BuildContextOptions {
  element: Element;
  /** Optional browser Selection when the user highlighted text. */
  selection?: Selection | null;
  url?: string;
  title?: string;
  now?: Date;
}

/** Build a validated SelectedContext from a DOM element (and optional text selection). */
export function buildSelectedContext(options: BuildContextOptions): SelectedContext {
  const doc = options.element.ownerDocument;
  const url = options.url ?? (doc.URL || 'https://invalid.local/');
  const title = options.title ?? doc.title;
  const page = classifyPage(doc, url);
  const elementClass = classifyElement(options.element);
  const selection = options.selection ?? null;

  let target: SelectionTarget;
  let containsSensitiveData = elementClass.sensitive;

  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const text = selection.toString().replace(/\s+/g, ' ').trim();
    const blocks: ContentBlock[] = text ? [{ type: 'paragraph', text }] : [];
    target = { kind: 'text-selection', text: text || ' ', blocks };
  } else if (elementClass.kind === 'link') {
    const anchor = options.element.closest('a[href]');
    if (anchor instanceof HTMLAnchorElement) {
      target = {
        kind: 'link',
        href: absoluteUrl(anchor.href, doc),
        text: anchor.textContent.trim() || anchor.href,
      };
    } else {
      target = elementTarget(options.element, elementClass);
    }
  } else if (elementClass.kind === 'image') {
    const img =
      options.element instanceof HTMLImageElement
        ? options.element
        : options.element.querySelector('img');
    if (img instanceof HTMLImageElement) {
      target = {
        kind: 'image',
        src: absoluteUrl(img.src, doc),
        alt: img.alt || '',
      };
    } else {
      target = elementTarget(options.element, elementClass);
    }
  } else {
    target = elementTarget(options.element, elementClass);
  }

  if (options.element.querySelector('input[type="password"], input[autocomplete^="cc-"]')) {
    containsSensitiveData = true;
  }

  const lang = doc.documentElement.lang.trim();
  const view = doc.defaultView;
  const frame = view?.top === view ? 'top' : 'subframe';

  const context: SelectedContext = {
    untrusted: true,
    source: {
      url: absoluteUrl(url, doc),
      title: title.slice(0, 1000),
      capturedAt: (options.now ?? new Date()).toISOString(),
      frame,
      ...(lang ? { language: lang } : {}),
    },
    target,
    page,
    containsSensitiveData,
  };

  return SelectedContextSchema.parse(context);
}

function elementTarget(
  element: Element,
  elementClass: ReturnType<typeof classifyElement>,
): SelectionTarget {
  const blocks = extractBlocks(element);
  const text = blocksToPlainText(blocks) || element.textContent.replace(/\s+/g, ' ').trim();
  return {
    kind: 'element',
    element: elementClass,
    text,
    blocks,
  };
}

function absoluteUrl(value: string, doc: Document): string {
  try {
    return new URL(value, doc.baseURI).href;
  } catch {
    return 'https://invalid.local/';
  }
}
