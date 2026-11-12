import { z } from 'zod';

/** Manifest command name for the fallback keyboard shortcut (see wxt.config.ts). */
export const OPEN_MENU_COMMAND = 'open-agentic-mouse';

/**
 * Extension-internal messages (background/popup -> content script). Webpages cannot send
 * these, but every receiver still validates payloads before acting on them.
 */
export const ContentScriptMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agentic-mouse/ping') }),
  z.object({
    type: z.literal('agentic-mouse/open-menu'),
    source: z.enum(['shortcut']),
  }),
]);
export type ContentScriptMessage = z.infer<typeof ContentScriptMessageSchema>;

export const PingResponseSchema = z.object({
  ok: z.literal(true),
  /** Settings and the Shadow DOM UI are loaded, so gestures will be handled. */
  ready: z.boolean(),
  menuOpen: z.boolean(),
});
export type PingResponse = z.infer<typeof PingResponseSchema>;

export const OpenMenuResponseSchema = z.object({ opened: z.boolean() });
export type OpenMenuResponse = z.infer<typeof OpenMenuResponseSchema>;
