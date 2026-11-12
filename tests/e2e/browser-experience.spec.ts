import type { Worker } from '@playwright/test';
import { expect, menu, menuHost, openFixture, rightClick, test } from './extension';

async function useMockProvider(serviceWorker: Worker): Promise<void> {
  const mockSettings = {
    version: 1 as const,
    enabled: true,
    triggerMode: 'shift-right-click' as const,
    pinnedActionIds: ['explain', 'select-content', 'send-to-agent'],
    model: { providerId: 'mock' as const, modelId: 'mock-deterministic' },
  };
  // Install handlers can race a first write; keep setting until mock sticks.
  await expect
    .poll(async () => {
      await serviceWorker.evaluate(async (settings) => {
        await chrome.storage.local.set({ settings });
      }, mockSettings);
      return serviceWorker.evaluate(async () => {
        const stored = (await chrome.storage.local.get('settings')).settings as
          { model?: { providerId?: string } } | undefined;
        return stored?.model?.providerId ?? null;
      });
    })
    .toBe('mock');
}

test.describe('Workstream A browser experience', () => {
  test.beforeEach(async ({ serviceWorker, page }) => {
    await useMockProvider(serviceWorker);
    await openFixture(serviceWorker, page);
  });

  test('Select Content outlines the paragraph and expands to article', async ({
    page,
  }, testInfo) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    await menu(page)
      .getByRole('menuitem', { name: /Select Content/ })
      .click();

    await expect(menuHost(page)).toHaveCount(0);
    const outline = page.locator('agentic-mouse-highlight').locator('.box');
    await expect(outline).toHaveCount(1, { timeout: 5_000 });

    const introBox = await page.locator('#intro').boundingBox();
    const outlineBox = await outline.boundingBox();
    expect(introBox).toBeTruthy();
    expect(outlineBox).toBeTruthy();
    expect(Math.abs((outlineBox?.x ?? 0) - (introBox?.x ?? 0))).toBeLessThan(4);
    expect(Math.abs((outlineBox?.width ?? 0) - (introBox?.width ?? 0))).toBeLessThan(8);

    // #intro is a direct child of <article> on the fixture page (no intermediate section).
    await page.getByTestId('agentic-mouse-expand').click();
    const articleBox = await page.locator('article').boundingBox();
    const expanded = await outline.boundingBox();
    expect(articleBox).toBeTruthy();
    expect(expanded).toBeTruthy();
    expect(Math.abs((expanded?.height ?? 0) - (articleBox?.height ?? 0))).toBeLessThan(12);

    await page.screenshot({
      path: testInfo.outputPath('ws-a-outline.png'),
      fullPage: true,
    });

    // MutationObserver: page nodes outside our hosts must stay untouched.
    const foreignMutations = await page.evaluate(() => {
      const ignored = new Set([
        'AGENTIC-MOUSE-UI',
        'AGENTIC-MOUSE-HIGHLIGHT',
        'AGENTIC-MOUSE-PANEL',
        'AGENTIC-MOUSE-SELECTION-CHROME',
      ]);
      const hits: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of [...record.addedNodes, ...record.removedNodes]) {
            if (!(node instanceof Element)) continue;
            if (ignored.has(node.tagName)) continue;
            if (
              node.closest(
                'agentic-mouse-ui, agentic-mouse-highlight, agentic-mouse-panel, agentic-mouse-selection-chrome',
              )
            ) {
              continue;
            }
            hits.push(node.tagName);
          }
          if (
            record.target instanceof Element &&
            !ignored.has(record.target.tagName) &&
            !record.target.closest(
              'agentic-mouse-ui, agentic-mouse-highlight, agentic-mouse-panel, agentic-mouse-selection-chrome',
            )
          ) {
            hits.push(`attr:${record.target.tagName}`);
          }
        }
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
      });
      return new Promise<string[]>((resolve) => {
        setTimeout(() => {
          observer.disconnect();
          resolve(hits);
        }, 300);
      });
    });
    expect(foreignMutations).toEqual([]);

    await page.getByTestId('agentic-mouse-selection-done').click();
    await expect(page.locator('agentic-mouse-highlight').locator('.box')).toHaveCount(0);
  });

  test('Explain This streams from the mock provider into the inline panel (MOCKED)', async ({
    page,
  }, testInfo) => {
    const started = Date.now();
    await rightClick(page, page.locator('#intro'), { shift: true });
    await menu(page)
      .getByRole('menuitem', { name: /Explain This/ })
      .click();

    const panel = page.getByTestId('agentic-mouse-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('agentic-mouse-mock-badge')).toHaveText(/Mock/i);
    await expect(page.getByTestId('agentic-mouse-panel-body')).toContainText('[MOCK]', {
      timeout: 5_000,
    });
    const firstTokenMs = Date.now() - started;
    testInfo.annotations.push({
      type: 'inline.first-token mocked (ms)',
      description: String(firstTokenMs),
    });

    await page.screenshot({
      path: testInfo.outputPath('ws-a-panel-mock.png'),
      fullPage: true,
    });
  });

  test('pinned menu stays identical across article/product/github fixtures', async ({
    serviceWorker,
    page,
  }) => {
    for (const name of ['article.html', 'product.html', 'github-issue.html'] as const) {
      await openFixture(serviceWorker, page, name);
      await rightClick(page, page.locator('#intro'), { shift: true });
      const items = menu(page).getByRole('menuitem');
      await expect(items).toHaveText([/Explain This/, /Select Content/, /Send to Agent/]);
      await page.keyboard.press('Escape');
      await expect(menuHost(page)).toHaveCount(0);
    }
  });
});
