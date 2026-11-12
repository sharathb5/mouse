import { browser, type Browser } from 'wxt/browser';
import { OPENROUTER_HOST_PERMISSION } from '@/background/model';
import { createBackgroundMessageHandler, type TaskOrchestrator } from '@/background/tasks';
import type { TrackingService } from '@/background/tracking';
import {
  BackgroundRequestSchema,
  ModelBackgroundMessageSchema,
  TrackBackgroundMessageSchema,
  type ModelProviderSettings,
} from '@/core/contracts';
import { hasModelApiKey, saveModelApiKey, clearModelApiKey } from '@/platform/model-secrets';
import { loadSettings } from '@/platform/settings-store';

async function modelSettingsResponse(): Promise<ModelProviderSettings> {
  const settings = await loadSettings();
  const apiKeyConfigured = settings.model.providerId === 'mock' ? true : await hasModelApiKey();
  return {
    providerId: settings.model.providerId,
    modelId: settings.model.modelId,
    apiKeyConfigured,
  };
}

/**
 * Single `runtime.onMessage` listener for agent tasks, model settings, and Track.
 * Replaces the three parallel listeners left after merging workstreams A/B/C.
 */
export function createUnifiedBackgroundHandler(deps: {
  orchestrator: TaskOrchestrator;
  tracking: TrackingService;
}): (
  message: unknown,
  sender: Browser.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean {
  const taskHandler = createBackgroundMessageHandler(deps.orchestrator, {
    tracking: deps.tracking,
  });

  return (message, sender, sendResponse) => {
    if (BackgroundRequestSchema.safeParse(message).success) {
      return taskHandler(message, sender, sendResponse);
    }

    const model = ModelBackgroundMessageSchema.safeParse(message);
    if (model.success) {
      void (async () => {
        switch (model.data.type) {
          case 'agentic-mouse/model-settings':
            sendResponse({ ok: true, settings: await modelSettingsResponse() });
            break;
          case 'agentic-mouse/set-model-api-key':
            await saveModelApiKey(model.data.apiKey);
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
    }

    const track = TrackBackgroundMessageSchema.safeParse(message);
    if (track.success) {
      void deps.tracking
        .handleMessage(track.data, sender.tab?.id)
        .then(sendResponse)
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            reason: error instanceof Error ? error.message : 'Track request failed',
          });
        });
      return true;
    }

    return false;
  };
}
