import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { daysBetween, isoDate, nextDueDate } from './dates';
import { formatMoney } from './money';
import { t } from '@/i18n';
import { listLoans } from '@/db/repos';
import { useSettings } from '@/store/settings';
import type { LoanRow } from './types';

const { DAILY, MONTHLY, DATE } = Notifications.SchedulableTriggerInputTypes;

const CHANNEL = 'loanpay-reminders';

export function initNotificationHandler(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureNotificationsPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function schedule(
  title: string,
  body: string,
  trigger: Notifications.SchedulableNotificationTriggerInput,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' },
    trigger,
  });
}

/** Reschedule all local reminders from current loans + settings. Idempotent. */
export async function syncReminders(db: SQLiteDatabase): Promise<void> {
  if (Platform.OS === 'web') return;
  const settings = useSettings.getState();
  if (!settings.onboarded) return;
  const granted = await ensureNotificationsPermission();
  if (!granted) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'LoanPay',
      importance: Notifications.AndroidImportance.HIGH,
    });
  } catch {
    // channel API is a no-op on iOS
  }
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 1) daily plan every morning 8:00
  await schedule(t('notif.plan'), t('notif.planBody'), {
    type: DAILY,
    hour: 8,
    minute: 0,
    channelId: CHANNEL,
  });

  const loans = await listLoans(db);
  const actives = loans.filter((l) => l.status === 'active');
  const today = isoDate();
  for (const loan of actives) {
    await scheduleForLoan(loan, today, settings.currency);
  }
}

async function scheduleForLoan(loan: LoanRow, today: string, currency: string): Promise<void> {
  const title = t('app.name');
  if (loan.mode === 'fixed_emi' && loan.emi_day) {
    const reminderDay = Math.max(1, loan.emi_day - 3);
    await schedule(
      title,
      t('notif.emi', { name: loan.name, amt: formatMoney(loan.emi_amount ?? 0, currency) }),
      {
        type: MONTHLY,
        day: reminderDay,
        hour: 9,
        minute: 0,
        channelId: CHANNEL,
      },
    );
    const dueIso = nextDueDate(loan.emi_day, today);
    await schedule(title, t('notif.emiToday', { name: loan.name }), {
      type: DATE,
      date: new Date(`${dueIso}T09:00:00`),
      channelId: CHANNEL,
    });
    return;
  }
  if (loan.due_date) {
    const days = daysBetween(today, loan.due_date);
    if (days > 0) {
      const when = new Date(`${loan.due_date}T09:00:00`);
      if (loan.mode === 'credit_card') {
        when.setDate(when.getDate() - 3);
        await schedule(title, t('notif.cardDue', { name: loan.name }), {
          type: DATE,
          date: when,
          channelId: CHANNEL,
        });
      } else {
        when.setDate(when.getDate() - 7);
        await schedule(title, t('notif.flexDue', { name: loan.name }), {
          type: DATE,
          date: when,
          channelId: CHANNEL,
        });
      }
    }
  }
}
