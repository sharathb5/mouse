import { expect, openPopup, test } from './extension';

const now = '2026-11-12T04:00:00.000Z';

function seedTasks() {
  return [
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
          condition: { kind: 'price-change' },
          context: {
            untrusted: true,
            source: {
              url: 'https://example.com/b',
              title: 'Monitor page',
              capturedAt: now,
              frame: 'top',
            },
            target: { kind: 'page', blocks: [{ type: 'paragraph', text: 'B' }] },
            page: { kind: 'generic', confidence: 0, signals: [] },
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
      title: 'Sleeping monitor',
    },
    {
      request: {
        id: 'task_done',
        createdAt: now,
        approval: { kind: 'explicit', approvedAt: now },
        executor: { kind: 'extension' },
        input: {
          actionId: 'send-to-agent',
          destinationId: 'clipboard',
          context: {
            untrusted: true,
            source: {
              url: 'https://example.com/c',
              title: 'Done page',
              capturedAt: now,
              frame: 'top',
            },
            target: { kind: 'page', blocks: [{ type: 'paragraph', text: 'C' }] },
            page: { kind: 'generic', confidence: 0, signals: [] },
            containsSensitiveData: false,
          },
        },
      },
      state: {
        status: 'completed',
        completedAt: now,
        result: {
          kind: 'handoff',
          destinationId: 'clipboard',
          outcome: { mode: 'copied' },
        },
      },
      updatedAt: now,
      title: 'Completed demo',
    },
  ];
}

test('inbox renders seeded task states and walking cat modes', async ({
  context,
  serviceWorker,
  extensionId,
}) => {
  await serviceWorker.evaluate(async (tasks) => {
    await chrome.storage.local.set({ tasks: { version: 1, tasks } });
    await chrome.action.setBadgeText({ text: '2' });
  }, seedTasks());

  const popup = await openPopup(context, extensionId);
  await expect(popup.getByTestId('inbox-list')).toBeVisible();
  const items = popup.getByTestId('inbox-item');
  await expect(items).toHaveCount(3);
  await expect(popup.locator('[data-status="running"]')).toBeVisible();
  await expect(popup.locator('[data-status="monitoring"]')).toBeVisible();
  await expect(popup.locator('[data-status="completed"]')).toBeVisible();

  await expect(popup.locator('[data-inbox-kind="agent"]')).toBeVisible();
  await expect(popup.locator('[data-inbox-kind="track"]')).toBeVisible();
  await expect(popup.locator('[data-action-id="track"] [data-testid="inbox-kind"]')).toHaveText(
    'Track',
  );
  await expect(
    popup.locator('[data-action-id="track"] [data-testid="inbox-detail"]'),
  ).toContainText(/price|availability|Alert/i);
  await expect(popup.getByRole('button', { name: 'Open tracked page' })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Stop tracking' })).toBeVisible();

  await expect(
    popup.locator('[data-status="running"] [data-testid="walking-cat"]'),
  ).toHaveAttribute('data-mode', 'determinate');
  await expect(
    popup.locator('[data-status="monitoring"] [data-testid="walking-cat"]'),
  ).toHaveAttribute('data-mode', 'sleeping');

  const badge = await serviceWorker.evaluate(async () => chrome.action.getBadgeText({}));
  expect(badge).toBe('2');
});

test('agents panel exposes Cursor key status without revealing secrets', async ({
  context,
  extensionId,
}) => {
  const popup = await openPopup(context, extensionId);
  await popup.getByRole('tab', { name: 'Agents' }).click();
  await expect(popup.getByTestId('destinations-panel')).toBeVisible();
  await expect(popup.getByTestId('cursor-key-status')).toContainText('Not configured');
  await expect(popup.getByTestId('cursor-api-key')).toHaveAttribute('type', 'password');
});
