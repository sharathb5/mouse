import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import {
  createBackgroundMessageHandler,
  createTaskOrchestrator,
  TASK_POLL_ALARM,
} from '@/background/tasks';
import { OPEN_MENU_COMMAND, type ContentScriptMessage } from '@/core/contracts';
import { setActiveTaskBadge } from '@/platform/badge';
import { loadDestinationsConfig, saveDestinationsConfig } from '@/platform/destinations-store';
import { loadSettings, saveSettings } from '@/platform/settings-store';

const orchestrator = createTaskOrchestrator();

async function onInstalled(): Promise<void> {
  await saveSettings(await loadSettings());
  await saveDestinationsConfig(await loadDestinationsConfig());
  await setActiveTaskBadge(0);
  await orchestrator.start();
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

  browser.runtime.onStartup.addListener(() => {
    void orchestrator.start();
  });

  browser.runtime.onMessage.addListener(createBackgroundMessageHandler(orchestrator));

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TASK_POLL_ALARM) void orchestrator.pollActiveTasks();
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === OPEN_MENU_COMMAND && tab?.id !== undefined) void openMenuInTab(tab.id);
  });

  // Cold start: ensure polling + badge even when onInstalled already fired earlier.
  void orchestrator.start();
});
