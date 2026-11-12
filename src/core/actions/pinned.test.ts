import { describe, expect, it } from 'vitest';
import { ACTION_IDS, MAX_PINNED_ACTIONS, type ActionId } from '../contracts';
import {
  addPinnedAction,
  canPinMore,
  movePinnedAction,
  removePinnedAction,
  resetPinnedActions,
  unpinnedActions,
} from './pinned';

const defaults: ActionId[] = ['explain', 'select-content', 'send-to-agent'];

describe('pinned action operations', () => {
  it('adds new actions to the end and ignores duplicates', () => {
    expect(addPinnedAction(defaults, 'summarize')).toEqual([...defaults, 'summarize']);
    expect(addPinnedAction(defaults, 'explain')).toEqual(defaults);
  });

  it('refuses to exceed the maximum', () => {
    const full = ACTION_IDS.slice(0, MAX_PINNED_ACTIONS);
    expect(canPinMore(full)).toBe(false);
    expect(addPinnedAction(full, 'track')).toEqual(full);
  });

  it('removes actions', () => {
    expect(removePinnedAction(defaults, 'select-content')).toEqual(['explain', 'send-to-agent']);
  });

  it('moves actions up and down within bounds', () => {
    expect(movePinnedAction(defaults, 'send-to-agent', -1)).toEqual([
      'explain',
      'send-to-agent',
      'select-content',
    ]);
    expect(movePinnedAction(defaults, 'explain', 1)).toEqual([
      'select-content',
      'explain',
      'send-to-agent',
    ]);
    expect(movePinnedAction(defaults, 'explain', -1)).toEqual(defaults);
    expect(movePinnedAction(defaults, 'send-to-agent', 1)).toEqual(defaults);
    expect(movePinnedAction(defaults, 'track', 1)).toEqual(defaults);
  });

  it('never mutates its input', () => {
    const input = [...defaults];
    movePinnedAction(input, 'explain', 1);
    removePinnedAction(input, 'explain');
    addPinnedAction(input, 'track');
    expect(input).toEqual(defaults);
  });

  it('resets to defaults and lists unpinned actions', () => {
    expect(resetPinnedActions()).toEqual(defaults);
    expect(unpinnedActions(defaults)).not.toContain('explain');
    expect(unpinnedActions(defaults)).toHaveLength(ACTION_IDS.length - defaults.length);
  });
});
