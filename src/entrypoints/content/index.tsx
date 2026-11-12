import { defineContentScript } from 'wxt/utils/define-content-script';
import { createMenuController } from '@/content/menu-controller';
import '@/actions/send-to-agent/send.css';
import '@/content/menu/menu.css';

export default defineContentScript({
  // Keep in sync with core/page-support.ts. Top frame only: the menu is a page-level UI.
  matches: ['http://*/*', 'https://*/*'],
  allFrames: false,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  async main(ctx) {
    await createMenuController(ctx).start();
  },
});
