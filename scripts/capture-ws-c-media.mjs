/**
 * Captures Workstream C demo screenshots against the built extension + fixture server.
 * Run after `pnpm build`. Writes to the Project media store (ws-c-*).
 */
/* global chrome */
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pagesRoot = join(root, 'tests/e2e/fixtures/pages');
const extensionPath = join(root, '.output/chrome-mv3');
const mediaDir = '/cursor/stores/bc-422052f5-bc61-4fb9-96b1-d1d9789c6895/media';
const artifactsDir = '/opt/cursor/artifacts';
const port = 4321;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  const file = join(pagesRoot, url.pathname === '/' ? 'article.html' : url.pathname);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
await mkdir(mediaDir, { recursive: true });
await mkdir(artifactsDir, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: false,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});

const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
const extensionId = new URL(worker.url()).host;
const page = await context.newPage();

async function waitReady() {
  await page.bringToFront();
  await expectReady();
}

async function expectReady() {
  for (let i = 0; i < 50; i++) {
    const ready = await worker.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tab?.id) return false;
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'agentic-mouse/ping' });
        return response?.ready === true;
      } catch {
        return false;
      }
    });
    if (ready) return;
    await page.waitForTimeout(100);
  }
  throw new Error('content script not ready');
}

async function pinActions() {
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('tab', { name: 'Menu' }).click();
  for (const label of ['Extract', 'Compare', 'Track']) {
    const add = popup.getByRole('button', { name: `Add ${label}` });
    if (await add.count()) await add.click();
  }
  await popup.screenshot({
    path: join(mediaDir, 'ws-c-popup-pinned.png'),
    type: 'png',
  });
  await copyFile(
    join(mediaDir, 'ws-c-popup-pinned.png'),
    join(artifactsDir, 'ws-c-popup-pinned.png'),
  );
  await popup.close();
}

await pinActions();

await page.goto(`http://127.0.0.1:${port}/products.html`);
await waitReady();
await page.locator('#lamp').click({ button: 'right', modifiers: ['Shift'] });
await page.getByTestId('agentic-mouse-menu').waitFor({ state: 'visible' });
await page.getByRole('menuitem', { name: /Extract/ }).click();
await page.getByTestId('agentic-mouse-result').waitFor({ state: 'visible' });
await page.screenshot({ path: join(mediaDir, 'ws-c-extract-table.png'), type: 'png' });
await copyFile(
  join(mediaDir, 'ws-c-extract-table.png'),
  join(artifactsDir, 'ws-c-extract-table.png'),
);

await page.reload();
await waitReady();
await page.locator('#stand').click({ button: 'right', modifiers: ['Shift'] });
await page.getByRole('menuitem', { name: /Compare/ }).click();
await page.getByTestId('compare-table').waitFor({ state: 'visible' });
await page.screenshot({ path: join(mediaDir, 'ws-c-compare-table.png'), type: 'png' });
await copyFile(
  join(mediaDir, 'ws-c-compare-table.png'),
  join(artifactsDir, 'ws-c-compare-table.png'),
);

await page.goto(`http://127.0.0.1:${port}/product-track.html`);
await waitReady();
await page.locator('#title').click({ button: 'right', modifiers: ['Shift'] });
await page.getByRole('menuitem', { name: /Track/ }).click();
await page.getByTestId('tracking-result').waitFor({ state: 'visible' });
await page.screenshot({ path: join(mediaDir, 'ws-c-track-created.png'), type: 'png' });
await copyFile(
  join(mediaDir, 'ws-c-track-created.png'),
  join(artifactsDir, 'ws-c-track-created.png'),
);

await context.close();
server.close();
console.log('wrote ws-c screenshots to', mediaDir);
