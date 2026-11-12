import type { MenuInvocation } from '@/content/invocation';
import { UNCLASSIFIED_PAGE, type SelectedContext, type SelectionTarget } from '@/core/contracts';

/** Temporary context builder until Workstream A lands full extraction. */
export function contextFromInvocation(invocation: MenuInvocation): SelectedContext {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? '';
  const target = buildTarget(invocation, selectedText);

  return {
    untrusted: true,
    source: {
      url: location.href,
      title: document.title || location.hostname,
      ...(document.documentElement.lang ? { language: document.documentElement.lang } : {}),
      capturedAt: new Date().toISOString(),
      frame: window === window.top ? 'top' : 'subframe',
    },
    target,
    page: UNCLASSIFIED_PAGE,
    containsSensitiveData: isSensitiveTarget(invocation.target),
  };
}

function buildTarget(invocation: MenuInvocation, selectedText: string): SelectionTarget {
  if (selectedText) {
    return {
      kind: 'text-selection',
      text: selectedText,
      blocks: [{ type: 'paragraph', text: selectedText }],
    };
  }

  switch (invocation.quickKind) {
    case 'link': {
      const el = invocation.target;
      if (!el) break;
      const href = el instanceof HTMLAnchorElement ? el.href : el.closest('a')?.href;
      if (href) {
        const label = el.textContent.trim();
        return {
          kind: 'link',
          href,
          text: label.length > 0 ? label : href,
        };
      }
      break;
    }
    case 'image': {
      if (invocation.target instanceof HTMLImageElement && invocation.target.src) {
        return {
          kind: 'image',
          src: invocation.target.src,
          alt: invocation.target.alt || 'image',
        };
      }
      break;
    }
    case 'text-selection':
    case 'element':
      break;
  }

  const text =
    invocation.target instanceof HTMLElement
      ? invocation.target.innerText.trim().slice(0, 4000)
      : '';
  if (text) {
    return {
      kind: 'element',
      element: {
        kind: 'unknown',
        confidence: 0.4,
        signals: ['bootstrap-context-from-invocation'],
        sensitive: isSensitiveTarget(invocation.target),
      },
      text,
      blocks: [{ type: 'paragraph', text }],
    };
  }

  const bodyText = document.body.innerText.trim().slice(0, 4000);
  return {
    kind: 'page',
    blocks: [
      {
        type: 'paragraph',
        text: bodyText || document.title || location.href,
      },
    ],
  };
}

function isSensitiveTarget(target: Element | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const field =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target
      : target.closest('input, textarea');
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false;
  const type = field instanceof HTMLInputElement ? field.type : 'text';
  return (
    type === 'password' ||
    type === 'email' ||
    field.autocomplete === 'cc-number' ||
    field.autocomplete === 'one-time-code'
  );
}
