import { createRoot, type Root } from 'react-dom/client';
import type { Point } from '../positioning';
import { InlinePanel } from './InlinePanel';
import { PANEL_CSS } from './panel-styles';
import { createInitialPanelState, panelReducer, type PanelAction, type PanelState } from './state';

const HOST_TAG = 'agentic-mouse-panel';

export interface PanelController {
  open(title: string, anchor: Point, providerLabel?: string | null): void;
  dispatch(action: PanelAction): void;
  getState(): PanelState;
  setFollowUpHandler(handler: ((question: string) => void) | null): void;
  close(): void;
  readonly host: HTMLElement;
}

export function createPanelController(doc: Document = document): PanelController {
  let host = doc.querySelector<HTMLElement>(HOST_TAG);
  if (!host) {
    host = doc.createElement(HOST_TAG);
    host.setAttribute('data-testid', 'agentic-mouse-panel-host');
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
    style.textContent = `:host { all: initial; }\n${PANEL_CSS}`;
    shadow.appendChild(style);
  }

  let mount = shadow.querySelector<HTMLElement>('[data-root]');
  if (!mount) {
    mount = doc.createElement('div');
    mount.dataset.root = 'true';
    shadow.appendChild(mount);
  }

  const root: Root = createRoot(mount);
  let state = createInitialPanelState();
  let anchor: Point = { x: 0, y: 0 };
  let followUp: ((question: string) => void) | null = null;
  let open = false;

  const render = () => {
    if (!open) {
      root.render(null);
      return;
    }
    root.render(
      <InlinePanel
        state={state}
        anchor={anchor}
        onClose={() => {
          controller.close();
        }}
        onFollowUp={followUp ?? undefined}
      />,
    );
  };

  const controller: PanelController = {
    get host() {
      return host;
    },
    open(title, nextAnchor, providerLabel = null) {
      open = true;
      anchor = nextAnchor;
      state = panelReducer(state, { type: 'reset', title, providerLabel });
      render();
    },
    dispatch(action) {
      state = panelReducer(state, action);
      render();
    },
    getState: () => state,
    setFollowUpHandler(handler) {
      followUp = handler;
      render();
    },
    close() {
      open = false;
      followUp = null;
      state = createInitialPanelState();
      render();
    },
  };

  return controller;
}

export { HOST_TAG as PANEL_HOST_TAG };
