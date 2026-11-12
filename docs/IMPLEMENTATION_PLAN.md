# Implementation Plan

This plan takes Agentic Mouse from the bootstrap (working menu, popup, contracts, tests, CI) to
the V1 beta described in [PRD.md](./PRD.md), using three workstreams that can run in parallel
without inventing incompatible data contracts. Read [ARCHITECTURE.md](./ARCHITECTURE.md) first.

## Phases

| Phase               | Scope                                                                                                            | Exit criteria                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0. Bootstrap (done) | WXT scaffold, strict TS, lint/format, Vitest, Playwright, CI, contracts, registry, menu, popup, settings         | CI green; menu opens on Shift + right-click; docs exist                      |
| 1. Contract PRs     | Each workstream lands its contract additions (below) as a small PR touching only `src/core/contracts/**` + tests | Contracts reviewed by the other two workstreams and merged                   |
| 2. Vertical slices  | A: Select Content + Explain This end to end. B: Send to Agent → Cursor task → Inbox. C: Extract → table/CSV      | Each slice usable from the menu in a real browser; e2e covers the happy path |
| 3. Breadth          | Remaining inline actions; saved actions, trusted rules, notifications; Compare and Track                         | All V1 actions available or explicitly deferred with a product decision      |
| 4. Hardening        | Latency budgets, prompt-injection fixtures, permission review, accessibility, error states, Web Store prep       | Targets measured; no known P0/P1 bugs                                        |

## Rules for parallel work

### Shared files (coordinate before modifying)

Changes to these files need a short heads-up to the other workstreams (PR description or
issue) and review from at least one other workstream owner:

