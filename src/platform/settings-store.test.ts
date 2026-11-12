import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/core/contracts';
import { loadSettings, saveSettings, updateSettings, watchSettings } from './settings-store';

// Runs against WXT's in-memory fake of chrome.storage, not a real browser.
describe('settings store (fake browser storage)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns defaults when nothing is stored', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, enabled: false, pinnedActionIds: ['track'] });
    expect(await loadSettings()).toMatchObject({ enabled: false, pinnedActionIds: ['track'] });
  });

  it('refuses to persist invalid settings', async () => {
    await expect(
      saveSettings({ ...DEFAULT_SETTINGS, pinnedActionIds: ['explain', 'explain'] }),
    ).rejects.toThrow();
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('repairs corrupted storage on read', async () => {
    await fakeBrowser.storage.local.set({ settings: { enabled: 'yes', pinnedActionIds: ['x'] } });
    expect(await loadSettings()).toEqual({ ...DEFAULT_SETTINGS, pinnedActionIds: [] });
  });

  it('notifies watchers with parsed settings', async () => {
    const onChange = vi.fn();
    const unwatch = watchSettings(onChange);
    await updateSettings((current) => ({ ...current, triggerMode: 'right-click' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ triggerMode: 'right-click' }));
    unwatch();
  });
});
