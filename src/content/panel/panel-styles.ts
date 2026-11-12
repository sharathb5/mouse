/** Inlined so the panel Shadow DOM works outside WXT's createShadowRootUi CSS pipeline. */
export const PANEL_CSS = `
.am-panel {
  --am-bg: #ffffff;
  --am-fg: #1c1b19;
  --am-muted: #6b6760;
  --am-border: rgba(28, 27, 25, 0.12);
  --am-accent: #f2b705;
  --am-danger: #9b1c1c;
  --am-surface: #f7f6f2;

  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  width: min(360px, calc(100vw - 24px));
  max-height: min(420px, calc(100vh - 24px));
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  background: var(--am-bg);
  color: var(--am-fg);
  border: 1px solid var(--am-border);
  border-radius: 12px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.18),
    0 2px 8px rgba(0, 0, 0, 0.08);
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  pointer-events: auto;
}

.am-panel *,
.am-panel *::before,
.am-panel *::after {
  box-sizing: border-box;
}

.am-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--am-border);
  background: var(--am-surface);
}

.am-panel-title {
  font-weight: 600;
  font-size: 13px;
}

.am-panel-meta {
  color: var(--am-muted);
  font-size: 11px;
}

.am-panel-close {
  border: none;
  background: transparent;
  color: var(--am-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 6px;
}

.am-panel-close:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--am-fg);
}

.am-panel-body {
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 72px;
  flex: 1;
}

.am-panel-body[data-status='streaming']::after {
  content: '▍';
  display: inline-block;
  margin-left: 2px;
  animation: am-caret 1s steps(1) infinite;
  color: var(--am-accent);
}

@keyframes am-caret {
  50% {
    opacity: 0;
  }
}

.am-panel-error {
  color: var(--am-danger);
  padding: 12px;
}

.am-panel-footer {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--am-border);
  background: var(--am-surface);
}

.am-panel-footer input {
  flex: 1;
  border: 1px solid var(--am-border);
  border-radius: 8px;
  padding: 6px 8px;
  font: inherit;
  background: var(--am-bg);
  color: var(--am-fg);
}

.am-panel-footer button {
  border: none;
  border-radius: 8px;
  padding: 6px 10px;
  background: var(--am-accent);
  color: #1c1b19;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.am-panel-footer button:disabled {
  opacity: 0.5;
  cursor: default;
}

.am-panel-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #fff3bf;
  color: #7a5b00;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
`;
