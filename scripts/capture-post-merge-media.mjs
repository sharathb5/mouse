/**
 * Captures post-merge integration screenshots against the built extension.
 * Run after `pnpm build`. Writes media/post-merge-* and /opt/cursor/artifacts copies.
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

async function save(name) {
  const dest = join(mediaDir, name);
  await copyFile(dest, join(artifactsDir, name));
  console.log('saved', name);
}

const now = '2026-11-12T04:00:00.000Z';
await worker.evaluate(async (tasks) => {
  await chrome.storage.local.set({ tasks: { version: 1, tasks } });
  await chrome.action.setBadgeText({ text: '2' });
}, [
  {
    request: {
      id: 'task_running',
      createdAt: now,
      approval: { kind: 'explicit', approvedAt: now },
      executor: {
        kind: 'agent',
        destination: {
          id: 'cursor-default',
          label: 'Cursor Cloud Agent',
          isDefault: true,
          integration: 'cursor-cloud-agent',
          capability: 'background-execution',
          repository: 'github.com/sharathb5/mouse',
        },
      },
      input: {
        actionId: 'send-to-agent',
        destinationId: 'cursor-default',
        context: {
          untrusted: true,
          source: {
            url: 'https://example.com/a',
            title: 'Running page',
            capturedAt: now,
            frame: 'top',
          },
          target: { kind: 'page', blocks: [{ type: 'paragraph', text: 'A' }] },
          page: { kind: 'generic', confidence: 0, signals: [] },
          containsSensitiveData: false,
        },
      },
    },
    state: {
      status: 'running',
      progress: { mode: 'determinate', fraction: 0.4, label: 'Working' },
      updates: [{ at: now, message: 'Agent working…' }],
    },
    updatedAt: now,
    title: 'Running demo',
    external: {
      id: 'bc-demo',
      runId: 'run-demo',
      url: 'https://cursor.com/agents/bc-demo',
    },
  },
  {
    request: {
      id: 'task_monitoring',
      createdAt: now,
      approval: { kind: 'not-required' },
      executor: { kind: 'extension' },
      input: {
        actionId: 'track',
        condition: { kind: 'price-below', threshold: { amount: 70, currency: 'USD' } },
        context: {
          untrusted: true,
          source: {
            url: 'https://example.com/b',
            title: 'Cedar Desk Lamp',
            capturedAt: now,
            frame: 'top',
          },
          target: {
            kind: 'element',
            element: { kind: 'unknown', confidence: 0.5, signals: [], sensitive: false },
            text: 'Cedar Desk Lamp — $79',
            blocks: [{ type: 'paragraph', text: 'Cedar Desk Lamp — $79' }],
          },
          page: { kind: 'product', confidence: 0.8, signals: [] },
          containsSensitiveData: false,
        },
      },
    },
    state: {
      status: 'monitoring',
      nextCheckAt: '2026-11-12T05:00:00.000Z',
      paused: false,
    },
    updatedAt: now,
    title: 'Track · Cedar Desk Lamp',
  },
]);

const popup = await context.newPage();
await popup.setViewportSize({ width: 360, height: 640 });
await popup.goto(`chrome-extension://${extensionId}/popup.html`);
await popup.getByTestId('inbox-list').waitFor();
await popup.screenshot({ path: join(mediaDir, 'post-merge-inbox-unified.png'), type: 'png' });
await save('post-merge-inbox-unified.png');
await popup.close();

const pinPopup = await context.newPage();
await pinPopup.setViewportSize({ width: 360, height: 600 });
await pinPopup.goto(`chrome-extension://${extensionId}/popup.html`);
await pinPopup.getByRole('tab', { name: 'Menu' }).click();
for (const label of ['Extract', 'Compare', 'Track']) {
  const add = pinPopup.getByRole('button', { name: `Add ${label}` });
  if (await add.count()) await add.click();
}
await pinPopup.close();

await page.goto(`http://127.0.0.1:${port}/products.html`);
await expectReady();
await page.locator('#lamp').click({ button: 'right', modifiers: ['Shift'] });
await page.getByTestId('agentic-mouse-menu').waitFor();
await page.getByRole('menuitem', { name: /Extract/ }).click();
await page.getByTestId('agentic-mouse-result').waitFor();
await page.screenshot({
  path: join(mediaDir, 'post-merge-extract-scoped.png'),
  type: 'png',
});
await save('post-merge-extract-scoped.png');

await page.goto(`http://127.0.0.1:${port}/products.html`);
await expectReady();
await page.locator('#stand').click({ button: 'right', modifiers: ['Shift'] });
await page.getByTestId('agentic-mouse-menu').waitFor();
await page.getByRole('menuitem', { name: /Send to Agent/ }).click();
await page.getByTestId('send-to-agent-dialog').waitFor({ timeout: 5000 }).catch(() => null);
const sendHost = page.locator('agentic-mouse-ui');
await sendHost.waitFor({ state: 'attached' });
await page.waitForTimeout(300);
await page.screenshot({
  path: join(mediaDir, 'post-merge-send-selection.png'),
  type: 'png',
});
await save('post-merge-send-selection.png');

await context.close();
server.close();
console.log('done');
