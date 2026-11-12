import { useCallback, useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { OPEN_MENU_COMMAND, type Settings } from '@/core/contracts';
import { loadSettings, updateSettings, watchSettings } from '@/platform/settings-store';
import { getTabStatus, type TabStatus } from '@/platform/tab-status';

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSettings()
      .then((loaded) => active && setSettings(loaded))
      .catch(() => active && setError('Could not load settings.'));
    const unwatch = watchSettings((next) => active && setSettings(next));
    return () => {
      active = false;
      unwatch();
    };
  }, []);

  const update = useCallback(async (change: (current: Settings) => Settings) => {
    try {
      setSettings(await updateSettings(change));
      setError(null);
    } catch {
      setError('Could not save settings.');
    }
  }, []);

  return { settings, update, error };
}

/** `?tabId=` lets the popup inspect a specific tab when it is opened as a page (tests, debugging). */
function tabIdFromLocation(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get('tabId');
  const id = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(id) ? id : undefined;
}

export function useTabStatus(): TabStatus | null {
  const [status, setStatus] = useState<TabStatus | null>(null);
  useEffect(() => {
    let active = true;
    void getTabStatus(tabIdFromLocation()).then((next) => active && setStatus(next));
    return () => {
      active = false;
    };
  }, []);
  return status;
}

export function useFallbackShortcut(): string | null {
  const [shortcut, setShortcut] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void browser.commands.getAll().then((commands) => {
      const command = commands.find((c) => c.name === OPEN_MENU_COMMAND);
      if (active) setShortcut(command?.shortcut ?? '');
    });
    return () => {
      active = false;
    };
  }, []);
  return shortcut;
}
