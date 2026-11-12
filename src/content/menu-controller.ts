import type { Root } from 'react-dom/client';
import { browser, type Browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  createShadowRootUi,
  type ShadowRootContentScriptUi,
} from 'wxt/utils/content-script-ui/shadow-root';
import type { ActionRegistry, ResolvedAction } from '@/core/actions/registry';
import type { ActionId, SelectedContext, Settings } from '@/core/contracts';
import { createMetricsRecorder } from '@/core/metrics';
import type { SelectionHandle } from './selection';
import { parseContentScriptMessage, type ContentScriptResponse } from './messages-runtime';
import { decideContextMenu } from './gesture';
import { detectQuickTargetKind, shortcutAnchor, type MenuInvocation } from './invocation';
import { MENU_CSS } from './menu/menu-css';
import { mountAgenticMenu, type AgenticMenuHandle } from './menu/mount-menu';
import { getViewportSize, type Point } from './positioning';
import { createShellActionRegistry } from './shell-registry';
import { loadContentSettings, watchContentSettings } from './settings-runtime';
import type * as ConsumerActionsModule from './lazy/consumer-actions';
import type * as ReactUiModule from './lazy/react-ui';

export const MENU_HOST_TAG = 'agentic-mouse-ui';

type CloseReason = 'escape' | 'outside-click' | 'native-menu' | 'disabled' | 'viewport' | 'tab';

interface MenuUi {
  container: HTMLElement;
  shadow: ShadowRoot;
  host: HTMLElement;
  menu: AgenticMenuHandle | null;
  sendRoot: Root | null;
}

interface MenuOpenState {
  kind: 'menu';
  invocation: MenuInvocation;
  restoreFocusTo: HTMLElement | null;
  listeners: AbortController;
}

interface SendOpenState {
  kind: 'send';
  context: SelectedContext;
  restoreFocusTo: HTMLElement | null;
  listeners: AbortController;
  notice: string | null;
}

type OpenState = MenuOpenState | SendOpenState;

interface SelectionSession {
  handle: SelectionHandle;
  dismiss: AbortController;
}

type ReactUi = typeof ReactUiModule;
type ConsumerActions = typeof ConsumerActionsModule;

export interface MenuController {
  start(): Promise<void>;
  isOpen(): boolean;
}

