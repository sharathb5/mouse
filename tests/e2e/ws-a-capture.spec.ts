import type { Worker } from '@playwright/test';
import { expect, openFixture, openPopup, rightClick, menu, test } from './extension';

test.use({ video: 'on' });

async function useMockProvider(serviceWorker: Worker): Promise<void> {
  const mockSettings = {
    version: 1 as const,
    enabled: true,
    triggerMode: 'shift-right-click' as const,
    pinnedActionIds: ['explain', 'select-content', 'send-to-agent'],
    model: { providerId: 'mock' as const, modelId: 'mock-deterministic' },
  };
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

test('Workstream A media capture: outline, panel, settings', async ({
  serviceWorker,
  page,
  context,
  extensionId,
}, testInfo) => {
  await useMockProvider(serviceWorker);
  await openFixture(serviceWorker, page, 'article.html?cursor=1');

  await rightClick(page, page.locator('#intro'), { shift: true });
  await expect(menu(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('ws-a-menu-available.png'), fullPage: true });

  await menu(page)
    .getByRole('menuitem', { name: /Select Content/ })
    .click();
  await expect(page.locator('agentic-mouse-highlight').locator('.box')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('ws-a-select-outline.png'), fullPage: true });
  await page.getByTestId('agentic-mouse-expand').click();
  await page.screenshot({ path: testInfo.outputPath('ws-a-select-expanded.png'), fullPage: true });
  await page.getByTestId('agentic-mouse-selection-done').click();

  await rightClick(page, page.locator('#intro'), { shift: true });
  await menu(page)
    .getByRole('menuitem', { name: /Explain This/ })
    .click();
  await expect(page.getByTestId('agentic-mouse-panel-body')).toContainText('[MOCK]');
  await page.screenshot({ path: testInfo.outputPath('ws-a-explain-panel.png'), fullPage: true });

  const popup = await openPopup(context, extensionId);
  await popup.getByRole('tab', { name: 'Settings' }).click();
  await expect(popup.getByTestId('model-provider-panel')).toBeVisible();
  await popup.screenshot({ path: testInfo.outputPath('ws-a-settings-provider.png') });
});
