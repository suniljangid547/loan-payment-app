import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { LoanListRow } from '@/components/loan-list-row';
import { Button, Card, EmptyState, SectionHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { isoDate } from '@/core/dates';
import { rankLoans } from '@/core/priority';
import { listLoans } from '@/db/repos';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

export default function LoansScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { currency } = useSettings();
  const { data, reload } = useAsync(() => listLoans(db), [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const loans = data ?? [];
  const ranked = rankLoans(loans, isoDate());
  const closed = loans.filter((l) => l.status === 'closed');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 34 }}>
            {t('tabs.loans')}
          </ThemedText>
          <Button label={t('dash.addLoan')} size="sm" onPress={() => router.push('/loan/new')} />
        </View>

        {ranked.length === 0 ? (
          <EmptyState
            icon="hand-heart-outline"
            title={t('dash.noLoans.title')}
            subtitle={t('dash.noLoans.sub')}
            action={<Button label={t('dash.addLoan')} onPress={() => router.push('/loan/new')} />}
          />
        ) : (
          <>
            <SectionHeader title={t('plan.priority')} />
            {ranked.map((r, i) => (
              <LoanListRow
                key={r.loan.id}
                ranked={r}
                currency={currency}
                rank={i + 1}
                onPress={() => router.push({ pathname: '/loan/[id]', params: { id: String(r.loan.id) } })}
              />
            ))}
          </>
        )}

        {closed.length > 0 ? (
          <>
            <SectionHeader title={`${t('loans.closed')} · ${closed.length}`} />
            <Card>
              {closed.map((l) => (
                <ThemedText
                  key={l.id}
                  type="small"
                  themeColor="textSecondary"
                  style={styles.closedRow}
                  onPress={() => router.push({ pathname: '/loan/[id]', params: { id: String(l.id) } })}>
                  ✓ {l.name} — {l.lender ?? t('type.other')}
                </ThemedText>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closedRow: { paddingVertical: 6 },
});
