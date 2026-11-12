import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';

/**
 * Tiny IIFE loader. The real content-script app lives in the ESM build under
 * `content-scripts/esm/` so React panels and consumer actions can be lazy chunks.
 */
export default defineContentScript({
  // Keep in sync with core/page-support.ts. Top frame only: the menu is a page-level UI.
  matches: ['http://*/*', 'https://*/*'],
  allFrames: false,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    const href = browser.runtime.getURL('/content-scripts/esm/content.js' as never);
    // @vite-ignore — resolved at runtime from the extension package, not the IIFE graph.
    const mod = (await import(/* @vite-ignore */ href)) as {
      default: (context: ContentScriptContext) => Promise<void>;
    };
    await mod.default(ctx);
  },
});
