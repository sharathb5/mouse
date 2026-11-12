import { createRoot, type Root } from 'react-dom/client';

const HOST_TAG = 'agentic-mouse-selection-chrome';

export interface SelectionChromeController {
  show(options: {
    kindLabel: string;
    canExpand: boolean;
    canShrink: boolean;
    anchor: { x: number; y: number };
  }): void;
  hide(): void;
  readonly host: HTMLElement;
}

export function createSelectionChrome(handlers: {
  onExpand: () => void;
  onShrink: () => void;
  onDone: () => void;
}): SelectionChromeController {
  const doc = document;
  let host = doc.querySelector<HTMLElement>(HOST_TAG);
  if (!host) {
    host = doc.createElement(HOST_TAG);
    host.setAttribute('data-testid', 'agentic-mouse-selection-chrome-host');
    for (const [property, value] of Object.entries({
      display: 'block',
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      overflow: 'visible',
      'z-index': '2147483647',
      'pointer-events': 'none',
    })) {
      host.style.setProperty(property, value, 'important');
    }
    doc.documentElement.appendChild(host);
  }

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  if (!shadow.querySelector('style')) {
    const style = doc.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .bar {
        position: fixed;
        display: flex;
        gap: 6px;
        align-items: center;
        padding: 6px 8px;
        background: #fff;
        color: #1c1b19;
        border: 1px solid rgba(28,27,25,0.12);
        border-radius: 999px;
        box-shadow: 0 8px 20px rgba(0,0,0,0.14);
        font: 12px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        pointer-events: auto;
        z-index: 2147483647;
      }
      .bar button {
        border: none;
        background: #fff6d6;
        color: #1c1b19;
        border-radius: 999px;
        padding: 4px 10px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .bar button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .label {
        padding: 0 4px;
        color: #6b6760;
        max-width: 140px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
    shadow.appendChild(style);
  }

  let mount = shadow.querySelector<HTMLElement>('[data-root]');
  if (!mount) {
    mount = doc.createElement('div');
    mount.dataset.root = 'true';
    shadow.appendChild(mount);
  }

  const root: Root = createRoot(mount);
  let visible = false;

  return {
    get host() {
      return host;
    },
    show({ kindLabel, canExpand, canShrink, anchor }) {
      visible = true;
      root.render(
        <div
          className="bar"
          data-testid="agentic-mouse-selection-chrome"
          style={{ left: Math.max(8, anchor.x), top: Math.max(8, anchor.y) }}
        >
          <span className="label">{kindLabel}</span>
          <button
            type="button"
            data-testid="agentic-mouse-shrink"
            disabled={!canShrink}
            onClick={handlers.onShrink}
          >
            Shrink
          </button>
          <button
            type="button"
            data-testid="agentic-mouse-expand"
            disabled={!canExpand}
            onClick={handlers.onExpand}
          >
            Expand
          </button>
          <button
            type="button"
            data-testid="agentic-mouse-selection-done"
            onClick={handlers.onDone}
          >
            Done
          </button>
        </div>,
      );
    },
    hide() {
      if (!visible) return;
      visible = false;
      root.render(null);
    },
  };
}

export { HOST_TAG as SELECTION_CHROME_HOST_TAG };
