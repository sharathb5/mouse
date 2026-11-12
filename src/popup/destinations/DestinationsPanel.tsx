import { browser } from 'wxt/browser';
import { useEffect, useState } from 'react';
import {
  BackgroundResponseSchema,
  type AgentDestination,
  type BackgroundRequest,
  type TrustedRule,
} from '@/core/contracts';

async function send(request: BackgroundRequest) {
  const raw: unknown = await browser.runtime.sendMessage(request);
  return BackgroundResponseSchema.parse(raw);
}

export function DestinationsPanel() {
  const [destinations, setDestinations] = useState<AgentDestination[]>([]);
  const [trustedRules, setTrustedRules] = useState<TrustedRule[]>([]);
  const [cursorConfigured, setCursorConfigured] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      send({ type: 'agentic-mouse/list-destinations' }),
      send({ type: 'agentic-mouse/credentials-status' }),
    ])
      .then(([dest, creds]) => {
        if (!active) return;
        if (dest.type === 'destinations') {
          setDestinations(dest.destinations);
          setTrustedRules(dest.trustedRules);
        }
        if (creds.type === 'credentials-status') {
          setCursorConfigured(creds.cursorConfigured);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load destinations');
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveApiKey() {
    setError(null);
    setMessage(null);
    const response = await send({
      type: 'agentic-mouse/set-cursor-api-key',
      apiKey,
    });
    if (response.type === 'ok') {
      setApiKey('');
      setMessage('Cursor API key saved in extension storage (background only).');
      const creds = await send({ type: 'agentic-mouse/credentials-status' });
      if (creds.type === 'credentials-status') setCursorConfigured(creds.cursorConfigured);
      return;
    }
    setError(response.type === 'error' ? response.message : 'Failed to save key');
  }

  async function clearApiKey() {
    const response = await send({ type: 'agentic-mouse/clear-cursor-api-key' });
    if (response.type === 'ok') {
      setMessage('Cursor API key cleared.');
      setCursorConfigured(false);
      return;
    }
    setError(response.type === 'error' ? response.message : 'Failed to clear key');
  }

  async function setDefault(destinationId: string) {
    const next = destinations.map((destination) => ({
      ...destination,
      isDefault: destination.id === destinationId,
    }));
    const response = await send({
      type: 'agentic-mouse/save-destinations',
      destinations: next,
      trustedRules,
    });
    if (response.type === 'ok') {
      setDestinations(next);
      setMessage('Default destination set.');
      return;
    }
    setError(response.type === 'error' ? response.message : 'Failed to save destinations');
  }

  async function revokeRule(ruleId: string) {
    const next = trustedRules.map((rule) =>
      rule.id === ruleId ? { ...rule, revokedAt: new Date().toISOString() } : rule,
    );
    const response = await send({
      type: 'agentic-mouse/save-destinations',
      destinations,
      trustedRules: next,
    });
    if (response.type === 'ok') {
      setTrustedRules(next);
      setMessage('Trusted rule revoked.');
      return;
    }
    setError(response.type === 'error' ? response.message : 'Failed to revoke rule');
  }

  const activeRules = trustedRules.filter((rule) => rule.revokedAt === undefined);

  return (
    <div className="destinations" data-testid="destinations-panel">
      <section className="stack">
        <h2>Cursor API key</h2>
        <p className="muted">
          Stored only in extension storage and used by the background service worker. Never exposed
          to page scripts.
        </p>
        <p data-testid="cursor-key-status">
          Status: {cursorConfigured ? 'Configured' : 'Not configured'}
        </p>
        <label className="am-send-field">
          <span>API key</span>
          <input
            type="password"
            data-testid="cursor-api-key"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="cursor_…"
            autoComplete="off"
          />
        </label>
        <div className="row-actions">
          <button
            type="button"
            className="chip"
            data-testid="save-cursor-key"
            disabled={!apiKey.trim()}
            onClick={() => void saveApiKey()}
          >
            Save key
          </button>
          <button
            type="button"
            className="chip"
            data-testid="clear-cursor-key"
            disabled={!cursorConfigured}
            onClick={() => void clearApiKey()}
          >
            Clear key
          </button>
        </div>
      </section>

      <section className="stack">
        <h2>Destinations</h2>
        <ul className="pinned-list" data-testid="destination-list">
          {destinations.map((destination) => (
            <li key={destination.id} className="pinned-row">
              <span className="pinned-label">
                {destination.label}
                {destination.isDefault ? ' · default' : ''}
              </span>
              {!destination.isDefault && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => void setDefault(destination.id)}
                >
                  Make default
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="stack">
        <h2>Trusted site rules</h2>
        {activeRules.length === 0 ? (
          <p className="muted">No trusted rules yet.</p>
        ) : (
          <ul className="pinned-list" data-testid="trusted-rules">
            {activeRules.map((rule) => (
              <li key={rule.id} className="pinned-row">
                <span className="pinned-label">
                  {rule.originPattern} → {rule.destinationId}
                </span>
                <button type="button" className="chip" onClick={() => void revokeRule(rule.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && <p className="ok">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
