import { browser } from 'wxt/browser';
import {
  parseNotificationPreferences,
  type NotificationPreferences,
  type Tracker,
} from '@/core/contracts';
import { loadSettings } from '@/platform/settings-store';

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const settings = await loadSettings();
    return settings.notifications;
  } catch {
    return parseNotificationPreferences(undefined);
  }
}

export async function notifyTrackConditionMet(tracker: Tracker): Promise<void> {
  const prefs = await loadNotificationPreferences();
  if (!prefs.trackConditionMet) return;

  const conditionLabel = (() => {
    switch (tracker.condition.kind) {
      case 'price-below':
        return `price below ${tracker.condition.threshold.currency} ${tracker.condition.threshold.amount}`;
      case 'price-change':
        return 'price change';
      case 'availability-change':
        return 'availability change';
      case 'content-change':
        return 'content change';
    }
  })();

  await browser.notifications.create(`track-${tracker.id}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: 'Agentic Mouse tracker',
    message: `${tracker.title} matched ${conditionLabel}.`,
    priority: 1,
  });
}
