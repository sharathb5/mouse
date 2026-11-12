import { classifyElement, isExcludedChrome } from '@/core/classification';
import type { ElementKind, SelectedContext } from '@/core/contracts';
import { buildSelectedContext } from '../extraction';
import type { MenuInvocation } from '../invocation';

export interface SelectionHandle {
  readonly element: Element;
  readonly kind: ElementKind;
  expand(): SelectionHandle | null;
  shrink(): SelectionHandle | null;
  toContext(): SelectedContext;
}

const UNIT_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, table, article, section, [role="article"]';

/**
 * Resolve a semantic content unit under the invocation target. Must stay fast (< 100 ms);
 * no network, no full-document scans beyond a short ancestor walk.
 */
export function selectAt(invocation: MenuInvocation): SelectionHandle {
  const seed = resolveSeedElement(invocation);
  return createHandle(seed);
}

function resolveSeedElement(invocation: MenuInvocation): Element {
  const selection = typeof window !== 'undefined' ? window.getSelection() : null;
  if (
    invocation.quickKind === 'text-selection' &&
    selection &&
    !selection.isCollapsed &&
    selection.rangeCount > 0
  ) {
    const node = selection.getRangeAt(0).commonAncestorContainer;
    const el = node instanceof Element ? node : node.parentElement;
    if (el) {
      const unit = el.closest(UNIT_SELECTOR);
      if (unit && !isExcludedChrome(unit)) return unit;
      if (!isExcludedChrome(el)) return el;
    }
  }

  const target = invocation.target;
  if (!target) return document.body;

  if (target instanceof HTMLImageElement || target.closest('picture')) {
    return target instanceof HTMLImageElement ? target : (target.closest('picture') ?? target);
  }

  const link = target.closest('a[href]');
  if (link && invocation.quickKind === 'link') return link;

  const unit = target.closest(UNIT_SELECTOR);
  if (unit && !isExcludedChrome(unit)) return preferMainContent(unit);

  // Climb out of chrome into the nearest content unit.
  let current: Element | null = target;
  while (current && current !== document.documentElement) {
    if (!isExcludedChrome(current)) {
      const candidate = current.closest(UNIT_SELECTOR);
      if (candidate && !isExcludedChrome(candidate)) return preferMainContent(candidate);
      if (current.matches('div, span, main') && current.textContent.trim().length > 40) {
        return current;
      }
    }
    current = current.parentElement;
  }

  return document.querySelector('article, main, [role="main"]') ?? document.body;
}

function preferMainContent(el: Element): Element {
  // If the hit is inside nav/aside, try to find an article sibling region instead.
  if (!isExcludedChrome(el)) return el;
  const article = document.querySelector('article, main');
  return article ?? el;
}

function createHandle(element: Element): SelectionHandle {
  const kind = classifyElement(element).kind;
  return {
    element,
    kind,
    expand: () => {
      const next = expandFrom(element);
      return next && next !== element ? createHandle(next) : null;
    },
    shrink: () => {
      const next = shrinkFrom(element);
      return next && next !== element ? createHandle(next) : null;
    },
    toContext: () =>
      buildSelectedContext({
        element,
        selection: kind === 'paragraph' || kind === 'unknown' ? window.getSelection() : null,
      }),
  };
}

function expandFrom(element: Element): Element | null {
  // paragraph → section → article → main
  if (element.matches('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, table')) {
    const section = element.closest('section');
    if (section && section !== element && !isExcludedChrome(section)) return section;
    const article = element.closest('article, [role="article"]');
    if (article && article !== element && !isExcludedChrome(article)) return article;
    const main = element.closest('main, [role="main"]');
    if (main && main !== element) return main;
  }
  if (element.matches('section')) {
    const article = element.closest('article, [role="article"]');
    if (article && article !== element) return article;
  }
  if (element.matches('article, [role="article"]')) {
    const main = element.closest('main, [role="main"]');
    if (main && main !== element) return main;
  }
  // Generic climb: parent that still looks like content.
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    if (!isExcludedChrome(parent) && parent.matches('section, article, main, div')) {
      const text = parent.textContent.trim();
      if (text.length > element.textContent.trim().length + 20) return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function shrinkFrom(element: Element): Element | null {
  if (element.matches('article, section, main, [role="article"], [role="main"]')) {
    const first = element.querySelector(UNIT_SELECTOR);
    if (first && first !== element && !isExcludedChrome(first)) return first;
  }
  const child = [...element.children].find(
    (c) => c.matches(UNIT_SELECTOR) && !isExcludedChrome(c) && c.textContent.trim().length > 0,
  );
  return child ?? null;
}
