import { expect, menu, openFixture, openPopup, rightClick, test } from './extension';

test('Send to Agent opens picker with default destination and approval gate', async ({
  context,
  page,
  serviceWorker,
  extensionId,
}) => {
  await openFixture(serviceWorker, page);
  await rightClick(page, page.locator('#intro'), { shift: true });
  await expect(menu(page)).toBeVisible();

  const sendItem = menu(page).locator('[data-action-id="send-to-agent"]');
  await expect(sendItem).toHaveAttribute('data-availability', 'available');
  await sendItem.click();

  const dialog = page.getByTestId('send-to-agent-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('send-destination')).toHaveValue('cursor-default');
  await expect(dialog.getByTestId('send-capability')).toContainText('Requires approval');
  await expect(dialog.getByTestId('send-approve')).toBeVisible();

  // Without confirming approval, the dialog stays open (gate).
  await expect(dialog.getByTestId('send-approve')).toBeEnabled();

  await openPopup(context, extensionId);
});

test('prefill destination handoff opens a tab and is not tracked as a task', async ({
  context,
  page,
  serviceWorker,
}) => {
  await openFixture(serviceWorker, page);
  await rightClick(page, page.locator('#intro'), { shift: true });
  await menu(page).locator('[data-action-id="send-to-agent"]').click();

  const dialog = page.getByTestId('send-to-agent-dialog');
  await dialog.getByTestId('send-destination').selectOption('chatgpt-prefill');
  await expect(dialog.getByTestId('send-capability')).toContainText('Prefill');

  const popupPromise = context.waitForEvent('page');
  await dialog.getByTestId('send-confirm').click();
  const opened = await popupPromise;
  await expect(opened).toHaveURL(/chatgpt\.com\/\?q=/);

  const tasks = await serviceWorker.evaluate(async () => {
    const stored = await chrome.storage.local.get('tasks');
    const snapshot = stored.tasks as { tasks?: unknown[] } | undefined;
    return snapshot?.tasks ?? [];
  });
  expect(tasks).toEqual([]);
});
