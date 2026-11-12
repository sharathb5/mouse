import { resolveActionContext } from '@/content/resolve-context';
import type { MenuInvocation } from '@/content/invocation';
import type { SelectedContext } from '@/core/contracts';

/**
 * Builds SelectedContext via Workstream A's semantic selection.
 * Kept as a thin wrapper for callers that still import this name.
 */
export function contextFromInvocation(invocation: MenuInvocation): SelectedContext {
  return resolveActionContext({ invocation });
}
