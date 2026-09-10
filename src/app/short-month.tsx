import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, Chips, ScreenHeader, SectionHeader } from '@/components/ui';
import { isoDate, monthOf } from '@/core/dates';
import { baselinePayment } from '@/core/interest';
import { formatMoney } from '@/core/money';
import { rankLoans } from '@/core/priority';
import { fundBalance, listLoans, recordShortMonth } from '@/db/repos';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

const REASONS = ['medical', 'festival', 'business', 'salaryLate', 'other'] as const;
type Reason = (typeof REASONS)[number];

export default function ShortMonthScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const currency = useSettings((s) => s.currency);
  const month = monthOf(isoDate());
  const [reason, setReason] = useState<Reason | null>(null);

  const { data } = useAsync(async () => {
    const [loans, fund] = await Promise.all([listLoans(db), fundBalance(db)]);
    return { ranked: rankLoans(loans, isoDate()), fund };
  }, [db]);

  const protect = (data?.ranked ?? []).filter(
    (r) => r.loan.mode !== 'flexible' && r.loan.status === 'active',
  );
  const defer = (data?.ranked ?? []).filter((r) => r.loan.mode === 'flexible' && r.loan.status === 'active');
  const protectedTotal = protect.reduce((s, r) => s + baselinePayment(r.loan), 0);

  const save = async () => {
    if (!reason) return;
    await recordShortMonth(db, month, `sm.reason.${reason}`);
    Alert.alert(t('sm.saved'));
    router.back();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('sm.title')} />
        <Card>
          <Chips<Reason>
            label={t('sm.ask')}
            value={reason ?? undefined}
            onChange={setReason}
            options={REASONS.map((r) => ({ value: r, label: t(`sm.reason.${r}`) }))}
          />
        </Card>

        <SectionHeader title={t('sm.protect')} right={<Badge text={formatMoney(protectedTotal, currency, { compact: true })} tone="danger" />} />
        {protect.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">{t('common.none')}</ThemedText>
        ) : (
          protect.map((r) => (
            <Card key={r.loan.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText type="default" style={{ fontWeight: '700' }} numberOfLines={1}>
                  {r.loan.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{t(`mode.${r.loan.mode}`)}</ThemedText>
              </View>
              <ThemedText type="smallBold">{formatMoney(baselinePayment(r.loan), currency)}</ThemedText>
            </Card>
          ))
        )}

        <SectionHeader title={t('sm.defer')} />
        {defer.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">{t('sm.deferNone')}</ThemedText>
        ) : (
          defer.map((r) => (
            <Card key={r.loan.id} style={styles.row}>
              <ThemedText type="default" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                {r.loan.name}
              </ThemedText>
              <ThemedText type="small" style={{ color: colors.success }}>
                {t('common.yes')}
              </ThemedText>
            </Card>
          ))
        )}

        {(data?.fund ?? 0) > 0 ? (
          <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
            <ThemedText type="small" style={{ color: colors.accent, fontWeight: '600' }}>
              {t('sm.fundTip')}
            </ThemedText>
          </Card>
        ) : null}

        <Button label={t('sm.save')} onPress={save} disabled={!reason} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
});
