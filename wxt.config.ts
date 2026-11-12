import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Explicit imports keep module boundaries visible to reviewers and agents.
  imports: false,
  manifest: {
    name: 'Agentic Mouse',
    description: 'Right-click anything. Understand it, act on it, or delegate it.',
    // Keep permissions minimal. Host access comes only from the content script
    // match patterns (http/https pages), which the gesture listener requires.
    // alarms: poll Cursor Cloud Agent task status while the service worker sleeps.
    // notifications: one completion/failure toast per task.
    permissions: ['storage', 'alarms', 'notifications'],
    // Requested at connect/configure time from the popup — not granted up front.
    optional_host_permissions: ['https://api.cursor.com/*', 'https://openrouter.ai/*'],
    action: {
      default_title: 'Agentic Mouse',
    },
    commands: {
      'open-agentic-mouse': {
        suggested_key: {
          default: 'Alt+Shift+M',
          mac: 'Alt+Shift+M',
        },
        description: 'Open the Agentic Mouse menu (fallback for Shift + right-click)',
      },
    },
  },
  webExt: {
    // `wxt dev` opens a browser by default; keep it opt-in for headless/CI machines.
    disabled: true,
  },
});
