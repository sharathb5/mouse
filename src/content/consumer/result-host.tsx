import { createRoot, type Root } from 'react-dom/client';
import type { ActionResult } from '@/core/contracts';
import { ResultPanel } from './result-panel';
import resultCss from './result-panel.css?inline';

export const RESULT_HOST_TAG = 'agentic-mouse-result-host';

export interface ResultHost {
  show(result: ActionResult): void;
  hide(): void;
}

export function createResultHost(): ResultHost {
  let host: HTMLElement | null = null;
  let root: Root | null = null;

  const ensure = () => {
    if (host && root) return { host, root };
    host = document.createElement(RESULT_HOST_TAG);
    for (const [property, value] of Object.entries({
      display: 'block',
      position: 'fixed',
      top: '16px',
      right: '16px',
      width: 'auto',
      height: 'auto',
      overflow: 'visible',
      'z-index': '2147483646',
    })) {
      host.style.setProperty(property, value, 'important');
    }
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = resultCss;
    const mount = document.createElement('div');
    shadow.append(style, mount);
    document.documentElement.append(host);
    root = createRoot(mount);
    return { host, root };
  };

  return {
    show(result) {
      const current = ensure();
      current.root.render(
        <ResultPanel
          result={result}
          onDismiss={() => {
            current.root.render(null);
            current.host.remove();
            host = null;
            root = null;
          }}
        />,
      );
    },
    hide() {
      root?.render(null);
      host?.remove();
      host = null;
      root = null;
    },
  };
}
