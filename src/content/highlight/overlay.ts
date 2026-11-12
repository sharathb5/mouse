export interface HighlightOverlay {
  show(target: Element | Range): void;
  update(): void;
  hide(): void;
  readonly visible: boolean;
  readonly host: HTMLElement;
}

const HOST_TAG = 'agentic-mouse-highlight';

/**
 * Thin yellow outline over target rects, rendered in an isolated Shadow DOM host.
 * Never mutates page content, styles, or the user's selection.
 */
export function createHighlightOverlay(doc: Document = document): HighlightOverlay {
  let host = doc.querySelector<HTMLElement>(HOST_TAG);
  if (!host) {
    host = doc.createElement(HOST_TAG);
    host.setAttribute('data-testid', 'agentic-mouse-highlight-host');
    doc.documentElement.appendChild(host);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  if (!shadow.querySelector('style')) {
    const style = doc.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed !important;
        inset: 0 !important;
        width: 0 !important;
        height: 0 !important;
        overflow: visible !important;
        pointer-events: none !important;
        z-index: 2147483646 !important;
      }
      .box {
        position: fixed;
        box-sizing: border-box;
        border: 2px solid #f2b705;
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(242, 183, 5, 0.35);
        pointer-events: none;
      }
    `;
    shadow.appendChild(style);
  }

  let layer = shadow.querySelector<HTMLElement>('[data-layer]');
  if (!layer) {
    layer = doc.createElement('div');
    layer.dataset.layer = 'true';
    shadow.appendChild(layer);
  }

  let target: Element | Range | null = null;
  let visible = false;
  const controllers: AbortController[] = [];

  const paint = () => {
    if (!target) return;
    const rects = rectsOf(target);
    layer.replaceChildren();
    for (const rect of rects) {
      if (rect.width < 1 && rect.height < 1) continue;
      const box = doc.createElement('div');
      box.className = 'box';
      box.dataset.testid = 'agentic-mouse-outline';
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${Math.max(rect.width, 2)}px`;
      box.style.height = `${Math.max(rect.height, 2)}px`;
      layer.appendChild(box);
    }
  };

  const clearListeners = () => {
    while (controllers.length) controllers.pop()?.abort();
  };

  const attachListeners = () => {
    clearListeners();
    const controller = new AbortController();
    controllers.push(controller);
    const opts = { signal: controller.signal, passive: true, capture: true } as const;
    doc.defaultView?.addEventListener('scroll', paint, opts);
    doc.defaultView?.addEventListener('resize', paint, opts);
  };

  return {
    get visible() {
      return visible;
    },
    get host() {
      return host;
    },
    show(next) {
      target = next;
      visible = true;
      host.setAttribute('data-visible', 'true');
      attachListeners();
      paint();
    },
    update() {
      if (visible) paint();
    },
    hide() {
      visible = false;
      target = null;
      host.removeAttribute('data-visible');
      clearListeners();
      layer.replaceChildren();
    },
  };
}

function rectsOf(target: Element | Range): DOMRect[] {
  if (target instanceof Range) {
    return [...target.getClientRects()].map(cloneRect);
  }
  const rect = target.getBoundingClientRect();
  return [cloneRect(rect)];
}

function cloneRect(rect: DOMRect | DOMRectReadOnly): DOMRect {
  return new DOMRect(rect.x, rect.y, rect.width, rect.height);
}

export { HOST_TAG as HIGHLIGHT_HOST_TAG };
