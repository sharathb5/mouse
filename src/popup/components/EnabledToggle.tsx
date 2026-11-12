export function EnabledToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Enable Agentic Mouse"
      data-testid="enabled-toggle"
      className="switch"
      onClick={() => onChange(!enabled)}
    >
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  );
}
