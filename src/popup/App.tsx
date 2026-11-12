import { useState } from 'react';
import type { Settings } from '@/core/contracts';
import { BehaviorPanel } from './components/BehaviorPanel';
import { EnabledToggle } from './components/EnabledToggle';
import { InboxPanel } from './components/InboxPanel';
import { ModelProviderPanel } from './components/ModelProviderPanel';
import { PinnedActionsPanel } from './components/PinnedActionsPanel';
import { TabStatusBanner } from './components/TabStatusBanner';
import { DestinationsPanel } from './destinations/DestinationsPanel';
import { useSettings, useTabStatus } from './hooks';

const TABS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'menu', label: 'Menu' },
  { id: 'agents', label: 'Agents' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function App() {
  const { settings, update, error } = useSettings();
  const tabStatus = useTabStatus();
  const [tab, setTab] = useState<TabId>('inbox');

  return (
    <main className="popup">
      <header className="popup-header">
        <div className="brand">
          <svg
            className="brand-glyph"
            viewBox="0 0 16 16"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path d="M3 1.5v11.2l3-2.9 2 4.7 2-.9-2-4.6h4.2z" fill="currentColor" />
          </svg>
          <div>
            <h1>Agentic Mouse</h1>
            <p className="subtitle" data-testid="popup-subtitle">
              {settings ? describeTrigger(settings) : 'Loading…'}
            </p>
          </div>
        </div>
        {settings && (
          <EnabledToggle
            enabled={settings.enabled}
            onChange={(enabled) => void update((current) => ({ ...current, enabled }))}
          />
        )}
      </header>

      <TabStatusBanner status={tabStatus} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className="tab"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'inbox' && <InboxPanel />}
        {tab === 'menu' && settings && (
          <PinnedActionsPanel
            pinned={settings.pinnedActionIds}
            onChange={(pinnedActionIds) =>
              void update((current) => ({ ...current, pinnedActionIds }))
            }
          />
        )}
        {tab === 'agents' && <DestinationsPanel />}
        {tab === 'settings' && settings && (
          <>
            <BehaviorPanel
              triggerMode={settings.triggerMode}
              onTriggerModeChange={(triggerMode) =>
                void update((current) => ({ ...current, triggerMode }))
              }
            />
            <ModelProviderPanel
              model={settings.model}
              onModelChange={(model) => void update((current) => ({ ...current, model }))}
            />
          </>
        )}
      </section>
    </main>
  );
}

function describeTrigger(settings: Settings): string {
  if (!settings.enabled) return 'Off. Right-click works normally.';
  return settings.triggerMode === 'shift-right-click'
    ? 'Shift + right-click to open'
    : 'Right-click to open (Shift + right-click for Chrome menu)';
}
