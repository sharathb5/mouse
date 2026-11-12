import { expect, menu, openFixture, openPopup, rightClick, test } from './extension';

interface TrackMutationResponse {
  ok: boolean;
  reason?: string;
}

interface TrackListResponse {
  ok: boolean;
  trackers: {
    id: string;
    conditionMet: boolean;
    lastSnapshot?: { price?: { amount: number } };
  }[];
}

interface TrackingTestApi {
  checkNow(trackerId: string): Promise<TrackMutationResponse>;
  list(): Promise<TrackListResponse>;
  pause(trackerId: string): Promise<TrackMutationResponse>;
  resume(trackerId: string): Promise<TrackMutationResponse>;
  cancel(trackerId: string): Promise<TrackMutationResponse>;
}

async function pinConsumerActions(extensionId: string, context: Parameters<typeof openPopup>[0]) {
  // Use the popup Menu tab so pinned actions go through the real settings path.
  const popup = await openPopup(context, extensionId);
  await popup.getByRole('tab', { name: 'Menu' }).click();
  for (const label of ['Extract', 'Compare', 'Track']) {
    const add = popup.getByRole('button', { name: `Add ${label}` });
    if (await add.count()) await add.click();
  }
  await expect(popup.getByTestId('pinned-list')).toContainText('Extract');
  await expect(popup.getByTestId('pinned-list')).toContainText('Compare');
  await expect(popup.getByTestId('pinned-list')).toContainText('Track');
  await popup.close();
}

test.describe('consumer actions', () => {
  test('Extract builds a table and downloads CSV on a product listing', async ({
    context,
    extensionId,
    serviceWorker,
    page,
  }) => {
    await pinConsumerActions(extensionId, context);
    await openFixture(serviceWorker, page, 'products.html');

    await rightClick(page, page.locator('#lamp'), { shift: true });
    await expect(menu(page)).toBeVisible();
    await menu(page)
      .getByRole('menuitem', { name: /Extract/ })
      .click();

    const result = page.getByTestId('agentic-mouse-result');
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('data-result-kind', 'table');
    const table = page.getByTestId('extract-table');
    await expect(table.getByRole('row')).toHaveCount(4); // header + 3 products
    await expect(table).toContainText('Cedar Desk Lamp');
    await expect(table).toContainText('Oak Monitor Stand');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('extract-download').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('Compare shows at least two grounded items on a product listing', async ({
    context,
    extensionId,
    serviceWorker,
    page,
  }) => {
    await pinConsumerActions(extensionId, context);
    await openFixture(serviceWorker, page, 'products.html');

    await rightClick(page, page.locator('#stand'), { shift: true });
    await menu(page)
      .getByRole('menuitem', { name: /Compare/ })
      .click();

    const result = page.getByTestId('agentic-mouse-result');
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('data-result-kind', 'comparison');
    await expect(page.getByTestId('compare-summary')).toContainText('Compared');
    const rows = page.getByTestId('compare-table').getByRole('row');
    await expect(rows).toHaveCount(4); // header + 3
    await expect(page.getByTestId('result-sources')).toBeVisible();
  });

  test('Track detects a price drop after a manual check-now', async ({
    context,
    extensionId,
    serviceWorker,
    page,
  }) => {
    await pinConsumerActions(extensionId, context);
    await openFixture(serviceWorker, page, 'product-track.html');

    await rightClick(page, page.locator('#title'), { shift: true });
    await menu(page).getByRole('menuitem', { name: /Track/ }).click();

    const result = page.getByTestId('agentic-mouse-result');
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute('data-result-kind', 'tracking');
    const trackerId = await page.getByTestId('tracker-id').innerText();
    expect(trackerId.length).toBeGreaterThan(3);

    // Simulate a price drop on the open tab, then trigger the tracker check.
    await page.evaluate(() => {
      (
        window as unknown as { __setTrackState: (state: { price: number }) => void }
      ).__setTrackState({ price: 70 });
    });

    // Drive checks via the SW-local test API (SW → SW runtime.sendMessage has no receiver).
    const check: TrackMutationResponse = await serviceWorker.evaluate(async (id) => {
      const api = (globalThis as typeof globalThis & { __agenticMouseTracking?: TrackingTestApi })
        .__agenticMouseTracking;
      if (!api) throw new Error('tracking test API missing');
      return api.checkNow(id);
    }, trackerId);
    expect(check).toMatchObject({ ok: true });

    const listed: TrackListResponse = await serviceWorker.evaluate(async () => {
      const api = (globalThis as typeof globalThis & { __agenticMouseTracking?: TrackingTestApi })
        .__agenticMouseTracking;
      if (!api) throw new Error('tracking test API missing');
      return api.list();
    });
    const tracker = listed.trackers.find((entry) => entry.id === trackerId);
    expect(tracker?.conditionMet).toBe(true);
    expect(tracker?.lastSnapshot?.price?.amount).toBe(70);

    // Pause / resume / cancel controls.
    const pause: TrackMutationResponse = await serviceWorker.evaluate(async (id) => {
      const api = (globalThis as typeof globalThis & { __agenticMouseTracking?: TrackingTestApi })
        .__agenticMouseTracking;
      if (!api) throw new Error('tracking test API missing');
      return api.pause(id);
    }, trackerId);
    expect(pause).toMatchObject({ ok: true });
    const resume: TrackMutationResponse = await serviceWorker.evaluate(async (id) => {
      const api = (globalThis as typeof globalThis & { __agenticMouseTracking?: TrackingTestApi })
        .__agenticMouseTracking;
      if (!api) throw new Error('tracking test API missing');
      return api.resume(id);
    }, trackerId);
    expect(resume).toMatchObject({ ok: true });
    const cancel: TrackMutationResponse = await serviceWorker.evaluate(async (id) => {
      const api = (globalThis as typeof globalThis & { __agenticMouseTracking?: TrackingTestApi })
        .__agenticMouseTracking;
      if (!api) throw new Error('tracking test API missing');
      return api.cancel(id);
    }, trackerId);
    expect(cancel).toMatchObject({ ok: true });
  });
});
