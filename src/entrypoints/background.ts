import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';
import { registerActionRunPort } from '@/background/action-runner';
import { OPENROUTER_HOST_PERMISSION } from '@/background/model';
import {
  createBackgroundMessageHandler,
  createTaskOrchestrator,
  TASK_POLL_ALARM,
} from '@/background/tasks';
import {
  BackgroundMessageSchema,
  DEFAULT_SETTINGS,
  OPEN_MENU_COMMAND,
  type ContentScriptMessage,
  type ModelProviderSettings,
} from '@/core/contracts';
import { setActiveTaskBadge } from '@/platform/badge';
import { loadDestinationsConfig, saveDestinationsConfig } from '@/platform/destinations-store';
import { clearModelApiKey, hasModelApiKey, saveModelApiKey } from '@/platform/model-secrets';
import { loadSettings, saveSettings } from '@/platform/settings-store';

const orchestrator = createTaskOrchestrator();

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

async function modelSettingsResponse(): Promise<ModelProviderSettings> {
  const settings = await loadSettings();
  const apiKeyConfigured = settings.model.providerId === 'mock' ? true : await hasModelApiKey();
  return {
    providerId: settings.model.providerId,
    modelId: settings.model.modelId,
    apiKeyConfigured,
  };
}

export default defineBackground(() => {
  registerActionRunPort();

  browser.runtime.onInstalled.addListener(() => {
    void onInstalled();
  });

  browser.runtime.onStartup.addListener(() => {
    void orchestrator.start();
  });

  browser.runtime.onMessage.addListener(createBackgroundMessageHandler(orchestrator));

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const parsed = BackgroundMessageSchema.safeParse(message);
    if (!parsed.success) return undefined;

    void (async () => {
      switch (parsed.data.type) {
        case 'agentic-mouse/model-settings':
          sendResponse({ ok: true, settings: await modelSettingsResponse() });
          break;
        case 'agentic-mouse/set-model-api-key':
          await saveModelApiKey(parsed.data.apiKey);
          sendResponse({ ok: true, settings: await modelSettingsResponse() });
          break;
        case 'agentic-mouse/clear-model-api-key':
          await clearModelApiKey();
          sendResponse({ ok: true, settings: await modelSettingsResponse() });
          break;
        case 'agentic-mouse/request-openrouter-permission': {
          const granted = await browser.permissions.request({
            origins: [OPENROUTER_HOST_PERMISSION],
          });
          sendResponse({ ok: true, granted });
          break;
        }
      }
    })();

    return true;
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TASK_POLL_ALARM) void orchestrator.pollActiveTasks();
  });

  browser.commands.onCommand.addListener((command, tab) => {
    if (command === OPEN_MENU_COMMAND && tab?.id !== undefined) void openMenuInTab(tab.id);
  });

  // Cold start: ensure polling + badge even when onInstalled already fired earlier.
  void orchestrator.start();
});
