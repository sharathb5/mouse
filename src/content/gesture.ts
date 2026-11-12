import type { Settings } from '@/core/contracts';

export type ContextMenuDecision = 'agentic-mouse' | 'native';

/**
 * Decides who handles a `contextmenu` event. Runs synchronously in the gesture path, so it
 * must stay trivial. When settings are not loaded yet we fail open to the native menu.
 */
export function decideContextMenu(
  event: Pick<MouseEvent, 'shiftKey'>,
  settings: Pick<Settings, 'enabled' | 'triggerMode'> | null,
): ContextMenuDecision {
  if (!settings?.enabled) return 'native';
  const wantsAgenticMouse =
    settings.triggerMode === 'shift-right-click' ? event.shiftKey : !event.shiftKey;
  return wantsAgenticMouse ? 'agentic-mouse' : 'native';
}
