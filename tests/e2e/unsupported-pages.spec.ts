import { expect, menuHost, openPopup, rightClick, tabIdOf, test } from './extension';

const UNSUPPORTED = ['chrome://version/', 'about:blank', 'data:text/html,<p id="x">data url</p>'];

for (const url of UNSUPPORTED) {
  test(`fails gracefully on ${url.slice(0, 24)}`, async ({
    context,
    page,
    serviceWorker,
    extensionId,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    await rightClick(page, { x: 200, y: 200 }, { shift: true });
    await expect(menuHost(page)).toHaveCount(0);

    const tabId = await tabIdOf(serviceWorker, page);
    // The shortcut path must not throw when no content script exists.
    const outcome = await serviceWorker.evaluate(async (id) => {
      try {
        await chrome.tabs.sendMessage(id, { type: 'agentic-mouse/open-menu', source: 'shortcut' });
        return 'delivered';
      } catch {
        return 'no-receiver';
      }
    }, tabId);
    expect(outcome).toBe('no-receiver');

    const popup = await openPopup(context, extensionId, `?tabId=${tabId}`);
    await expect(popup.getByTestId('tab-status')).toHaveAttribute('data-state', 'unsupported');
    await expect(popup.getByTestId('tab-status')).toContainText('Not available on this page');
    expect(errors).toEqual([]);
  });
}

test('popup opened as its own page reports extension pages as unsupported', async ({
  context,
  extensionId,
}) => {
  const popup = await openPopup(context, extensionId);
  await expect(popup.getByTestId('tab-status')).toHaveAttribute('data-state', 'unsupported');
  await expect(popup.getByTestId('tab-status')).toContainText('Extension pages are protected');
});
