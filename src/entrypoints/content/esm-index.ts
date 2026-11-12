import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createMenuController } from '@/content/menu-controller';
import { createShellActionRegistry } from '@/content/shell-registry';

/**
 * ESM content-script entry (code-split). Loaded by the tiny IIFE loader via
 * `browser.runtime.getURL('/content-scripts/esm/content.js')`.
 */
export default async function startContentScript(ctx: ContentScriptContext): Promise<void> {
  await createMenuController(ctx, createShellActionRegistry()).start();
}
