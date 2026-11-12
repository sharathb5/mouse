import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { SheetsStatusResponseSchema } from '@/core/contracts';

/**
 * Optional Google Sheets OAuth setup. Copy/CSV remain primary; this panel never
 * pretends Sheets works without a connected account.
 */
export function SheetsExportPanel() {
  const [clientId, setClientId] = useState('');
  const [configured, setConfigured] = useState(false);
  const [clientIdConfigured, setClientIdConfigured] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyStatus = useCallback((raw: unknown) => {
    const parsed = SheetsStatusResponseSchema.safeParse(raw);
    if (!parsed.success) return;
    setConfigured(parsed.data.configured);
    setClientIdConfigured(parsed.data.clientIdConfigured);
    setReason(parsed.data.reason ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    void browser.runtime
      .sendMessage({ type: 'agentic-mouse/sheets/status' })
      .then((raw: unknown) => {
        if (active) applyStatus(raw);
      });
    return () => {
      active = false;
    };
  }, [applyStatus]);

  const refresh = useCallback(async () => {
    const raw: unknown = await browser.runtime.sendMessage({
      type: 'agentic-mouse/sheets/status',
    });
    applyStatus(raw);
  }, [applyStatus]);

  const saveClientId = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await browser.runtime.sendMessage({
        type: 'agentic-mouse/sheets/set-client-id',
        clientId,
      });
      setClientId('');
      setMessage('OAuth client ID saved in extension storage (background only).');
      await refresh();
    } catch {
      setMessage('Could not save OAuth client ID.');
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const raw: unknown = await browser.runtime.sendMessage({
        type: 'agentic-mouse/sheets/connect',
      });
      if (raw && typeof raw === 'object' && 'ok' in raw && (raw as { ok: boolean }).ok) {
        setMessage('Google Sheets connected.');
      } else {
        const fail = raw as { reason?: string };
        setMessage(fail.reason ?? 'Google sign-in failed.');
      }
      await refresh();
    } catch {
      setMessage('Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await browser.runtime.sendMessage({ type: 'agentic-mouse/sheets/disconnect' });
      setMessage('Google Sheets disconnected. Copy/CSV remain available.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="behavior" data-testid="sheets-export-panel">
      <h2 className="section-title">Google Sheets export</h2>
      <p className="hint">
        Optional. Copy and CSV download stay primary. Sheets export needs a Google Cloud OAuth
        client ID (Chrome extension type) and a one-time sign-in via chrome.identity.
      </p>
      <p className="hint" data-testid="sheets-status">
        {configured
          ? 'Google Sheets connected — Export to Sheets is available on Extract results.'
          : `Google Sheets unavailable${reason ? ` — ${reason}` : '. Copy or download CSV instead.'}`}
      </p>
      <label className="field">
        <span className="section-title">OAuth client ID</span>
        <input
          type="text"
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          placeholder={clientIdConfigured ? '•••• configured' : 'xxx.apps.googleusercontent.com'}
          autoComplete="off"
          data-testid="sheets-client-id"
        />
      </label>
      <div className="shortcut-row">
        <button
          type="button"
          className="link-btn"
          disabled={busy || !clientId.trim()}
          onClick={() => void saveClientId()}
        >
          Save client ID
        </button>
        <button
          type="button"
          className="link-btn"
          disabled={busy || !clientIdConfigured}
          onClick={() => void connect()}
          data-testid="sheets-connect"
        >
          Connect Google
        </button>
        <button
          type="button"
          className="link-btn"
          disabled={busy || !configured}
          onClick={() => void disconnect()}
          data-testid="sheets-disconnect"
        >
          Disconnect
        </button>
      </div>
      {message ? (
        <p className="hint" data-testid="sheets-message" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
