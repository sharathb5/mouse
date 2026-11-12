import { browser } from 'wxt/browser';
import { PingResponseSchema, type ContentScriptMessage } from '@/core/contracts';
import { classifyPageSupport, describeUnsupportedReason } from '@/core/page-support';

export type TabStatus =
  { state: 'active' } | { state: 'needs-reload' } | { state: 'unsupported'; message: string };

/**
 * Reports whether Agentic Mouse is live in a tab by pinging its content script. Pass a
 * `tabId` to inspect a specific tab; otherwise the active tab of the current window.
 */
export async function getTabStatus(tabId?: number): Promise<TabStatus> {
  const tab =
    tabId === undefined
      ? (await browser.tabs.query({ active: true, currentWindow: true }))[0]
      : await browser.tabs.get(tabId).catch(() => undefined);
  if (tab?.id === undefined) {
    return { state: 'unsupported', message: describeUnsupportedReason('unknown') };
  }

  const support = classifyPageSupport(tab.url);
  if (!support.supported && support.reason !== 'unknown') {
    return { state: 'unsupported', message: describeUnsupportedReason(support.reason) };
  }

  const ping: ContentScriptMessage = { type: 'agentic-mouse/ping' };
  try {
    PingResponseSchema.parse(await browser.tabs.sendMessage(tab.id, ping));
    return { state: 'active' };
  } catch {
    // A supported URL without a content script was open before install/update.
    return support.supported
      ? { state: 'needs-reload' }
      : { state: 'unsupported', message: describeUnsupportedReason('unknown') };
  }
}
