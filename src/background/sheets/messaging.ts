import type { Browser } from 'wxt/browser';
import { browser } from 'wxt/browser';
import { SheetsBackgroundMessageSchema, type ActionResult } from '@/core/contracts';
import {
  loadGoogleSheetsCredentials,
  saveGoogleSheetsClientId,
} from '@/platform/google-sheets-credentials';
import { connectGoogleSheets, disconnectGoogleSheets } from './oauth';
import { exportTableToSheets, sheetsStatus } from './export';

function isExtensionPage(sender: Browser.runtime.MessageSender): boolean {
  const url = sender.url ?? '';
  return url.startsWith(`chrome-extension://${browser.runtime.id}/`);
}

export function createSheetsMessageHandler() {
  return (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ): boolean => {
    const parsed = SheetsBackgroundMessageSchema.safeParse(message);
    if (!parsed.success) return false;

    void (async () => {
      switch (parsed.data.type) {
        case 'agentic-mouse/sheets/status': {
          const status = await sheetsStatus();
          const creds = await loadGoogleSheetsCredentials();
          sendResponse({
            ok: true,
            configured: status.configured,
            clientIdConfigured: Boolean(creds.oauthClientId),
            ...(!status.configured ? { reason: status.reason } : {}),
          });
          break;
        }
        case 'agentic-mouse/sheets/set-client-id': {
          if (!isExtensionPage(sender)) {
            sendResponse({
              ok: false,
              reason: 'OAuth client ID can only be set from the extension popup.',
            });
            break;
          }
          await saveGoogleSheetsClientId(parsed.data.clientId);
          sendResponse({ ok: true });
          break;
        }
        case 'agentic-mouse/sheets/connect': {
          if (!isExtensionPage(sender)) {
            sendResponse({
              ok: false,
              reason: 'Google Sheets connect is only available from the extension popup.',
            });
            break;
          }
          sendResponse(await connectGoogleSheets());
          break;
        }
        case 'agentic-mouse/sheets/disconnect': {
          if (!isExtensionPage(sender)) {
            sendResponse({
              ok: false,
              reason: 'Google Sheets disconnect is only available from the extension popup.',
            });
            break;
          }
          await disconnectGoogleSheets();
          sendResponse({ ok: true });
          break;
        }
        case 'agentic-mouse/sheets/export': {
          const table: Extract<ActionResult, { kind: 'table' }> = {
            kind: 'table',
            columns: parsed.data.table.columns,
            rows: parsed.data.table.rows,
            sources: parsed.data.table.sources,
          };
          sendResponse(await exportTableToSheets(table));
          break;
        }
      }
    })();

    return true;
  };
}
