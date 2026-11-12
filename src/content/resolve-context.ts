import type { SelectedContext } from '@/core/contracts';
import type { MenuInvocation } from './invocation';
import { selectAt, type SelectionHandle } from './selection';

/**
 * Resolve the SelectedContext for an action after the menu choice (not on the
 * contextmenu hot path). Prefers an active outlined selection session, otherwise
 * builds one from Workstream A's semantic `selectAt` handle.
 */
export function resolveActionContext(options: {
  invocation: MenuInvocation;
  selectionHandle?: SelectionHandle | null;
}): SelectedContext {
  if (options.selectionHandle) {
    return options.selectionHandle.toContext();
  }
  return selectAt(options.invocation).toContext();
}
