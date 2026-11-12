import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI);
export const FIXTURE_PORT = Number(process.env.FIXTURE_PORT ?? 4321);

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // Each test launches its own Chromium with the unpacked extension.
  fullyParallel: true,
  ...(isCI ? { workers: 2 } : {}),
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tests/e2e/fixtures/serve.mjs',
    url: `http://127.0.0.1:${FIXTURE_PORT}/health`,
    reuseExistingServer: !isCI,
    env: { FIXTURE_PORT: String(FIXTURE_PORT) },
  },
});
