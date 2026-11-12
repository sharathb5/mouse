/**
 * Captures Compare/Sheets adapter demo screenshots against the built extension.
 * Run after `pnpm build`. Writes compare-sheets-* under the Project media store.
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
  await popup.setViewportSize({ width: 360, height: 640 });
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('tab', { name: 'Menu' }).click();
  for (const label of ['Extract', 'Compare']) {
    const add = popup.getByRole('button', { name: `Add ${label}` });
    if (await add.count()) await add.click();
  }
  await popup.getByRole('tab', { name: 'Settings' }).click();
  await popup.getByTestId('sheets-export-panel').waitFor();
  const settingsShot = join(mediaDir, 'compare-sheets-settings.png');
  await popup.screenshot({ path: settingsShot, fullPage: true });
  await copyFile(settingsShot, join(artifactsDir, 'compare-sheets-settings.png'));
  await popup.close();
}

async function rightClick(locator) {
  await locator.click({ button: 'right', modifiers: ['Shift'] });
}

async function save(name) {
  const dest = join(mediaDir, name);
  await page.screenshot({ path: dest });
  await copyFile(dest, join(artifactsDir, name));
}

try {
  await pinActions();

  await page.goto(`http://127.0.0.1:${port}/products.html`);
  await expectReady();
  await rightClick(page.locator('#lamp'));
  await page.getByRole('menuitem', { name: /Extract/ }).click();
  await page.getByTestId('agentic-mouse-result').waitFor();
  await page.getByTestId('extract-sheets').waitFor();
  await save('compare-sheets-extract-unavailable.png');
  await page.getByTestId('result-dismiss').click();

  await rightClick(page.locator('#stand'));
  await page.getByRole('menuitem', { name: /Compare/ }).click();
  await page.getByTestId('compare-table').waitFor();
  await save('compare-sheets-compare-local.png');

  console.log('Wrote compare-sheets-* media');
} finally {
  await context.close();
  server.close();
}
