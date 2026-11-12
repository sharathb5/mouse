import {
  expect,
  menu,
  menuHost,
  openFixture,
  pageEvents,
  rightClick,
  tabIdOf,
  test,
} from './extension';

test.describe('context menu gesture', () => {
  test.beforeEach(async ({ serviceWorker, page }) => {
    await openFixture(serviceWorker, page);
  });

  test('Shift + right-click opens the menu with default actions in order', async ({
    page,
  }, testInfo) => {
    await rightClick(page, page.locator('#intro'), { shift: true });

    await expect(menu(page)).toBeVisible();
    const items = menu(page).getByRole('menuitem');
    await expect(items).toHaveText([/Explain This/, /Select Content/, /Send to Agent/]);
    await expect(items.nth(0)).toHaveAttribute('data-availability', 'coming-soon');
    await expect(items.nth(1)).toHaveAttribute('data-availability', 'coming-soon');
    await expect(items.nth(2)).toHaveAttribute('data-availability', 'available');
    await expect(page.getByTestId('agentic-mouse-target')).toHaveText('Page content');

    // The page never saw the event: the extension consumed it.
    expect((await pageEvents(page)).contextmenu).toEqual([]);

    const latency = await menu(page).getAttribute('data-open-latency-ms');
    expect(Number(latency)).toBeGreaterThanOrEqual(0);
    testInfo.annotations.push({ type: 'menu.open latency (ms)', description: String(latency) });
  });

  test('normal right-click is left to the page and Chrome', async ({ page }) => {
    await rightClick(page, page.locator('#intro'));

    await expect(menuHost(page)).toHaveCount(0);
    expect((await pageEvents(page)).contextmenu).toEqual([
      { shiftKey: false, defaultPrevented: false },
    ]);
  });

  test('normal right-click while the menu is open closes it and stays native', async ({ page }) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    await expect(menu(page)).toBeVisible();

    await rightClick(page, page.locator('#third'));
    await expect(menuHost(page)).toHaveCount(0);
    expect((await pageEvents(page)).contextmenu).toEqual([
      { shiftKey: false, defaultPrevented: false },
    ]);
  });

  test('Escape closes the menu without leaking the key to the page', async ({ page }) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    await expect(menu(page)).toBeVisible();
    await expect(menu(page).getByRole('menuitem').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menuHost(page)).toHaveCount(0);
    expect((await pageEvents(page)).keydowns).not.toContain('Escape');
  });

  test('clicking outside closes the menu and the click still reaches the page', async ({
    page,
  }) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    await expect(menu(page)).toBeVisible();

    await page.locator('h1').click();
    await expect(menuHost(page)).toHaveCount(0);
    expect((await pageEvents(page)).clicks).toBe(1);
  });

  test('clicking a coming-soon action explains instead of executing', async ({ page }) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    // Playwright treats aria-disabled as non-actionable, but users can still click it.
    await menu(page)
      .getByRole('menuitem', { name: /Explain This/ })
      .click({ force: true });

    await expect(menu(page)).toBeVisible();
    await expect(page.getByTestId('agentic-mouse-status')).toHaveText(
      /Explain This isn't available yet/,
    );
    expect((await pageEvents(page)).clicks).toBe(0);
  });

  test('keyboard navigation moves between items', async ({ page }) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    const items = menu(page).getByRole('menuitem');
    await expect(items.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.nth(2)).toBeFocused();
    // Only the Shift used for the gesture reaches the page; menu keys stay in the Shadow DOM.
    expect((await pageEvents(page)).keydowns).toEqual(['Shift']);
  });

  test('Shift + right-click does not extend or clear the page selection', async ({ page }) => {
    const intro = page.locator('#intro');
    const selectionText = () => page.evaluate(() => window.getSelection()?.toString() ?? '');

    // A caret from an earlier click must not turn into a Shift-extended selection.
    await intro.click({ position: { x: 20, y: 10 } });
    await rightClick(page, page.locator('#third'), { shift: true });
    await expect(menu(page)).toBeVisible();
    expect(await selectionText()).toBe('');
    await expect(page.getByTestId('agentic-mouse-target')).toHaveText('Page content');
    await page.keyboard.press('Escape');

    // An existing selection is preserved, so actions can use it.
    await intro.dblclick({ position: { x: 20, y: 10 } });
    const selected = await selectionText();
    expect(selected.trim().length).toBeGreaterThan(0);
    await rightClick(page, page.locator('#third'), { shift: true });
    await expect(page.getByTestId('agentic-mouse-target')).toHaveText('Selected text');
    expect(await selectionText()).toBe(selected);
  });

  test('opens on links and does not follow them', async ({ page }) => {
    await rightClick(page, page.locator('#docs-link'), { shift: true });
    await expect(menu(page)).toBeVisible();
    await expect(page.getByTestId('agentic-mouse-target')).toHaveText('Link');
    expect(page.url()).toContain('/article.html');
  });

  test('menu stays inside the viewport near every edge', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('viewport required');
    const points = [
      { x: viewport.width - 3, y: viewport.height - 3 },
      { x: 3, y: viewport.height - 3 },
      { x: viewport.width - 3, y: 3 },
      { x: 3, y: 3 },
      { x: viewport.width / 2, y: viewport.height / 2 },
    ];
    for (const point of points) {
      await rightClick(page, point, { shift: true });
      await expect(menu(page)).toBeVisible();
      const box = await menu(page).boundingBox();
      if (!box) throw new Error('menu has no box');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      await page.keyboard.press('Escape');
      await expect(menuHost(page)).toHaveCount(0);
    }
  });

  test('scrolling the page closes the menu', async ({ page }) => {
    await rightClick(page, page.locator('#intro'), { shift: true });
    await expect(menu(page)).toBeVisible();
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollBy(0, 200);
    });
    await expect(menuHost(page)).toHaveCount(0);
  });

  test('the fallback-shortcut message opens the menu', async ({ page, serviceWorker }) => {
    // Pressing the real command shortcut needs a native key binding Playwright cannot
    // exercise; this covers the background -> content script path the command uses.
    const tabId = await tabIdOf(serviceWorker, page);
    const response: unknown = await serviceWorker.evaluate(
      (id) =>
        chrome.tabs.sendMessage<unknown, unknown>(id, {
          type: 'agentic-mouse/open-menu',
          source: 'shortcut',
        }),
      tabId,
    );
    expect(response).toEqual({ opened: true });
    await expect(menu(page)).toBeVisible();
    await expect(menu(page)).toHaveAttribute('data-source', 'shortcut');
  });
});

test('host page CSS cannot hide or restyle the menu', async ({ page, serviceWorker }) => {
  await openFixture(serviceWorker, page, 'hostile.html');
  await rightClick(page, page.locator('#target'), { shift: true });

  await expect(menu(page)).toBeVisible();
  const items = menu(page).getByRole('menuitem');
  await expect(items).toHaveCount(3);
  for (const item of await items.all()) await expect(item).toBeVisible();

  const styles = await items.first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, color: s.color, display: s.display };
  });
  expect(styles.fontSize).toBe('13px');
  expect(styles.color).not.toBe('rgb(255, 0, 0)');
  expect(styles.display).toBe('flex');

  const box = await menu(page).boundingBox();
  expect(box?.width).toBe(232);
});
