import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_PREFERENCES } from './model';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notifications';
import {
  DEFAULT_PINNED_ACTIONS,
  DEFAULT_SETTINGS,
  MAX_PINNED_ACTIONS,
  SETTINGS_VERSION,
  SettingsSchema,
  normalizePinnedActionIds,
  parseSettings,
} from './settings';

describe('settings defaults', () => {
  it('pins Explain This, Select Content, Send to Agent in that order', () => {
    expect(DEFAULT_PINNED_ACTIONS).toEqual(['explain', 'select-content', 'send-to-agent']);
  });

  it('defaults to enabled with Shift + right-click and OpenRouter preferences', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SETTINGS.triggerMode).toBe('shift-right-click');
    expect(DEFAULT_SETTINGS.model).toEqual(DEFAULT_MODEL_PREFERENCES);
    expect(DEFAULT_SETTINGS.notifications).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(SettingsSchema.parse(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('parseSettings', () => {
  it('returns defaults for missing or malformed storage', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  });

  it('returns a fresh copy of defaults', () => {
    const parsed = parseSettings(undefined);
    parsed.pinnedActionIds.push('track');
    expect(DEFAULT_SETTINGS.pinnedActionIds).toEqual([...DEFAULT_PINNED_ACTIONS]);
  });

  it('keeps valid fields when others are invalid', () => {
    expect(
      parseSettings({
        version: 1,
        enabled: false,
        triggerMode: 'middle-click',
        pinnedActionIds: ['track', 'nope', 'track', 'explain'],
      }),
    ).toEqual({
      version: SETTINGS_VERSION,
      enabled: false,
      triggerMode: 'shift-right-click',
      pinnedActionIds: ['track', 'explain'],
      model: { ...DEFAULT_MODEL_PREFERENCES },
      notifications: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    });
  });

  it('preserves an intentionally empty pinned list', () => {
    expect(parseSettings({ enabled: true, pinnedActionIds: [] }).pinnedActionIds).toEqual([]);
  });

  it('repairs missing notification preferences on older stored settings', () => {
    expect(
      parseSettings({
        version: 1,
        enabled: true,
        triggerMode: 'shift-right-click',
        pinnedActionIds: ['explain'],
      }).notifications,
    ).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  it('passes valid settings through unchanged', () => {
    const valid = {
      version: 1 as const,
      enabled: true,
      triggerMode: 'right-click' as const,
      pinnedActionIds: ['summarize' as const],
      model: { providerId: 'mock' as const, modelId: 'mock-deterministic' },
      notifications: { taskCompleted: false, trackConditionMet: true },
    };
    expect(parseSettings(valid)).toEqual(valid);
  });

  it('migrates bootstrap settings that lack model preferences', () => {
    expect(
      parseSettings({
        version: 1,
        enabled: true,
        triggerMode: 'shift-right-click',
        pinnedActionIds: ['explain', 'select-content', 'send-to-agent'],
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('repairs invalid model preferences field-by-field', () => {
    expect(
      parseSettings({
        model: { providerId: 'anthropic', modelId: 'claude-3' },
      }).model,
    ).toEqual({
      providerId: DEFAULT_MODEL_PREFERENCES.providerId,
      modelId: 'claude-3',
    });
  });
});

describe('normalizePinnedActionIds', () => {
  it('caps the list length', () => {
    const many = [
      'explain',
      'select-content',
      'send-to-agent',
      'summarize',
      'translate',
      'ask-follow-up',
      'simplify',
      'go-deeper',
      'example',
      'compare',
    ];
    expect(normalizePinnedActionIds(many)).toHaveLength(MAX_PINNED_ACTIONS);
  });

  it('falls back to defaults for non-arrays', () => {
    expect(normalizePinnedActionIds({})).toEqual([...DEFAULT_PINNED_ACTIONS]);
  });
});