| Path                                                        | Why it is shared                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/core/contracts/**`                                     | The data language between all workstreams.                                                  |
| `src/core/actions/registry.ts`, `catalog.ts`                | Registry API and action metadata used by menu, popup, executors.                            |
| `src/content/menu-controller.tsx`                           | Gesture path; latency-critical; all action dispatch flows here.                             |
| `src/content/menu/AgenticMenu.tsx`, `menu.css`              | Shared menu UI.                                                                             |
| `src/entrypoints/**`                                        | Wiring for every workstream.                                                                |
| `wxt.config.ts`                                             | Manifest: **permissions** and commands. Every new permission needs a written justification. |
| `src/platform/settings-store.ts`                            | Settings schema migrations.                                                                 |
| `package.json`, `pnpm-lock.yaml`                            | Dependencies (justify every new runtime dependency).                                        |
| `eslint.config.js`, `tsconfig.json`, `.github/workflows/**` | Tooling for everyone.                                                                       |

### Contract change protocol

1. Add or extend schemas in `src/core/contracts/` with unit tests for valid and invalid shapes.
2. Prefer **additive** changes (new union variants, new optional fields). Renames or removals
   require updating all consumers in the same PR.
3. Any persisted shape (settings, tasks, trackers) gets a version field and a defensive parser
   like `parseSettings`.
4. Keep `src/core` free of React, WXT, and `browser.*` (ESLint enforces it).

### Integration points

- **Action dispatch**: the menu calls `handleSelect(entry)` in `menu-controller.tsx`. Workstream
  A owns turning that into a `SelectedContext` and invoking the registered executor; B and C
  register executors and must not add action-specific branches to the controller.
- **Content ↔ background**: long-running or credentialed work runs in the background service
  worker. Add message types to `ContentScriptMessageSchema` / a new `BackgroundMessageSchema`
  (contracts) and stream with `runtime.Port`.
- **Results**: every executor yields `ActionEvent`s and ends with an `ActionResult` or an
  `ActionError`. UI renders by `ActionResult.kind`.

### Definition of done for any workstream PR

- `pnpm verify` passes locally (lint, format, typecheck, unit, build, e2e).
- New behavior has unit tests; user-visible behavior has a Playwright test against the built
  extension, or a documented reason it cannot (with manual steps).
- Mocked tests are labeled as mocked. Real provider verification is reported separately and
  never claimed without being run.
- No new permission without justification in the PR and in `ARCHITECTURE.md`.

---

## Workstream A — Browser experience

**Goal:** right-click → precise semantic selection with a yellow outline → inline streamed
answer near the content.

### Owned modules (create)

| Path                       | Contents                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/content/selection/`   | Semantic unit detection, scope expand/shrink, exclusion of nav/aside/ads.                              |
| `src/content/highlight/`   | Thin yellow outline overlay (in Shadow DOM, positioned over target rects; never mutates page).         |
| `src/content/extraction/`  | `Element → ContentBlock[]`, readability-style article extraction, `SelectedContext` builder.           |
| `src/content/panel/`       | Inline response panel (Shadow DOM), streaming render, follow-up input.                                 |
| `src/core/classification/` | Pure page/element classification heuristics (`PageClassification`, `ElementClassification`).           |
| `src/actions/inline/`      | Executors: explain, summarize, translate, ask-follow-up, simplify, go-deeper, example, select-content. |
| `src/background/model/`    | `ModelProvider` interface + implementation(s); prompt construction with untrusted-data delimiting.     |

### Expected interfaces

```ts
// src/content/selection
interface SelectionHandle {
  readonly element: Element;
  readonly kind: ElementKind;
  expand(): SelectionHandle | null; // paragraph → section → article
  shrink(): SelectionHandle | null;
  toContext(): SelectedContext; // validated with SelectedContextSchema
}
function selectAt(invocation: MenuInvocation): SelectionHandle; // < 100 ms

// src/content/highlight
interface HighlightOverlay {
  show(target: Element | Range): void;
  update(): void;
  hide(): void;
}

// src/core/classification (pure, DOM passed in)
function classifyPage(doc: Document, url: string): PageClassification; // < 200 ms, no network
function classifyElement(el: Element): ElementClassification;

// src/background/model
interface ModelProvider {
  stream(
    request: { system: string; untrustedContext: string; userInstruction: string },
    signal: AbortSignal,
  ): AsyncIterable<string>;
}
```

Contract additions to propose in Phase 1: background message/port types for running an
action and streaming `ActionEvent`s; `ModelProviderSettings` (provider id, model, key presence
flag — never the key in content-script-visible shapes).

### Dependencies

- Consumes `MenuInvocation` (content), `SelectedContext`/`ContentBlock`/classification
  contracts, `ActionExecutor`, `ActionEvent`, `ActionResult` (`inline-text`, `selection`).
- **Decision needed:** which model provider(s) power inline answers and how the user supplies a
  key. Until decided, build against `ModelProvider` with a deterministic mock provider; the UI
  must say "not configured" rather than fake output.
- Provides `classifyPage`, `extractBlocks`, and `SelectionHandle.toContext()` to Workstreams B
  and C.

### Acceptance criteria

- Shift + right-click a paragraph → Select Content outlines exactly that paragraph; expand
  reaches section and article; nav, sidebars, and ads are never included on fixture pages.
- The outline follows scroll/resize and scope changes and is removed on dismiss; a
  `MutationObserver` on the page records no changes outside the extension's host element.
- `toContext()` output validates against `SelectedContextSchema`, preserves headings, lists,
  tables, and code blocks, and sets `containsSensitiveData` for password/payment fields.
- Explain This streams into an inline panel near the selection; first token < 1.5 s with a real
  provider (manual measurement, reported separately from mocked tests).
- Prompt-injection fixture ("ignore previous instructions…") does not change the action,
  destination, or system prompt.
- Page classification never changes pinned menu contents (test asserts identical menu across
  article/product/GitHub fixtures).

### Testing requirements

- Unit: classification and extraction against saved HTML fixtures (happy-dom); prompt builder
  delimiting; panel streaming reducer.
- Playwright: fixtures for article, documentation, GitHub issue, product, listing, table; outline
  geometry vs. element rect; panel streams from the mock provider; latency recorded.
- Manual: real provider streaming latency; complex real-world sites (news, docs, GitHub).

### Do not modify without coordination

`src/core/contracts/**`, `src/core/actions/registry.ts`, `src/content/menu-controller.tsx`
(beyond wiring `handleSelect` through the registry), `wxt.config.ts`, popup files.

---

## Workstream B — Agent infrastructure

**Goal:** Send to Agent creates a genuine background task (Cursor Cloud Agent first), tracked
in the Inbox with live status and the walking-cat progress line.

### Owned modules (create)

| Path                           | Contents                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `src/core/tasks/`              | Pure task state machine (`transition(state, event)`), badge count, inbox sorting.    |
| `src/background/tasks/`        | `TaskStore` (persisted, versioned), orchestrator, polling via `chrome.alarms`.       |
| `src/background/destinations/` | `DestinationAdapter`s: `cursor-cloud-agent` (real), `prefill-link`, `clipboard`.     |
| `src/actions/send-to-agent/`   | Executor: picker → approval → create task or open prefill → `handoff` result.        |
| `src/popup/inbox/`             | Task list, controls, result links, walking/sleeping cat animation.                   |
| `src/popup/destinations/`      | Agent picker settings, default destination, saved actions, trusted site-agent rules. |

### Expected interfaces

```ts
interface DestinationAdapter<D extends AgentDestination = AgentDestination> {
  readonly integration: D['integration'];
  // Only for background-execution destinations:
  createTask?(
    request: TaskRequest,
    signal: AbortSignal,
  ): Promise<{ externalId: string; externalUrl?: string }>;
  pollTask?(externalId: string): Promise<TaskState>;
  cancelTask?(externalId: string): Promise<void>;
  // For prefill/clipboard destinations:
  handoff?(input: ActionInputFor<'send-to-agent'>): Promise<ActionResult & { kind: 'handoff' }>;
}

interface TaskStore {
  list(): Promise<Task[]>;
  get(id: TaskId): Promise<Task | undefined>;
  upsert(task: Task): Promise<void>;
  watch(cb: (tasks: Task[]) => void): () => void;
}

function transition(state: TaskState, event: TaskEvent): TaskState; // pure, exhaustively tested
```

Contract additions to propose in Phase 1: `TaskEvent` union, `SavedAction`
(name, destination id, instruction template), `TrustedRule` (origin pattern, destination id,
created/revoked timestamps), destination settings shape, background message types for task
creation and inbox commands.

### Dependencies

- Consumes `SelectedContext` from Workstream A (until ready, build contexts from
  `MenuInvocation` + selection text, validated by the schema).
- `TaskRequestSchema` already forbids prefill destinations as task executors; keep it that way.
- **Decision/credential needed:** a Cursor API key for real verification. Store it only in
  extension storage, use it only from the background, request `https://api.cursor.com/*` (or
  the documented host) as an **optional host permission** at connect time. Confirm the current
  Cursor Cloud Agents API contract from official docs before coding the adapter.
- Notifications need the `notifications` permission; polling needs `alarms` (coordinate in
  `wxt.config.ts`).
- Provides `TaskStore` and inbox rendering for Workstream C's Track and Compare tasks.

### Acceptance criteria

- Send to Agent shows a picker with the default destination preselected; consequential sends
  require explicit approval unless a trusted rule matches; rules are revocable in the popup.
- Cursor destination: task creation acknowledged in the UI < 500 ms (local `queued` state),
  then real status from the API; result link opens the agent run.
- Prefill destinations open the provider URL and record a `handoff` result with
  `mode: 'prefill-opened'`; they never appear as running tasks.
- Inbox lists running, completed, failed, monitoring tasks with updates and controls; badge
  shows the active count; the cat walks along a determinate line, loops when indeterminate,
  and sleeps for monitoring tasks; reduced-motion users get a static indicator.
- Completion notification fires once per task.

### Testing requirements

- Unit: `transition` for every state/event pair; `TaskStore` with `fakeBrowser`; adapters with
  mocked `fetch` (**labeled mocked**).
- Playwright: inbox renders seeded tasks in every state; badge count; prefill handoff opens a
  new tab with the expected URL; approval dialog blocks sending until confirmed.
- Real verification (separate, manual or opt-in CI secret): create and observe one real
  Cursor Cloud Agent task; report results distinctly from mocked runs.

### Do not modify without coordination

`src/core/contracts/**` (except via Phase 1 PRs), `src/content/**`, `wxt.config.ts`
permissions, `src/popup/App.tsx` layout beyond mounting the inbox and destinations panels.

---

## Workstream C — Consumer actions

**Goal:** grounded Compare, Extract, and Track on real shopping, listing, and job pages.

### Owned modules (create)

| Path                       | Contents                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/core/sources/`        | Pure source adapters: JSON-LD (`Product`, `Offer`, `JobPosting`, `Residence`), microdata, OpenGraph, site-specific adapters. |
| `src/core/normalize/`      | Attribute normalization (currency, units, dates), column inference, CSV serialization.                                       |
| `src/actions/extract/`     | Executor → `table` result; copy and CSV export; Google Sheets export behind an interface.                                    |
| `src/actions/compare/`     | Executor → `comparison` result with sources; alternatives retrieval behind an interface.                                     |
| `src/actions/track/`       | Executor → `tracking` result; creates monitoring tasks via B's `TaskStore`.                                                  |
| `src/background/tracking/` | Scheduler (`chrome.alarms`), fetch/diff, condition evaluation, notifications, pause/cancel.                                  |

### Expected interfaces

```ts
interface SourceAdapter {
  readonly id: string;
  matches(url: URL, doc: Document): boolean;
  extractItems(doc: Document, url: URL): ExtractedItem[]; // every value carries its source URL
}

function normalize(items: ExtractedItem[]): { columns: Column[]; rows: Record<string, Cell>[] };
function toCsv(result: Extract<ActionResult, { kind: 'table' }>): string;

interface AlternativesProvider {
  find(item: ExtractedItem, signal: AbortSignal): Promise<ExtractedItem[]>;
}
interface SheetsExporter {
  export(result: Extract<ActionResult, { kind: 'table' }>): Promise<{ url: string }>;
}

function evaluateCondition(
  condition: TrackCondition,
  previous: Snapshot,
  current: Snapshot,
): boolean;
```

Contract additions to propose in Phase 1: `ExtractedItem` (fields with per-value provenance),
`Tracker` and `TrackerSnapshot` (versioned, persisted), notification preferences.

### Dependencies

- Consumes `classifyPage` / `ContentBlock` from Workstream A (can start with its own JSON-LD
  adapters and switch to A's classifier when available).
- Consumes B's `TaskStore` and inbox for Track (monitoring state) and long-running Compare.
- **Decisions needed:** the source for "retrieve relevant alternatives" (no paid infrastructure
  allowed in bootstrap — likely user-provided pages or a free search API), and whether Google
  Sheets export ships in V1 (needs OAuth via `chrome.identity`).
- Permissions to coordinate: `alarms`, `notifications`, optional host permissions for tracked
  origins (requested per site at Track time).

### Acceptance criteria

- Extract turns fixture apartment, job, and product listings into tables with correct columns;
  copy and CSV export work; missing values are `null`, never invented.
- Compare shows ≥ 2 items with normalized attributes and a source link for every value; the
  summary only states facts present in the table.
- Track detects a price drop below a threshold and an availability change on fixtures with a
  simulated page change, notifies once, and supports pause, resume, and cancel; the inbox shows
  the task as monitoring.
- No content is sent externally without the action's declared `dataEgress` being honored.

### Testing requirements

- Unit: every adapter against saved HTML fixtures; normalization edge cases (currencies,
  locales); CSV escaping; condition evaluation.
- Playwright: Extract on fixture listings produces the expected table and downloadable CSV;
  Track with a fixture server that changes price between checks (alarm triggered manually in
  tests).
- Manual: a handful of real retail/listing sites; report breakage per site.

### Do not modify without coordination

`src/core/contracts/**` (except via Phase 1 PRs), `src/content/menu-controller.tsx`,
`src/background/tasks/**` (owned by B), `wxt.config.ts` permissions.

---

## Recommended next engineering tasks (cross-cutting)

1. Phase 1 contract PRs for all three workstreams (small, reviewed together).
2. ~~Reduce the content-script bundle (~350 kB, mostly React + Zod)~~ Done on
   `feat/content-script-bundle`: lean ESM shell (~58 kB initial) + lazy React/consumer chunks.
3. Add a performance regression check (e.g. median `menu.open` over N Playwright runs).
4. Decide model provider and Cursor credential UX (blocks real verification in A and B).
5. Accessibility pass (screen reader announcements for menu open, focus return paths).
