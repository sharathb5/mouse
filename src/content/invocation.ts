import type { Point } from './positioning';

export type QuickTargetKind = 'text-selection' | 'link' | 'image' | 'element';

/**
 * A cheap snapshot of what the user invoked the menu on. Semantic selection and content
 * extraction (Workstream A) start from this; they must not run in the gesture path.
 */
export interface MenuInvocation {
  id: number;
  source: 'pointer' | 'shortcut';
  anchor: Point;
  target: Element | null;
  quickKind: QuickTargetKind;
  /** `performance.now()`-compatible timestamp of the triggering input. */
  startedAt: number;
}

export function detectQuickTargetKind(
  target: EventTarget | null,
  selection: Selection | null,
): QuickTargetKind {
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) return 'text-selection';
  if (target instanceof Element) {
    if (target.closest('a[href]')) return 'link';
    if (target instanceof HTMLImageElement || target.closest('picture')) return 'image';
  }
  return 'element';
}

export function describeQuickTargetKind(kind: QuickTargetKind): string {
  switch (kind) {
    case 'text-selection':
      return 'Selected text';
    case 'link':
      return 'Link';
    case 'image':
      return 'Image';
    case 'element':
      return 'Page content';
  }
}

/** Anchor for keyboard-shortcut invocations: the end of the selection, else viewport center. */
export function shortcutAnchor(selection: Selection | null, viewport: Point): Point {
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const rect = selection.getRangeAt(selection.rangeCount - 1).getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) return { x: rect.right, y: rect.bottom };
  }
  return { x: Math.round(viewport.x / 2), y: Math.round(viewport.y / 2) };
}
