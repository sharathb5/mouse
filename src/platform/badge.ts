import { browser } from 'wxt/browser';

/** Badge text for the active task count; empty when there is nothing to show. */
export function formatBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count > 99 ? '99+' : String(Math.floor(count));
}

export async function setActiveTaskBadge(count: number): Promise<void> {
  await browser.action.setBadgeBackgroundColor({ color: '#B98A00' });
  await browser.action.setBadgeText({ text: formatBadgeCount(count) });
}
