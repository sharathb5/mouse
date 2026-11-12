export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const VIEWPORT_MARGIN_PX = 8;

/**
 * Places the menu's top-left corner near the pointer, flipping to the other side of the
 * pointer when it would overflow and clamping so it always stays inside the viewport.
 */
export function computeMenuPosition(
  pointer: Point,
  menu: Size,
  viewport: Size,
  margin: number = VIEWPORT_MARGIN_PX,
): Point {
  return {
    x: placeOnAxis(pointer.x, menu.width, viewport.width, margin),
    y: placeOnAxis(pointer.y, menu.height, viewport.height, margin),
  };
}

function placeOnAxis(pointer: number, size: number, viewport: number, margin: number): number {
  let start = pointer;
  if (start + size + margin > viewport) start = pointer - size;
  const max = viewport - size - margin;
  if (max < margin) return margin;
  return Math.min(Math.max(start, margin), max);
}

/** Layout viewport size excluding scrollbars, which is what `position: fixed` uses. */
export function getViewportSize(win: Window = window): Size {
  const root = win.document.documentElement;
  return {
    width: Math.min(win.innerWidth, root.clientWidth || win.innerWidth),
    height: Math.min(win.innerHeight, root.clientHeight || win.innerHeight),
  };
}
