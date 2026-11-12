import { browser, type Browser } from 'wxt/browser';
import {
  BackgroundRequestSchema,
  ensureSingleDefault,
  type BackgroundRequest,
  type BackgroundResponse,
  type DestinationsConfig,
} from '@/core/contracts';
import {
  clearCursorApiKey,
  isCursorConfigured,
  setCursorApiKey,
} from '@/platform/credentials-store';
import { loadDestinationsConfig, saveDestinationsConfig } from '@/platform/destinations-store';
import { CURSOR_API_ORIGIN_PATTERN } from '../destinations';
import type { TrackingService } from '../tracking';
import type { TaskOrchestrator } from './orchestrator';

function isExtensionPage(sender: Browser.runtime.MessageSender): boolean {
  const url = sender.url ?? '';
  return url.startsWith(`chrome-extension://${browser.runtime.id}/`);
}

async function ensureCursorHostPermission(): Promise<boolean> {
  try {
    const already = await browser.permissions.contains({ origins: [CURSOR_API_ORIGIN_PATTERN] });
    if (already) return true;
    return await browser.permissions.request({ origins: [CURSOR_API_ORIGIN_PATTERN] });
  } catch {
    return false;
  }
}

export interface BackgroundMessageHandlerOptions {
  /** When set, Track inbox commands pause/resume/cancel the TrackerStore too. */
  tracking?: TrackingService;
}

export function createBackgroundMessageHandler(
  orchestrator: TaskOrchestrator,
  options: BackgroundMessageHandlerOptions = {},
) {
  return (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void,
  ): boolean => {
    const parsed = BackgroundRequestSchema.safeParse(message);
    if (!parsed.success) return false;

    void handle(parsed.data, sender, orchestrator, options.tracking)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          type: 'error',
          code: 'internal',
          message: error instanceof Error ? error.message : 'Internal error',
        });
      });
    return true;
  };
}

async function handle(
  request: BackgroundRequest,
  sender: Browser.runtime.MessageSender,
  orchestrator: TaskOrchestrator,
  tracking: TrackingService | undefined,
): Promise<BackgroundResponse> {
  switch (request.type) {
    case 'agentic-mouse/list-destinations': {
      const config = await loadDestinationsConfig();
      return {
        type: 'destinations',
        destinations: config.destinations,
        savedActions: config.savedActions,
        trustedRules: config.trustedRules,
      };
    }
    case 'agentic-mouse/list-tasks':
      return { type: 'tasks', tasks: await orchestrator.store.list() };
    case 'agentic-mouse/credentials-status':
      return { type: 'credentials-status', cursorConfigured: await isCursorConfigured() };
    case 'agentic-mouse/set-cursor-api-key': {
      if (!isExtensionPage(sender)) {
        return {
          type: 'error',
          code: 'permission-denied',
          message: 'API keys can only be set from the extension popup',
        };
      }
      const granted = await ensureCursorHostPermission();
      if (!granted) {
        return {
          type: 'error',
          code: 'permission-denied',
          message: 'Permission to contact api.cursor.com was not granted',
        };
      }
      await setCursorApiKey(request.apiKey);
      return { type: 'ok' };
    }
    case 'agentic-mouse/clear-cursor-api-key': {
      if (!isExtensionPage(sender)) {
        return {
          type: 'error',
          code: 'permission-denied',
          message: 'API keys can only be cleared from the extension popup',
        };
      }
      await clearCursorApiKey();
      return { type: 'ok' };
    }
    case 'agentic-mouse/save-destinations': {
      if (!isExtensionPage(sender)) {
        return {
          type: 'error',
          code: 'permission-denied',
          message: 'Destination settings can only be saved from the extension popup',
        };
      }
      const current = await loadDestinationsConfig();
      const next: DestinationsConfig = ensureSingleDefault({
        version: 1,
        destinations: request.destinations,
        savedActions: request.savedActions ?? current.savedActions,
        trustedRules: request.trustedRules ?? current.trustedRules,
      });
      await saveDestinationsConfig(next);
      return { type: 'ok' };
    }
    case 'agentic-mouse/create-agent-task': {
      try {
        const created = await orchestrator.createAgentTask({
          destinationId: request.destinationId,
          input: request.input,
          approval: request.approval,
          ...(request.title ? { title: request.title } : {}),
        });
        return {
          type: 'task-created',
          taskId: created.taskId,
          ...(created.externalUrl ? { externalUrl: created.externalUrl } : {}),
        };
      } catch (error) {
        return mapCreateError(error);
      }
    }
    case 'agentic-mouse/handoff': {
      try {
        const result = await orchestrator.handoff({
          destinationId: request.destinationId,
          input: request.input,
        });
        return { type: 'handoff-result', result };
      } catch (error) {
        return {
          type: 'error',
          code: 'internal',
          message: error instanceof Error ? error.message : 'Handoff failed',
        };
      }
    }
    case 'agentic-mouse/task-command': {
      const task = await orchestrator.store.get(request.taskId);
      const isTrack = task?.request.input.actionId === 'track';

      if (
        isTrack &&
        tracking &&
        request.command !== 'open-result' &&
        request.command !== 'dismiss'
      ) {
        const trackers = await tracking.trackers.list();
        const tracker = trackers.find((item) => item.taskId === request.taskId);
        if (tracker) {
          if (request.command === 'pause') {
            await tracking.handleMessage({
              type: 'agentic-mouse/track/pause',
              trackerId: tracker.id,
            });
          } else if (request.command === 'resume') {
            await tracking.handleMessage({
              type: 'agentic-mouse/track/resume',
              trackerId: tracker.id,
            });
          } else {
            await tracking.handleMessage({
              type: 'agentic-mouse/track/cancel',
              trackerId: tracker.id,
            });
          }
          return { type: 'ok' };
        }
      }

      switch (request.command) {
        case 'cancel':
          await orchestrator.cancel(request.taskId);
          break;
        case 'pause':
          await orchestrator.pause(request.taskId);
          break;
        case 'resume':
          await orchestrator.resume(request.taskId);
          break;
        case 'dismiss':
          if (isTrack && tracking) {
            const trackers = await tracking.trackers.list();
            const tracker = trackers.find((item) => item.taskId === request.taskId);
            if (tracker) {
              await tracking.handleMessage({
                type: 'agentic-mouse/track/cancel',
                trackerId: tracker.id,
              });
            }
          }
          await orchestrator.dismiss(request.taskId);
          break;
        case 'open-result': {
          if (task?.request.input.actionId === 'track') {
            await browser.tabs.create({
              url: task.request.input.context.source.url,
              active: true,
            });
          } else if (task?.external?.url) {
            await browser.tabs.create({ url: task.external.url, active: true });
          }
          break;
        }
      }
      return { type: 'ok' };
    }
  }
}

function mapCreateError(error: unknown): BackgroundResponse {
  if (error instanceof Error) {
    if (/not configured|API key/i.test(error.message)) {
      return { type: 'error', code: 'not-configured', message: error.message };
    }
    if (/sensitive/i.test(error.message)) {
      return { type: 'error', code: 'permission-denied', message: error.message };
    }
  }
  return {
    type: 'error',
    code: 'provider',
    message: error instanceof Error ? error.message : 'Failed to create task',
  };
}
