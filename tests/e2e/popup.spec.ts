import {
  expect,
  launchWithExtension,
  menu,
  menuHost,
  openFixture,
  openPopup,
  pageEvents,
  rightClick,
  serviceWorkerOf,
  tabIdOf,
  test,
} from './extension';

test('toolbar toggle turns interception off and on instantly', async ({
  context,
  page,
  serviceWorker,
  extensionId,
}) => {
  await openFixture(serviceWorker, page);
  const popup = await openPopup(context, extensionId);
  const toggle = popup.getByTestId('enabled-toggle');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(popup.getByTestId('popup-subtitle')).toHaveText(/Off/);

  // The already-open page picks up the change without a reload.
  await page.bringToFront();
  await rightClick(page, page.locator('#intro'), { shift: true });
  await expect(menuHost(page)).toHaveCount(0);
  expect((await pageEvents(page)).contextmenu).toEqual([
    { shiftKey: true, defaultPrevented: false },
  ]);

  await popup.bringToFront();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await page.bringToFront();
  await rightClick(page, page.locator('#intro'), { shift: true });
  await expect(menu(page)).toBeVisible();
});

test('reversed mode opens on right-click and leaves Shift + right-click native', async ({
  context,
  page,
  serviceWorker,
  extensionId,
}) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole('tab', { name: 'Settings' }).click();
  await popup.getByRole('radio', { name: /^Right-click/ }).check();
  await expect(popup.getByTestId('popup-subtitle')).toHaveText(/Right-click to open/);

  await openFixture(serviceWorker, page);
  await rightClick(page, page.locator('#intro'));
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');

  await rightClick(page, page.locator('#intro'), { shift: true });
  await expect(menuHost(page)).toHaveCount(0);
  expect((await pageEvents(page)).contextmenu).toEqual([
    { shiftKey: true, defaultPrevented: false },
  ]);
});

test('pinned actions can be customized and the menu follows', async ({
  context,
  page,
  serviceWorker,
  extensionId,
}) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole('tab', { name: 'Menu' }).click();
  const rows = popup.getByTestId('pinned-list').locator('li');
  await expect(rows).toHaveText([/Explain This/, /Select Content/, /Send to Agent/]);

  await popup.getByRole('button', { name: 'Remove Select Content' }).click();
  await popup.getByRole('button', { name: 'Add Summarize' }).click();
  await popup.getByRole('button', { name: 'Move Summarize up' }).click();
  await expect(rows).toHaveText([/Explain This/, /Summarize/, /Send to Agent/]);

  await openFixture(serviceWorker, page);
  await rightClick(page, page.locator('#intro'), { shift: true });
  await expect(menu(page).getByRole('menuitem')).toHaveText([
    /Explain This/,
    /Summarize/,
    /Send to Agent/,
  ]);

  await popup.bringToFront();
  await popup.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(rows).toHaveText([/Explain This/, /Select Content/, /Send to Agent/]);
});

// `chrome.runtime.reload()` unloads command-line-loaded extensions in Chromium automation
// instead of reloading them, so this restarts the whole browser on the same profile. That
// reloads the extension from scratch (new service worker, new content scripts) and also
// proves persistence across a browser restart.
// eslint-disable-next-line no-empty-pattern
test('settings persist after the extension reloads', async ({}, testInfo) => {
  const profile = testInfo.outputPath('profile');

  const first = await launchWithExtension(profile);
  const extensionId = new URL((await serviceWorkerOf(first)).url()).host;
  const popup = await openPopup(first, extensionId);
  await popup.getByRole('tab', { name: 'Menu' }).click();
  await popup.getByRole('button', { name: 'Move Send to Agent up' }).click();
  await popup.getByTestId('enabled-toggle').click();
  await expect(popup.getByTestId('enabled-toggle')).toHaveAttribute('aria-checked', 'false');
  await expect(popup.getByTestId('pinned-list').locator('li')).toHaveText([
    /Explain This/,
    /Send to Agent/,
    /Select Content/,
  ]);
  await first.close();

  const second = await launchWithExtension(profile);
  try {
    const worker = await serviceWorkerOf(second);
    expect(new URL(worker.url()).host).toBe(extensionId);

    const reopened = await openPopup(second, extensionId);
    await expect(reopened.getByTestId('enabled-toggle')).toHaveAttribute('aria-checked', 'false');
    await reopened.getByRole('tab', { name: 'Menu' }).click();
    await expect(reopened.getByTestId('pinned-list').locator('li')).toHaveText([
      /Explain This/,
      /Send to Agent/,
      /Select Content/,
    ]);

    // Freshly injected content scripts honor the persisted disabled state.
    const page = await second.newPage();
    await openFixture(worker, page);
    await rightClick(page, page.locator('#intro'), { shift: true });
    await expect(menuHost(page)).toHaveCount(0);

    await reopened.bringToFront();
    await reopened.getByTestId('enabled-toggle').click();
    await page.bringToFront();
    await rightClick(page, page.locator('#intro'), { shift: true });
    await expect(menu(page).getByRole('menuitem')).toHaveText([
      /Explain This/,
      /Send to Agent/,
      /Select Content/,
    ]);
  } finally {
    await second.close();
  }
});

test('popup shows the placeholder inbox and page status', async ({
  context,
  page,
  serviceWorker,
  extensionId,
}) => {
  await openFixture(serviceWorker, page);
  const tabId = await tabIdOf(serviceWorker, page);
  const popup = await openPopup(context, extensionId, `?tabId=${tabId}`);

  await expect(popup.getByTestId('tab-status')).toHaveAttribute('data-state', 'active');
  await expect(popup.getByTestId('inbox-placeholder')).toContainText('No tasks yet');
  await expect(popup.getByTestId('inbox-placeholder')).toContainText(
    'Task execution is not available in this build',
  );

  await popup.getByRole('tab', { name: 'Settings' }).click();
  await expect(popup.getByTestId('fallback-shortcut')).toBeVisible();
});