export function createMenuController(
  ctx: ContentScriptContext,
  registry: ActionRegistry = createShellActionRegistry(),
): MenuController {
  const metrics = createMetricsRecorder();
  let settings: Settings | null = null;
  let ui: ShadowRootContentScriptUi<MenuUi> | null = null;
  let open: OpenState | null = null;
  let nextInvocationId = 1;
  let reactUi: ReactUi | null = null;
  let highlight: ReturnType<ReactUi['createHighlightOverlay']> | null = null;
  let panel: ReturnType<ReactUi['createPanelController']> | null = null;
  let selectionChrome: ReturnType<ReactUi['createSelectionChrome']> | null = null;
  let results: ReturnType<ReactUi['createResultHost']> | null = null;
  let selectionSession: SelectionSession | null = null;
  let activeRun: { abort: () => void } | null = null;
  let actionAbort: AbortController | null = null;
  let reactUiPromise: Promise<ReactUi> | null = null;
  let consumerPromise: Promise<ConsumerActions> | null = null;

  const isReady = () => settings !== null && ui !== null;

  function loadReactUi(): Promise<ReactUi> {
    reactUiPromise ??= import('./lazy/react-ui').then((mod) => {
      reactUi = mod;
      return mod;
    });
    return reactUiPromise;
  }

  function loadConsumerActions(): Promise<ConsumerActions> {
    consumerPromise ??= import('./lazy/consumer-actions');
    return consumerPromise;
  }

  async function ensureUiHelpers() {
    const mod = await loadReactUi();
    highlight ??= mod.createHighlightOverlay();
    panel ??= mod.createPanelController();
    selectionChrome ??= mod.createSelectionChrome({
      onExpand: () => expandSelection(),
      onShrink: () => shrinkSelection(),
      onDone: () => endSelectionSession(),
    });
  }

  async function ensureResults() {
    const mod = await loadReactUi();
    results ??= mod.createResultHost();
    return results;
  }

  /**
   * Shift + mousedown extends the page's text selection before `contextmenu` fires. When the
   * press will open our menu, cancel only that default so the user's selection is preserved.
   * The event still propagates to the page.
   */
  function onMouseDown(event: MouseEvent) {
    if (event.button !== 2 || !isReady()) return;
    if (decideContextMenu(event, settings) === 'agentic-mouse') event.preventDefault();
  }

  function onContextMenu(event: MouseEvent) {
    const decision = isReady() ? decideContextMenu(event, settings) : 'native';
    if (decision === 'native') {
      if (open) close('native-menu');
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    openMenu({
      source: 'pointer',
      anchor: { x: event.clientX, y: event.clientY },
      target: event.target instanceof Element ? event.target : null,
      startedAt: event.timeStamp,
    });
  }

  function openMenu(input: {
    source: MenuInvocation['source'];
    anchor: Point;
    target: Element | null;
    startedAt: number;
  }) {
    if (!ui) return;
    endSelectionSession();
    panel?.close();
    activeRun?.abort();
    activeRun = null;

    const invocation: MenuInvocation = {
      ...input,
      id: nextInvocationId++,
      quickKind: detectQuickTargetKind(input.target, window.getSelection()),
    };

    if (open?.kind === 'menu') {
      open.invocation = invocation;
    } else {
      if (open) {
        open.listeners.abort();
      }
      const active = document.activeElement;
      open = {
        kind: 'menu',
        invocation,
        restoreFocusTo: active instanceof HTMLElement && active !== document.body ? active : null,
        listeners: addDismissListeners(),
      };
      if (!ui.mounted) ui.mount();
    }
    render();
  }

  function render() {
    if (!open || !ui?.mounted || !settings) return;
    const mount = ui.mounted;

    if (open.kind === 'menu') {
      mount.sendRoot?.unmount();
      mount.sendRoot = null;
      const { invocation } = open;
      const props = {
        invocation,
        entries: registry.resolve(settings.pinnedActionIds),
        onSelect: (entry: ResolvedAction) => {
          void handleSelect(entry);
        },
        onDismiss: () => close('tab'),
        onPositioned: (element: HTMLElement) => {
          const sample = metrics.record('menu.open', performance.now() - invocation.startedAt);
          element.dataset.openLatencyMs = sample.durationMs.toFixed(1);
        },
      };
      if (mount.menu) {
        mount.menu.update(props);
      } else {
        mount.menu = mountAgenticMenu(mount.container, props);
      }
      return;
    }

    mount.menu?.destroy();
    mount.menu = null;
    void renderSendDialog(mount, open);
  }

  async function renderSendDialog(mount: MenuUi, state: SendOpenState) {
    const mod = await loadReactUi();
    if (!ui?.mounted || open !== state) return;
    mod.ensureSendDialogStyles(mount.shadow);
    const root = mount.sendRoot ?? mod.createRoot(mount.container);
    mount.sendRoot = root;
    root.render(
      mod.createElement(mod.SendToAgentDialog, {
        context: state.context,
        onClose: () => close('tab'),
        onCompleted: (message: string) => {
          if (open?.kind === 'send') {
            open = { ...open, notice: message };
          }
        },
      }),
    );
  }

  async function handleSelect(entry: ResolvedAction) {
    if (open?.kind !== 'menu' || entry.availability.status !== 'available') return;

    if (entry.definition.id === 'send-to-agent') {
      const { invocation, restoreFocusTo, listeners } = open;
      listeners.abort();
      const mod = await loadReactUi();
      const context = mod.contextFromInvocation(invocation);
      open = {
        kind: 'send',
        context,
        restoreFocusTo,
        listeners: addDismissListeners(),
        notice: null,
      };
      render();
      return;
    }

    const invocation = open.invocation;
    const actionId = entry.definition.id;

    if (actionId === 'extract' || actionId === 'compare' || actionId === 'track') {
      const consumer = await loadConsumerActions();
      const executor = consumer.createConsumerActionRegistry().getExecutor(actionId);
      if (!executor) return;
      close('tab');
      actionAbort?.abort();
      actionAbort = new AbortController();
      const signal = actionAbort.signal;
      const host = await ensureResults();
      const outcome = await consumer.runRegisteredAction(
        entry,
        executor,
        consumer.buildPageSelectedContext(),
        signal,
      );
      if (signal.aborted) return;
      if (outcome.result) {
        host.show(outcome.result);
        return;
      }
      host.show({
        kind: 'unavailable',
        actionId,
        reason: outcome.errorMessage ?? 'Action failed',
      });
      return;
    }

    close('tab');
    await ensureUiHelpers();
    const mod = reactUi;
    if (!mod) return;

    const handle = mod.selectAt(invocation);
    highlight?.show(handle.element);

    if (actionId === 'select-content') {
      beginSelectionSession(handle);
      return;
    }

    if (entry.definition.presentation === 'inline-panel') {
      await runInlineAction(actionId, handle, invocation.anchor);
    }
  }

  function beginSelectionSession(handle: SelectionSession['handle']) {
    endSelectionSession();
    const dismiss = new AbortController();
    selectionSession = { handle, dismiss };
    paintSelectionChrome();
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          endSelectionSession();
        } else if (event.key === '=' || event.key === '+') {
          event.preventDefault();
          expandSelection();
        } else if (event.key === '-' || event.key === '_') {
          event.preventDefault();
          shrinkSelection();
        }
      },
      { capture: true, signal: dismiss.signal },
    );
  }

  function paintSelectionChrome() {
    if (!selectionSession || !highlight) return;
    const { handle } = selectionSession;
    highlight.show(handle.element);
    const rect = handle.element.getBoundingClientRect();
    selectionChrome?.show({
      kindLabel: handle.kind,
      canExpand: handle.expand() !== null,
      canShrink: handle.shrink() !== null,
      anchor: { x: rect.left, y: Math.max(8, rect.top - 40) },
    });
  }

  function expandSelection() {
    if (!selectionSession) return;
    const next = selectionSession.handle.expand();
    if (!next) return;
    selectionSession.handle = next;
    paintSelectionChrome();
  }

  function shrinkSelection() {
    if (!selectionSession) return;
    const next = selectionSession.handle.shrink();
    if (!next) return;
    selectionSession.handle = next;
    paintSelectionChrome();
  }

  function endSelectionSession() {
    selectionSession?.dismiss.abort();
    selectionSession = null;
    selectionChrome?.hide();
    highlight?.hide();
  }

  async function runInlineAction(
    actionId: ActionId,
    handle: SelectionSession['handle'],
    anchor: Point,
  ) {
    const context = handle.toContext();
    const providerLabel =
      settings?.model.providerId === 'mock'
        ? 'Mock (deterministic, not a real model)'
        : `OpenRouter · ${settings?.model.modelId ?? ''}`;

    panel?.open(labelFor(actionId), anchor, providerLabel);
    panel?.setFollowUpHandler((question) => {
      void runInlineActionWithContext('ask-follow-up', context, anchor, { question });
    });

    await runInlineActionWithContext(actionId, context, anchor);
  }

  function runInlineActionWithContext(
    actionId: ActionId,
    context: SelectedContext,
    _anchor: Point,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    activeRun?.abort();
    if (actionId === 'ask-follow-up') {
      panel?.dispatch({
        type: 'reset',
        title: labelFor(actionId),
        providerLabel:
          settings?.model.providerId === 'mock'
            ? 'Mock (deterministic, not a real model)'
            : `OpenRouter · ${settings?.model.modelId ?? ''}`,
      });
    }

    return new Promise((resolve) => {
      void loadReactUi().then((mod) => {
        const started = performance.now();
        let firstTokenAt: number | null = null;
        activeRun = mod.runActionInBackground(actionId, context, options, {
          onTextDelta: (delta) => {
            if (firstTokenAt === null) {
              firstTokenAt = performance.now();
              metrics.record('inline.first-token', firstTokenAt - started);
            }
            panel?.dispatch({ type: 'delta', delta });
          },
          onResult: () => {
            panel?.dispatch({ type: 'complete' });
          },
          onError: (error) => {
            const notConfigured =
              error.code === 'provider' && /not configured/i.test(error.message);
            panel?.dispatch({
              type: 'error',
              message: error.message,
              notConfigured,
            });
          },
          onDone: () => {
            activeRun = null;
            resolve();
          },
        });
      });
    });
  }

  function close(reason: CloseReason) {
    if (!open) return;
    const { listeners, restoreFocusTo } = open;
    open = null;
    listeners.abort();
    if (ui?.mounted) {
      ui.mounted.menu?.destroy();
      ui.mounted.menu = null;
      ui.mounted.sendRoot?.unmount();
      ui.mounted.sendRoot = null;
    }
    ui?.remove();
    if ((reason === 'escape' || reason === 'tab') && restoreFocusTo?.isConnected) {
      restoreFocusTo.focus({ preventScroll: true });
    }
  }

  function isInsideMenu(event: Event): boolean {
    return ui !== null && event.composedPath().includes(ui.shadowHost);
  }

  function isInsideExtensionUi(event: Event): boolean {
    const path = event.composedPath();
    return (
      isInsideMenu(event) ||
      Boolean(panel && path.includes(panel.host)) ||
      Boolean(selectionChrome && path.includes(selectionChrome.host)) ||
      Boolean(highlight && path.includes(highlight.host))
    );
  }

  /** Listeners exist only while the menu is open, so idle pages see no extra handlers. */
  function addDismissListeners(): AbortController {
    const controller = new AbortController();
    const options = { capture: true, signal: controller.signal };
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        close('escape');
      },
      options,
    );
    window.addEventListener(
      'pointerdown',
      (event) => {
        if (event.button === 2 || isInsideExtensionUi(event)) return;
        close('outside-click');
      },
      options,
    );
    window.addEventListener('resize', () => close('viewport'), options);
    window.addEventListener(
      'blur',
      (event) => {
        if (event.target === window) close('viewport');
      },
      options,
    );
    document.addEventListener(
      'scroll',
      (event) => {
        if (!isInsideMenu(event)) close('viewport');
      },
      { ...options, passive: true },
    );
    return controller;
  }

  function onMessage(
    message: unknown,
    _sender: Browser.runtime.MessageSender,
    sendResponse: (response: ContentScriptResponse) => void,
  ): boolean | undefined {
    const parsed = parseContentScriptMessage(message);
    if (!parsed) return undefined;
    switch (parsed.type) {
      case 'agentic-mouse/ping':
        sendResponse({ ok: true, ready: isReady(), menuOpen: open !== null });
        return undefined;
      case 'agentic-mouse/open-menu': {
        const canOpen = isReady() && settings?.enabled === true;
        if (canOpen) {
          const viewport = getViewportSize();
          const selection = window.getSelection();
          openMenu({
            source: 'shortcut',
            anchor: shortcutAnchor(selection, { x: viewport.width, y: viewport.height }),
            target: selection?.anchorNode?.parentElement ?? document.activeElement,
            startedAt: performance.now(),
          });
        }
        sendResponse({ opened: canOpen });
        return undefined;
      }
      case 'agentic-mouse/extract-snapshot': {
        void loadConsumerActions().then((consumer) => {
          const snapshot = consumer.snapshotFromDocument(document, location.href);
          sendResponse(
            snapshot
              ? { ok: true, snapshot }
              : { ok: false, reason: 'No trackable data on this page' },
          );
        });
        return true;
      }
    }
  }

  return {
    isOpen: () => open !== null,
    async start() {
      ctx.addEventListener(window, 'contextmenu', onContextMenu, { capture: true });
      ctx.addEventListener(window, 'mousedown', onMouseDown, { capture: true });
      browser.runtime.onMessage.addListener(onMessage);
      const unwatch = watchContentSettings((next) => {
        settings = next;
        if (!next.enabled) {
          close('disabled');
          endSelectionSession();
          panel?.close();
          activeRun?.abort();
          actionAbort?.abort();
          results?.hide();
        } else render();
      });
      ctx.onInvalidated(() => {
        unwatch();
        browser.runtime.onMessage.removeListener(onMessage);
        close('disabled');
        endSelectionSession();
        panel?.close();
        activeRun?.abort();
        actionAbort?.abort();
        results?.hide();
      });

      ui = await createShadowRootUi<MenuUi>(ctx, {
        name: MENU_HOST_TAG,
        position: 'inline',
        anchor: () => document.documentElement,
        append: 'last',
        isolateEvents: [
          'keydown',
          'keyup',
          'keypress',
          'pointerdown',
          'pointerup',
          'mousedown',
          'mouseup',
          'click',
          'dblclick',
          'auxclick',
          'contextmenu',
        ],
        onMount(container, shadow, host) {
          for (const [property, value] of Object.entries({
            display: 'block',
            position: 'fixed',
            top: '0',
            left: '0',
            width: '0',
            height: '0',
            overflow: 'visible',
            'z-index': '2147483647',
          })) {
            host.style.setProperty(property, value, 'important');
          }
          if (!shadow.querySelector('style[data-am-menu]')) {
            const style = document.createElement('style');
            style.dataset.amMenu = 'true';
            style.textContent = MENU_CSS;
            shadow.appendChild(style);
          }
          return { container, shadow, host, menu: null, sendRoot: null };
        },
        onRemove(mounted) {
          mounted?.menu?.destroy();
          mounted?.sendRoot?.unmount();
        },
      });
      const loaded = await loadContentSettings();
      settings ??= loaded;
    },
  };
}

function labelFor(actionId: ActionId): string {
  switch (actionId) {
    case 'explain':
      return 'Explain This';
    case 'summarize':
      return 'Summarize';
    case 'translate':
      return 'Translate';
    case 'ask-follow-up':
      return 'Ask Follow-up';
    case 'simplify':
      return 'Simplify';
    case 'go-deeper':
      return 'Go Deeper';
    case 'example':
      return 'Example';
    case 'select-content':
      return 'Select Content';
    case 'send-to-agent':
      return 'Send to Agent';
    case 'compare':
      return 'Compare';
    case 'extract':
      return 'Extract';
    case 'track':
      return 'Track';
  }
}
