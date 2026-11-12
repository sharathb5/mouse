/// <reference types="chrome" />
import { fileURLToPath } from 'node:url';
import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
  type Worker,
} from '@playwright/test';

export const EXTENSION_PATH = fileURLToPath(new URL('../../.output/chrome-mv3', import.meta.url));
export const FIXTURE_ORIGIN = `http://127.0.0.1:${process.env.FIXTURE_PORT ?? '4321'}`;

export interface PageEvents {
  contextmenu: { shiftKey: boolean; defaultPrevented: boolean }[];
  clicks: number;
  keydowns: string[];
}

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

/**
 * Launches Playwright's Chromium with the built unpacked extension. Branded Google Chrome
 * no longer honors --load-extension, so tests use the `chromium` channel (new headless).
 * Pass a `userDataDir` to reuse a profile across launches.
 */
export function launchWithExtension(userDataDir = ''): Promise<BrowserContext> {
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: !process.env.HEADED,
    viewport: { width: 1280, height: 720 },
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  });
}

export async function serviceWorkerOf(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? context.waitForEvent('serviceworker');
}

export const test = base.extend<ExtensionFixtures>({
  // Playwright requires the object-destructuring pattern for fixtures without dependencies.
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await launchWithExtension();
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    await use(await serviceWorkerOf(context));
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export { expect };

export function menu(page: Page): Locator {
  return page.getByTestId('agentic-mouse-menu');
}

export function menuHost(page: Page): Locator {
  return page.locator('agentic-mouse-ui');
}

/** Tab id of `page`, resolved by activating it and asking the extension for the active tab. */
export async function tabIdOf(serviceWorker: Worker, page: Page): Promise<number> {
  await page.bringToFront();
  return serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id === undefined) throw new Error('No active tab');
    return tab.id;
  });
}

/** Waits until the content script in `page` reports settings and UI are loaded. */
export async function waitForContentScript(serviceWorker: Worker, page: Page): Promise<void> {
  const tabId = await tabIdOf(serviceWorker, page);
  await expect
    .poll(
      () =>
        serviceWorker.evaluate(async (id) => {
          try {
            const response = await chrome.tabs.sendMessage<
              unknown,
              { ready?: boolean } | undefined
            >(id, { type: 'agentic-mouse/ping' });
            return response?.ready === true;
          } catch {
            return false;
          }
        }, tabId),
      { message: 'content script never became ready' },
    )
    .toBe(true);
}

export async function openFixture(
  serviceWorker: Worker,
  page: Page,
  name = 'article.html',
): Promise<void> {
  await page.goto(`${FIXTURE_ORIGIN}/${name}`);
  await waitForContentScript(serviceWorker, page);
}

export async function rightClick(
  page: Page,
  target: Locator | { x: number; y: number },
  options: { shift?: boolean } = {},
): Promise<void> {
  const modifiers: 'Shift'[] = options.shift ? ['Shift'] : [];
  if ('x' in target) {
    await page.mouse.move(target.x, target.y);
    if (options.shift) await page.keyboard.down('Shift');
    await page.mouse.click(target.x, target.y, { button: 'right' });
    if (options.shift) await page.keyboard.up('Shift');
  } else {
    await target.click({ button: 'right', modifiers });
  }
}

export function pageEvents(page: Page): Promise<PageEvents> {
  return page.evaluate(() => (window as unknown as { __pageEvents: PageEvents }).__pageEvents);
}

export async function openPopup(
  context: BrowserContext,
  extensionId: string,
  query = '',
): Promise<Page> {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html${query}`);
  await expect(popup.getByTestId('enabled-toggle')).toBeVisible();
  return popup;
}
