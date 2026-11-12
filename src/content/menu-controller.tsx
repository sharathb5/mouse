import { createRoot, type Root } from 'react-dom/client';
import { browser, type Browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import {
  createShadowRootUi,
  type ShadowRootContentScriptUi,
} from 'wxt/utils/content-script-ui/shadow-root';
import {
  contextFromInvocation,
  sendToAgentExecutor,
  SendToAgentDialog,
} from '@/actions/send-to-agent';
import { createActionRegistry, type ActionRegistry, type ResolvedAction } from '@/core/actions';
import {
  ContentScriptMessageSchema,
  type OpenMenuResponse,
  type PingResponse,
  type SelectedContext,
  type Settings,
} from '@/core/contracts';
import { createMetricsRecorder } from '@/core/metrics';
import { loadSettings, watchSettings } from '@/platform/settings-store';
import { decideContextMenu } from './gesture';
import { detectQuickTargetKind, shortcutAnchor, type MenuInvocation } from './invocation';
import { AgenticMenu } from './menu/AgenticMenu';
import { getViewportSize, type Point } from './positioning';

export const MENU_HOST_TAG = 'agentic-mouse-ui';

type CloseReason = 'escape' | 'outside-click' | 'native-menu' | 'disabled' | 'viewport' | 'tab';

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

export interface MenuController {
  start(): Promise<void>;
  isOpen(): boolean;
}

export function createMenuController(
  ctx: ContentScriptContext,
  registry: ActionRegistry = createActionRegistry({ executors: [sendToAgentExecutor] }),
): MenuController {
  const metrics = createMetricsRecorder();
  let settings: Settings | null = null;
  let ui: ShadowRootContentScriptUi<Root> | null = null;
  let open: OpenState | null = null;
  let nextInvocationId = 1;

  const isReady = () => settings !== null && ui !== null;

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
    // Only intercept when we are actually going to show our menu.
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
    if (open.kind === 'menu') {
      const { invocation } = open;
      ui.mounted.render(
        <AgenticMenu
          key={invocation.id}
          invocation={invocation}
          entries={registry.resolve(settings.pinnedActionIds)}
          onSelect={handleSelect}
          onDismiss={() => close('tab')}
          onPositioned={(element) => {
            const sample = metrics.record('menu.open', performance.now() - invocation.startedAt);
            element.dataset.openLatencyMs = sample.durationMs.toFixed(1);
          }}
        />,
      );
      return;
    }

    ui.mounted.render(
      <SendToAgentDialog
        context={open.context}
        onClose={() => close('tab')}
        onCompleted={(message) => {
          if (open?.kind === 'send') {
            open = { ...open, notice: message };
          }
        }}
      />,
    );
  }

  function handleSelect(entry: ResolvedAction) {
    if (entry.definition.id !== 'send-to-agent' || open?.kind !== 'menu') {
      console.info('[agentic-mouse] action selected', entry.definition.id);
      return;
    }
    const { invocation, restoreFocusTo, listeners } = open;
    listeners.abort();
    const context = contextFromInvocation(invocation);
    open = {
      kind: 'send',
      context,
      restoreFocusTo,
      listeners: addDismissListeners(),
      notice: null,
    };
    render();
  }

  function close(reason: CloseReason) {
    if (!open) return;
    const { listeners, restoreFocusTo } = open;
    open = null;
    listeners.abort();
    ui?.remove();
    if ((reason === 'escape' || reason === 'tab') && restoreFocusTo?.isConnected) {
      restoreFocusTo.focus({ preventScroll: true });
    }
  }

  function isInsideMenu(event: Event): boolean {
    return ui !== null && event.composedPath().includes(ui.shadowHost);
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
        // Secondary-button presses are resolved by the contextmenu handler (reopen or close).
        if (event.button === 2 || isInsideMenu(event)) return;
        close('outside-click');
      },
      options,
    );
    window.addEventListener('resize', () => close('viewport'), options);
    window.addEventListener(
      'blur',
      (event) => {
        // Capture-phase listeners also see element blurs (e.g. focus moving into the menu).
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
    sendResponse: (response: PingResponse | OpenMenuResponse) => void,
  ): boolean | undefined {
    const parsed = ContentScriptMessageSchema.safeParse(message);
    if (!parsed.success) return undefined;
    switch (parsed.data.type) {
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
    }
  }

  return {
    isOpen: () => open !== null,
    async start() {
      // Register the gesture listener first; until settings and UI are ready it defers to
      // the native menu.
      ctx.addEventListener(window, 'contextmenu', onContextMenu, { capture: true });
      ctx.addEventListener(window, 'mousedown', onMouseDown, { capture: true });
      browser.runtime.onMessage.addListener(onMessage);
      const unwatch = watchSettings((next) => {
        settings = next;
        if (!next.enabled) close('disabled');
        else render();
      });
      ctx.onInvalidated(() => {
        unwatch();
        browser.runtime.onMessage.removeListener(onMessage);
        close('disabled');
      });

      ui = await createShadowRootUi<Root>(ctx, {
        name: MENU_HOST_TAG,
        position: 'inline',
        anchor: () => document.documentElement,
        append: 'last',
        // Keep interactions with the menu from reaching page handlers that bubble.
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
        onMount(container, _shadow, host) {
          // Inline !important beats page stylesheets, keeping the host out of page layout.
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
          const root = createRoot(container);
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });
      const loaded = await loadSettings();
      settings ??= loaded;
    },
  };
}
