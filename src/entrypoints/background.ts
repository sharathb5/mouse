import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';
import { registerActionRunPort } from '@/background/action-runner';
import { createUnifiedBackgroundHandler } from '@/background/message-router';
import { createTaskOrchestrator, TASK_POLL_ALARM } from '@/background/tasks';
import { startTrackingService } from '@/background/tracking';
import { DEFAULT_SETTINGS, OPEN_MENU_COMMAND, type ContentScriptMessage } from '@/core/contracts';
import { setActiveTaskBadge } from '@/platform/badge';
import { loadDestinationsConfig, saveDestinationsConfig } from '@/platform/destinations-store';
import { loadSettings, saveSettings } from '@/platform/settings-store';

const orchestrator = createTaskOrchestrator();
// Share B's TaskStore so Track monitoring and agent handoffs hit the same inbox.
const tracking = startTrackingService({ tasks: orchestrator.store });

async function onInstalled(): Promise<void> {
  // Only seed defaults when nothing is stored. A blind load→save race can overwrite
  // settings written by the popup or tests during first install.
  const existing = await storage.getItem('local:settings');
  if (existing == null) {
    await saveSettings(DEFAULT_SETTINGS);
  } else {
    await saveSettings(await loadSettings());
  }
  await saveDestinationsConfig(await loadDestinationsConfig());
  await setActiveTaskBadge(0);
  await orchestrator.start();
}

async function openMenuInTab(tabId: number): Promise<void> {
  const message: ContentScriptMessage = { type: 'agentic-mouse/open-menu', source: 'shortcut' };
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
    // No content script on this tab.
  }
}

export default defineBackground(() => {
  registerActionRunPort();

  browser.runtime.onInstalled.addListener(() => {
    void onInstalled();
  });

  browser.runtime.onStartup.addListener(() => {
    void orchestrator.start();
  });

  browser.runtime.onMessage.addListener(createUnifiedBackgroundHandler({ orchestrator, tracking }));

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TASK_POLL_ALARM) void orchestrator.pollActiveTasks();
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === OPEN_MENU_COMMAND && tab?.id !== undefined) void openMenuInTab(tab.id);
  });

  // Cold start: ensure polling + badge even when onInstalled already fired earlier.
  void orchestrator.start();
});
