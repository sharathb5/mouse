import type {
  ContentScriptMessage,
  ExtractSnapshotResponse,
  OpenMenuResponse,
  PingResponse,
} from '@/core/contracts';

export type ContentScriptResponse = PingResponse | OpenMenuResponse | ExtractSnapshotResponse;

/**
 * Validates extension→content messages without Zod. Pages cannot send these; this still
 * guards against malformed extension payloads on the hot path.
 */
export function parseContentScriptMessage(message: unknown): ContentScriptMessage | null {
  if (typeof message !== 'object' || message === null) return null;
  const record = message as Record<string, unknown>;
  switch (record.type) {
    case 'agentic-mouse/ping':
      return { type: 'agentic-mouse/ping' };
    case 'agentic-mouse/open-menu':
      if (record.source !== 'shortcut') return null;
      return { type: 'agentic-mouse/open-menu', source: 'shortcut' };
    case 'agentic-mouse/extract-snapshot':
      return { type: 'agentic-mouse/extract-snapshot' };
    default:
      return null;
  }
}
