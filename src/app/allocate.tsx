import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { isoDate } from '@/core/dates';
import { baselinePayment, monthlyInterestDrop } from '@/core/interest';
import { formatMoney } from '@/core/money';
import { rankLoans, type RankedLoan } from '@/core/priority';
import type { LoanRow } from '@/core/types';
import { Spacing } from '@/constants/theme';
import { listLoans, recordPayment } from '@/db/repos';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

interface AllocEntry {
  loan: LoanRow;
  amount: number;
}

interface AllocOption {
  key: 'A' | 'B' | 'C';
  title: string;
  entries: AllocEntry[];
  interestDrop: number;
  closesLoan: boolean;
}

function buildOptions(ranked: RankedLoan[], pool: number, t: (k: string) => string): AllocOption[] {
  if (ranked.length === 0) return [];
  const opts: AllocOption[] = [];

  // A — protect dues first (EMI / card minimum / accrued interest), surplus to #1
  let left = pool;
  const aEntries: AllocEntry[] = [];
  for (const r of ranked) {
    if (left <= 0) break;
    const need = Math.min(baselinePayment(r.loan), r.loan.principal_remaining + r.monthlyInterest);
    const pay = Math.min(left, need);
    if (pay > 0) {
      aEntries.push({ loan: r.loan, amount: pay });
      left -= pay;
    }
  }
  if (left > 0 && aEntries.length > 0) {
    const first = aEntries[0];
    const extra = Math.min(left, first.loan.principal_remaining);
    if (extra > 0) {
      first.amount += extra;
      left -= extra;
    }
    if (left > 0) aEntries.push({ loan: ranked[0].loan, amount: left });
  }
  opts.push(describe('A', t('alloc.optionA'), mergeEntries(aEntries), t));

  // B — everything to #1 priority
  const top = ranked[0];
  opts.push(describe('B', t('alloc.optionB'), [{ loan: top.loan, amount: Math.min(pool, top.loan.principal_remaining) }].filter((e) => e.amount > 0), t));

  // C — close the smallest loan
  const small = [...ranked].sort(
    (x, y) => x.loan.principal_remaining - y.loan.principal_remaining,
  )[0];
  opts.push(
    describe(
      'C',
      t('alloc.optionC'),
      [{ loan: small.loan, amount: Math.min(pool, small.loan.principal_remaining) }].filter((e) => e.amount > 0),
      t,
    ),
  );
  return opts.filter((o) => o.entries.length > 0);
}

function mergeEntries(entries: AllocEntry[]): AllocEntry[] {
  const map = new Map<number, AllocEntry>();
  for (const e of entries) {
    const cur = map.get(e.loan.id);
    if (cur) cur.amount += e.amount;
    else map.set(e.loan.id, { ...e });
  }
  return [...map.values()];
}

function describe(key: AllocOption['key'], title: string, entries: AllocEntry[], t: (k: string) => string): AllocOption {
  const interestDrop = entries.reduce((s, e) => s + monthlyInterestDrop(e.loan, e.amount), 0);
  const closesLoan = entries.some((e) => e.amount >= e.loan.principal_remaining);
  return { key, title, entries, interestDrop, closesLoan };
}

export default function AllocateScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const currency = useSettings((s) => s.currency);
  const params = useLocalSearchParams<{ amount?: string }>();
  const amount = Number(params.amount ?? 0);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: loans } = useAsync(() => listLoans(db), [db]);
  const ranked = rankLoans(loans ?? [], isoDate());
  const options = amount > 0 ? buildOptions(ranked, amount, (k) => t(k)) : [];

  const apply = async (opt: AllocOption) => {
    setBusy(opt.key);
    try {
      for (const e of opt.entries) {
        await recordPayment(db, e.loan.id, e.amount);
      }
      Alert.alert(t('alloc.applied'), t('alloc.drop', { amt: formatMoney(opt.interestDrop, currency) }) + (opt.closesLoan ? ` ${t('alloc.loanGone')}` : ''));
      router.back();
    } catch {
      Alert.alert(t('misc.error'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <ThemedText type="subtitle" style={{ fontSize: 22, lineHeight: 30 }}>
        {t('alloc.title', { amt: formatMoney(amount, currency) })}
      </ThemedText>
      {options.length === 0 ? (
        <EmptyState
          title={t('alloc.noLoans')}
          action={<Button label={t('dash.addLoan')} onPress={() => router.push('/loan/new')} />}
        />
      ) : (
        options.map((opt) => (
          <Card key={opt.key}>
            {opt.key === 'A' ? (
              <Badge text={t('alloc.recommended')} tone="success" icon="star" />
            ) : null}
            <ThemedText type="default" style={{ fontWeight: '700', fontSize: 16.5 }}>
              {opt.title}
            </ThemedText>
            {opt.entries.map((e) => (
              <View key={`${opt.key}-${e.loan.id}`} style={styles.entryRow}>
                <ThemedText type="small" style={{ flex: 1 }} numberOfLines={1}>
                  {e.loan.name}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: colors.accent }}>
                  {formatMoney(e.amount, currency)}
                </ThemedText>
              </View>
            ))}
            <View style={styles.badgeRow}>
              {opt.interestDrop > 0 ? <Badge text={t('alloc.drop', { amt: formatMoney(opt.interestDrop, currency) })} tone="success" /> : null}
              {opt.closesLoan ? <Badge text={t('alloc.loanGone')} tone="warning" /> : null}
            </View>
            <Button
              label={t('alloc.apply')}
              variant={opt.key === 'A' ? 'primary' : 'secondary'}
              onPress={() => apply(opt)}
              loading={busy === opt.key}
            />
          </Card>
        ))
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  entryRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
