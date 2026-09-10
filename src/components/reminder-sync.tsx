import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { syncReminders } from '@/core/notify';
import { useSettings } from '@/store/settings';

/** Re-schedules all local notifications on launch, foreground, and loan/settings changes. */
export function ReminderSync() {
  const db = useSQLiteContext();
  const { onboarded, language, currency } = useSettings();

  useEffect(() => {
    const run = () => void syncReminders(db);
    run();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') run();
    });
    return () => sub.remove();
  }, [db, onboarded, language, currency]);

  return null;
}
