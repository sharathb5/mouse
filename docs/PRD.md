# Agentic Mouse — V1 Product Requirements

> **Right-click anything. Understand it, act on it, or delegate it.**

Agentic Mouse is a Chrome (Manifest V3) extension that turns right-click into a contextual
action interface. It removes the steps between encountering something on the web and doing
something useful with it: no highlighting, copying, switching to an AI app, and writing a
prompt. Speed, accuracy, reliability, and minimal interaction overhead are the differentiators.

This document records the **locked V1 scope**. Changes to anything marked _locked_ need an
explicit product decision; implementation details are owned by engineering.

Status legend: **Shipped** (in `main`, tested) · **Bootstrap** (foundation in place, behavior
partial) · **Planned** (specified, not built). Status reflects the bootstrap PR.

---

## 1. Context menu — _locked_

| Requirement                                                                   | Status                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Normal right-click preserves Chrome's native context menu                     | Shipped                                                            |
| Shift + right-click invokes Agentic Mouse on supported pages                  | Shipped                                                            |
| Toolbar toggle enables/disables Agentic Mouse instantly (no reload)           | Shipped                                                            |
| Users can reverse the default (right-click opens Agentic Mouse, Shift native) | Shipped                                                            |
| Escape and outside-click dismissal                                            | Shipped                                                            |
| Configurable fallback shortcut when Shift + right-click is unavailable        | Shipped (`Alt+Shift+M`, editable at chrome://extensions/shortcuts) |
| Unsupported browser pages handled gracefully                                  | Shipped (no-op on page; popup explains why)                        |

Additional behavior: the menu is viewport-aware, keyboard navigable (arrows, Home/End, Tab,
Escape), isolated from page CSS via Shadow DOM, and does not alter the page's text selection.

## 2. Semantic content selection — _locked_ · Planned (Workstream A)

- Identify paragraphs, sections, articles, tables, and other meaningful content.
- Exclude irrelevant UI: navigation, sidebars, advertisements.
- Preserve structure when extracting text (`ContentBlock[]`).
- Draw a **thin yellow outline** around the actual content being selected or sent.
- Update the outline as selection scope changes (e.g. paragraph → section → article).
- Never modify the underlying page content.

## 3. Inline AI assistance — _locked_ · Planned (Workstream A)

Actions: **Explain This, Summarize, Translate, Ask Follow-up, Simplify, Go Deeper, Example**.
Responses render in a small inline panel near the selected content and stream where supported.

## 4. Agent handoff — _locked_ · Planned (Workstream B)

- Send selected content to an external agent through an agent picker.
- Default destinations and reusable saved actions.
- Preserve source context and metadata (URL, title, capture time, classification).
- Genuine background execution when the destination API supports it; track status and results.
- **Cursor Cloud Agent** is the first genuine execution integration.
- Other destinations use only their actual capabilities. **A prefilled chatbot link is never
  presented as a running autonomous task.** (Enforced in contracts: only
  `background-execution` destinations can back a `TaskRequest`.)

## 5. Real-world actions — _locked_ · Planned (Workstream C)

- **Compare**: compare products or structured listings, retrieve relevant alternatives,
  normalize attributes, present grounded comparisons with source links.
- **Extract**: turn listings, jobs, products, and other repeated content into structured
  tables; copy and CSV export; designed for optional Google Sheets export.
- **Track**: monitor products/listings/other supported data for price, availability, or status
  changes; notify when conditions are met; pause or cancel.

## 6. Task inbox — _locked_ · Bootstrap (placeholder) → Workstream B

- Toolbar icon badge shows the active task count (badge plumbing exists; shows nothing until
  real tasks exist).
- Clicking the icon opens the task dashboard (popup **Inbox** tab; currently an honest empty
  state).
- Running, completed, failed, and monitoring tasks with progress and meaningful updates.
- Result links and task controls.
- **Animated cat walking along a horizontal progress line** for running tasks; indeterminate
  animation when reliable numeric progress is unavailable; the cat **rests/sleeps** for
  long-running monitoring tasks.
- Completion notifications.

## 7. Customizable pinned actions — _locked_ · Shipped

Default pinned menu, in order: **1. Explain This · 2. Select Content · 3. Send to Agent**.
Users can add from the action library, remove, reorder, and reset to defaults (popup **Menu**
tab; persisted). **No automatic context-based suggestions are inserted.**

## 8. Invisible page detection — _locked_ · Contracts only (Workstream A)

Recognize articles, documentation, GitHub issues, products, listings, tables, links, and
images. Detection changes how actions _interpret_ context; it **must not change which actions
appear in the pinned menu**. Use local DOM inspection and metadata first; **no LLM calls in the
menu-opening path**.

## 9. Privacy and permissions — _locked_

| Requirement                                           | Status / mechanism                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Minimize permissions                                  | Shipped: only `storage` + http/https content-script matches                          |
| Process locally whenever possible                     | Shipped: bootstrap sends nothing anywhere                                            |
| Share page content externally only when required      | Contract: `ActionDefinition.dataEgress` (`none` / `on-invoke` / `requires-approval`) |
| Trusted site-agent combinations, revocable            | Contract: `TaskApproval.kind = 'trusted-rule'`; UI planned (Workstream B)            |
| Protect sensitive fields and credentials              | Contract: `ElementClassification.sensitive`, `SelectedContext.containsSensitiveData` |
| Explicit approval for consequential external actions  | Contract: `TaskApproval` required on every `TaskRequest`                             |
| Webpage content is untrusted; resist prompt injection | Contract: `SelectedContext.untrusted: true`; executors must delimit page content     |

## 10. Speed and reliability — _locked targets_

Engineering targets, not guarantees:

| Metric                                | Target   | Current                                                                                       |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| Context menu visible                  | < 100 ms | Instrumented (`menu.open`); ~18 ms in one headed Chromium run on the dev VM (not a benchmark) |
| Local context identification          | < 200 ms | Not built                                                                                     |
| Paragraph selection                   | < 100 ms | Not built                                                                                     |
| Inline explanation starts streaming   | < 1.5 s  | Not built                                                                                     |
| Background task creation acknowledged | < 500 ms | Not built                                                                                     |

Instrument action latency, correctness, completion rates, and errors. Metrics are local-only
until an opt-in telemetry sink exists; they must never include page content.

---

## Non-goals for V1

- A complex backend, Kubernetes, or paid infrastructure.
- Browsers other than Chrome/Chromium (WXT keeps Firefox/Edge possible later).
- Automatic action suggestions in the pinned menu.
