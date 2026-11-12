/**
 * React-backed content UI loaded after the user picks an action (or needs selection chrome).
 * Kept in a separate ESM chunk so the gesture/menu shell does not parse React on every page.
 */
export { createElement } from 'react';
export { createRoot } from 'react-dom/client';
export { SendToAgentDialog } from '@/actions/send-to-agent/SendToAgentDialog';
export { contextFromInvocation } from '@/actions/send-to-agent/context-from-invocation';
export { createPanelController } from '../panel/mount';
export { createSelectionChrome } from '../selection/chrome';
export { createResultHost } from '../consumer/result-host';
export { createHighlightOverlay } from '../highlight';
export { selectAt } from '../selection';
export { runActionInBackground } from '../action-client';

import { SEND_CSS } from '@/actions/send-to-agent/send-css';

/** Inject Send-to-Agent dialog styles into the shared menu shadow root when the chunk loads. */
export function ensureSendDialogStyles(shadow: ShadowRoot): void {
  if (shadow.querySelector('style[data-am-send]')) return;
  const style = document.createElement('style');
  style.dataset.amSend = 'true';
  style.textContent = SEND_CSS;
  shadow.appendChild(style);
}
