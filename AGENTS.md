# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## Product in one line

Agentic Mouse is a Chrome MV3 extension: **right-click anything — understand it, act on it,
or delegate it.** Shift + right-click opens a custom menu; normal right-click stays native.
Locked scope: [docs/PRD.md](docs/PRD.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Workstreams and ownership: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Setup and commands

Requires Node 22+ and pnpm 10 (`corepack enable`).

```bash
pnpm install                                # also runs `wxt prepare` (generates .wxt/)
pnpm dev                                    # WXT dev build with HMR → .output/chrome-mv3-dev
pnpm build                                  # production build → .output/chrome-mv3
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test                                   # Vitest unit tests (browser APIs mocked)
pnpm exec playwright install chromium       # once per machine
pnpm test:e2e                               # Playwright, real Chromium + built extension (run `pnpm build` first)
pnpm verify                                 # everything above, in CI order
HEADED=1 pnpm test:e2e                      # watch the e2e run (needs a display)
```

## Repository map

```
src/core/          Contracts (Zod), action catalog + registry, pure logic. NO react/wxt/browser imports.
src/platform/      browser.* adapters: settings storage, tab status, badge.
src/content/       Content script runtime: gesture decision, positioning, Shadow DOM menu.
src/popup/         Popup React UI (toggle, inbox placeholder, pinned actions, behavior settings).
src/entrypoints/   WXT entrypoints (background, content, popup). Keep them thin.
tests/e2e/         Playwright specs + fixture pages served on http://127.0.0.1:4321.
docs/              PRD, architecture, implementation plan.
```

## Rules

1. **Contracts first.** Every cross-module shape lives in `src/core/contracts` as a Zod schema
   with an inferred type. Use discriminated unions. Follow the contract change protocol in
   `docs/IMPLEMENTATION_PLAN.md`; contract files are shared — coordinate before editing.
2. **Keep the gesture path fast.** Nothing async, networked, LLM-backed, or DOM-wide between
   the `contextmenu` event and the menu render. Fail open to the native menu.
3. **Never fake success.** Unavailable actions say so ("coming soon"). A prefilled chatbot link
   is never a running task. Mocked tests are labeled mocked; never report unexecuted tests or
   unverified integrations as passing.
4. **Webpage content is untrusted.** Delimit it in prompts; it can never change the chosen
   action, destination, or approval. Credentials stay in the background service worker.
5. **Minimal permissions.** New permissions need a justification in the PR and in
   `docs/ARCHITECTURE.md`.
6. **Use `browser` from `wxt/browser`,** not the `chrome` global (ESLint enforces this in
   `src/`). Explicit imports only; WXT auto-imports are disabled.
7. **Don't modify the page.** Render extension UI in Shadow DOM; don't mutate page DOM, styles,
   or selection.
8. **Test observable behavior.** User-visible behavior needs a Playwright test against the
   built extension, or a documented reason plus manual steps.

## Testing notes

- Unit tests sit next to code as `*.test.ts(x)`; environment is happy-dom; WXT's `fakeBrowser`
  backs `browser.*` (in-memory, reset per test as needed).
- E2E uses Playwright's bundled Chromium with `--load-extension`. Branded Google Chrome 137+
  ignores that flag, so do not switch the channel to `chrome`.
- `chrome.runtime.reload()` unloads command-line-loaded extensions in automation; to test
  persistence, relaunch the browser on the same profile (see `tests/e2e/popup.spec.ts`).
- Fixture pages record main-world events in `window.__pageEvents` so tests can assert what the
  extension let through to the page.
- Playwright cannot show or inspect Chrome's native context menu or press real command
  shortcuts; see the manual checklist in the README.

## Conventions

- TypeScript strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noUnusedLocals/Parameters`. Prettier: single quotes, trailing commas, width 100.
- Conventional commit prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
- Comments explain constraints the code cannot show, not what the next line does.
