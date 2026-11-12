# Agentic Mouse

**Right-click anything. Understand it, act on it, or delegate it.**

Agentic Mouse is a Chrome extension that turns right-click into a contextual action interface.
Normal right-click keeps Chrome's menu; **Shift + right-click** opens Agentic Mouse.

> Status: bootstrap. The menu, popup toggle, pinned-action customization, and persisted
> settings work. Actions are placeholders marked **Soon** and do not run yet. See
> [docs/PRD.md](docs/PRD.md) for the locked V1 scope and status.

## Quick start

Requirements: Node 22+, pnpm 10 (`corepack enable`), Chrome or Chromium.

```bash
pnpm install
pnpm build          # → .output/chrome-mv3
```

### Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose `.output/chrome-mv3` in this repo.
4. Pin **Agentic Mouse** from the puzzle-piece menu so the toolbar toggle is visible.
5. Reload any tabs that were already open (content scripts only inject into new page loads).

For development with hot reload, run `pnpm dev` and load `.output/chrome-mv3-dev` instead.

## Using it

| Do this                       | Result                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| Right-click                   | Chrome's normal menu (unchanged)                              |
| Shift + right-click           | Agentic Mouse menu near the cursor                            |
| Escape, click outside, scroll | Closes the menu                                               |
| Arrow keys / Home / End       | Move between menu items                                       |
| `Alt+Shift+M`                 | Fallback shortcut (change at `chrome://extensions/shortcuts`) |
| Toolbar icon → toggle         | Enable/disable instantly, no reload                           |
| Toolbar icon → **Menu**       | Add, remove, reorder, reset pinned actions                    |
| Toolbar icon → **Settings**   | Reverse the gesture (right-click opens Agentic Mouse)         |

Agentic Mouse runs on regular `http`/`https` pages. Chrome blocks extensions on `chrome://`
pages, the Chrome Web Store, and other extension pages; the popup explains this when you open
it there.

## Development

```bash
pnpm dev                 # WXT dev server + HMR
pnpm lint                # ESLint (type-aware)
pnpm format              # Prettier write (format:check in CI)
pnpm typecheck           # tsc --noEmit
pnpm test                # Vitest unit tests
pnpm exec playwright install chromium   # once
pnpm build && pnpm test:e2e             # Playwright against the built extension
pnpm verify              # all of the above
```

See [AGENTS.md](AGENTS.md) for repository rules and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the design.

## Testing

- **Unit (Vitest):** contracts, action registry, pinned-action operations, positioning math,
  gesture decisions, the menu component, and storage/tab-status logic. Browser APIs are
  **mocked** with WXT's `fakeBrowser`.
- **Integration (Playwright):** loads the built extension into Playwright's Chromium and checks
  real behavior: Shift + right-click interception, normal right-click passthrough, Escape and
  outside-click dismissal, viewport clamping, style isolation on a hostile-CSS page, selection
  preservation, popup toggle, reversed mode, pinned-action customization, persistence across a
  browser restart, and unsupported pages.

### What Playwright cannot validate (manual checks)

Playwright cannot render or inspect Chrome's **native** context menu, press real
`chrome.commands` shortcuts, or open the Chrome Web Store as a normal page. Before releases,
check in real Chrome:

1. Right-click on a page shows Chrome's native menu; Shift + right-click shows only Agentic
   Mouse (no native menu behind it). Check text, links, images, and inputs.
2. In reversed mode, right-click shows Agentic Mouse and Shift + right-click shows Chrome's menu.
3. `Alt+Shift+M` (or your custom binding) opens the menu at the selection or viewport center.
4. Toggle off in the popup → Shift + right-click immediately shows Chrome's menu on open tabs.
5. Reload the extension at `chrome://extensions` → settings are unchanged; open tabs show
   "Reload this page" in the popup until refreshed.
6. On `chrome://settings` and the Chrome Web Store, nothing breaks and the popup explains why.
7. macOS: Ctrl + click behaves like right-click; confirm Shift + Ctrl + click opens Agentic Mouse.

## Project layout

```
src/core/         Contracts, action catalog/registry, pure logic (no browser/UI deps)
src/platform/     browser.* adapters (storage, tabs, badge)
src/content/      Content script: gesture handling, positioning, Shadow DOM menu
src/popup/        Toolbar popup UI
src/entrypoints/  WXT entrypoints
tests/e2e/        Playwright specs and fixture pages
docs/             PRD, architecture, implementation plan
```

A future Go task service and shared packages are planned; see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#future-direction).
