import {
  ACTION_IDS,
  DEFAULT_PINNED_ACTIONS,
  MAX_PINNED_ACTIONS,
  type ActionId,
} from '../contracts';

/** Pure operations on the pinned-action list. Callers persist the returned array. */

export function addPinnedAction(pinned: readonly ActionId[], id: ActionId): ActionId[] {
  if (pinned.includes(id) || pinned.length >= MAX_PINNED_ACTIONS) return [...pinned];
  return [...pinned, id];
}

export function removePinnedAction(pinned: readonly ActionId[], id: ActionId): ActionId[] {
  return pinned.filter((existing) => existing !== id);
}

export function movePinnedAction(
  pinned: readonly ActionId[],
  id: ActionId,
  offset: -1 | 1,
): ActionId[] {
  const from = pinned.indexOf(id);
  const to = from + offset;
  if (from === -1 || to < 0 || to >= pinned.length) return [...pinned];
  const next = [...pinned];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

export function resetPinnedActions(): ActionId[] {
  return [...DEFAULT_PINNED_ACTIONS];
}

export function unpinnedActions(pinned: readonly ActionId[]): ActionId[] {
  return ACTION_IDS.filter((id) => !pinned.includes(id));
}

export function canPinMore(pinned: readonly ActionId[]): boolean {
  return pinned.length < MAX_PINNED_ACTIONS;
}
