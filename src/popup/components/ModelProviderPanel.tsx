import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import {
  DEFAULT_OPENROUTER_MODEL,
  ModelSettingsResponseSchema,
  SetApiKeyResponseSchema,
  type ModelPreferences,
  type ModelProviderId,
  type ModelProviderSettings,
  type Settings,
} from '@/core/contracts';

const PROVIDERS: { id: ModelProviderId; label: string; detail: string }[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    detail: 'Real chat/completions API. Key stays in extension storage.',
  },
  {
    id: 'mock',
    label: 'Mock (dev)',
    detail: 'Deterministic offline responses. Clearly labeled as a mock — not a real model.',
  },
];

export function ModelProviderPanel({
  model,
  onModelChange,
}: {
  model: ModelPreferences;
  onModelChange: (model: Settings['model']) => void;
}) {
  const [status, setStatus] = useState<ModelProviderSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const raw: unknown = await browser.runtime.sendMessage({
      type: 'agentic-mouse/model-settings',
    });
    const parsed = ModelSettingsResponseSchema.safeParse(raw);
    if (parsed.success) setStatus(parsed.data.settings);
  }, []);

  useEffect(() => {
    let active = true;
    void browser.runtime
      .sendMessage({ type: 'agentic-mouse/model-settings' })
      .then((raw: unknown) => {
        const parsed = ModelSettingsResponseSchema.safeParse(raw);
        if (active && parsed.success) setStatus(parsed.data.settings);
      });
    return () => {
      active = false;
    };
  }, [model.providerId, model.modelId]);

  const saveKey = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (model.providerId === 'openrouter') {
        const permission: unknown = await browser.runtime.sendMessage({
          type: 'agentic-mouse/request-openrouter-permission',
        });
        if (
          permission &&
          typeof permission === 'object' &&
          'granted' in permission &&
          !(permission as { granted: boolean }).granted
        ) {
          setMessage('OpenRouter host permission was not granted.');
          setBusy(false);
          return;
        }
      }
      const raw: unknown = await browser.runtime.sendMessage({
        type: 'agentic-mouse/set-model-api-key',
        apiKey,
      });
      const parsed = SetApiKeyResponseSchema.safeParse(raw);
      if (parsed.success) {
        setStatus(parsed.data.settings);
        setApiKey('');
        setMessage('API key saved in extension storage (background only).');
      }
    } catch {
      setMessage('Could not save API key.');
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    setBusy(true);
    try {
      const raw: unknown = await browser.runtime.sendMessage({
        type: 'agentic-mouse/clear-model-api-key',
      });
      const parsed = SetApiKeyResponseSchema.safeParse(raw);
      if (parsed.success) {
        setStatus(parsed.data.settings);
        setMessage('API key cleared.');
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="behavior" data-testid="model-provider-panel">
      <h2 className="section-title">Inline AI provider</h2>
      <fieldset className="radio-group">
        <legend className="section-title">Provider</legend>
        {PROVIDERS.map((provider) => (
          <label key={provider.id} className="radio">
            <input
              type="radio"
              name="model-provider"
              value={provider.id}
              checked={model.providerId === provider.id}
              onChange={() =>
                onModelChange({
                  ...model,
                  providerId: provider.id,
                  modelId:
                    provider.id === 'mock'
                      ? 'mock-deterministic'
                      : model.modelId === 'mock-deterministic'
                        ? DEFAULT_OPENROUTER_MODEL
                        : model.modelId,
                })
              }
            />
            <span>
              <strong>{provider.label}</strong>
              <span className="radio-detail">{provider.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {model.providerId === 'openrouter' && (
        <>
          <label className="field">
            <span className="section-title">Model</span>
            <input
              type="text"
              data-testid="model-id-input"
              value={model.modelId}
              onChange={(event) => onModelChange({ ...model, modelId: event.target.value })}
              placeholder={DEFAULT_OPENROUTER_MODEL}
            />
          </label>
          <label className="field">
            <span className="section-title">OpenRouter API key</span>
            <input
              type="password"
              data-testid="model-api-key-input"
              value={apiKey}
              autoComplete="off"
              placeholder={status?.apiKeyConfigured ? '•••••••• (saved)' : 'sk-or-…'}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </label>
          <div className="shortcut-row">
            <button
              type="button"
              className="link-btn"
              data-testid="save-model-api-key"
              disabled={busy || !apiKey.trim()}
              onClick={() => void saveKey()}
            >
              Save key
            </button>
            <button
              type="button"
              className="link-btn"
              data-testid="clear-model-api-key"
              disabled={busy || !status?.apiKeyConfigured}
              onClick={() => void clearKey()}
            >
              Clear key
            </button>
          </div>
        </>
      )}

      <p className="hint" data-testid="model-config-status">
        {model.providerId === 'mock'
          ? 'Using the mock provider. Responses are labeled Mock and are not from a real model.'
          : status?.apiKeyConfigured
            ? `OpenRouter configured · model ${model.modelId}`
            : 'OpenRouter is not configured. Explain This will say so instead of inventing an answer.'}
      </p>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
      <p className="hint">
        Page content is sent to the provider only when you invoke an inline AI action. The API key
        never enters page scripts.
      </p>
    </div>
  );
}
