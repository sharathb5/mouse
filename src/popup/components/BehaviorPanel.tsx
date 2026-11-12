import { browser } from 'wxt/browser';
import type { TriggerMode } from '@/core/contracts';
import { useFallbackShortcut } from '../hooks';

const TRIGGER_OPTIONS: { value: TriggerMode; title: string; detail: string }[] = [
  {
    value: 'shift-right-click',
    title: 'Shift + right-click',
    detail: 'Right-click keeps Chrome’s menu.',
  },
  {
    value: 'right-click',
    title: 'Right-click',
    detail: 'Shift + right-click opens Chrome’s menu.',
  },
];

export function BehaviorPanel({
  triggerMode,
  onTriggerModeChange,
}: {
  triggerMode: TriggerMode;
  onTriggerModeChange: (mode: TriggerMode) => void;
}) {
  const shortcut = useFallbackShortcut();

  return (
    <div className="behavior">
      <fieldset className="radio-group">
        <legend className="section-title">Open Agentic Mouse with</legend>
        {TRIGGER_OPTIONS.map((option) => (
          <label key={option.value} className="radio">
            <input
              type="radio"
              name="trigger-mode"
              value={option.value}
              checked={triggerMode === option.value}
              onChange={() => onTriggerModeChange(option.value)}
            />
            <span>
              <strong>{option.title}</strong>
              <span className="radio-detail">{option.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <h2 className="section-title">Fallback shortcut</h2>
      <div className="shortcut-row">
        <span data-testid="fallback-shortcut">
          {shortcut === null ? '…' : shortcut ? <kbd>{shortcut}</kbd> : 'Not set'}
        </span>
        <button
          type="button"
          className="link-btn"
          onClick={() => void browser.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Change
        </button>
      </div>
      <p className="hint">Use it where Shift + right-click is unavailable.</p>

      <h2 className="section-title">Privacy</h2>
      <p className="hint">
        Selection and classification stay on-device. Inline AI actions send the selected page
        content to the configured provider only when you invoke them. API keys never enter page
        scripts.
      </p>
    </div>
  );
}
