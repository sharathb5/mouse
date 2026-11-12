import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { OPEN_MENU_COMMAND, type ContentScriptMessage } from '@/core/contracts';
import { setActiveTaskBadge } from '@/platform/badge';
import { loadSettings, saveSettings } from '@/platform/settings-store';

async function onInstalled(): Promise<void> {
  // Persist normalized settings so every surface reads the same explicit state.
  await saveSettings(await loadSettings());
  // No task backend yet (Workstream B); the badge stays empty rather than faking counts.
  await setActiveTaskBadge(0);
}

async function openMenuInTab(tabId: number): Promise<void> {
  const message: ContentScriptMessage = { type: 'agentic-mouse/open-menu', source: 'shortcut' };
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
    // No content script on this tab (browser pages, Web Store, or not reloaded since
    // install). Doing nothing is the graceful fallback; the popup explains why.
  }
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void onInstalled();
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === OPEN_MENU_COMMAND && tab?.id !== undefined) void openMenuInTab(tab.id);
  });
});
