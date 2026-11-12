import { z } from 'zod';
import { DEFAULT_NOTIFICATION_PREFERENCES as DEFAULT_NOTIFICATION_PREFERENCES_BASE } from './settings-defaults';

/** User preferences for extension-generated notifications (Track / task completion). */
export const NotificationPreferencesSchema = z.object({
  taskCompleted: z.boolean(),
  trackConditionMet: z.boolean(),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  ...DEFAULT_NOTIFICATION_PREFERENCES_BASE,
};

export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  const full = NotificationPreferencesSchema.safeParse(raw);
  if (full.success) return full.data;
  if (typeof raw !== 'object' || raw === null) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  const record = raw as Record<string, unknown>;
  const taskCompleted = z.boolean().safeParse(record.taskCompleted);
  const trackConditionMet = z.boolean().safeParse(record.trackConditionMet);
  return {
    taskCompleted: taskCompleted.success
      ? taskCompleted.data
      : DEFAULT_NOTIFICATION_PREFERENCES.taskCompleted,
    trackConditionMet: trackConditionMet.success
      ? trackConditionMet.data
      : DEFAULT_NOTIFICATION_PREFERENCES.trackConditionMet,
  };
}
