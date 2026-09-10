import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { BalanceChart, type ChartPoint } from '@/components/chart';
import { Badge, Button, Card, Field, Money, ProgressBar, ScreenHeader, SectionHeader } from '@/components/ui';
import { isoDate } from '@/core/dates';
import { baselinePayment, interestDue, projectPayoff } from '@/core/interest';
import { formatMoney, toMinor } from '@/core/money';
import { rankLoans } from '@/core/priority';
import { deletePayment, getLoan, listLoans, listPayments, recordPayment } from '@/db/repos';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';
import { syncReminders } from '@/core/notify';
import type { LoanRow } from '@/core/types';

export default function LoanDetailScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const currency = useSettings((s) => s.currency);
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const [payStr, setPayStr] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, reload } = useAsync(async () => {
    const [loan, payments] = await Promise.all([getLoan(db, loanId), listPayments(db, loanId)]);
    return { loan, payments };
  }, [db, loanId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const loan = data?.loan ?? null;
  if (!loan) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Button label={t('common.cancel')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const ranked = rankLoans([loan], isoDate())[0];
  const pct = loan.principal_total > 0 ? 1 - loan.principal_remaining / loan.principal_total : 0;
  const payoff = projectPayoff(loan, baselinePayment(loan), 240);

  const balanceSeries: ChartPoint[] = (() => {
    const pays = [...data!.payments].sort(
      (a, b) => a.paid_at.localeCompare(b.paid_at) || a.id - b.id,
    );
    const start = loan.principal_remaining + pays.reduce((s, p) => s + p.principal_part, 0);
    const pts: ChartPoint[] = [{ t: Date.parse(loan.created_at), v: start }];
    let bal = start;
    for (const p of pays) {
      bal -= p.principal_part;
      pts.push({ t: Date.parse(p.paid_at), v: Math.max(0, bal) });
    }
    const endIso = loan.closed_at ?? isoDate();
    const endT = Date.parse(endIso);
    if (pts.every((pt) => pt.t !== endT)) pts.push({ t: endT, v: loan.principal_remaining });
    return pts;
  })();
  const showChart = balanceSeries.length >= 2;

  const doPay = async () => {
    const amount = toMinor(payStr, currency);
    if (amount <= 0) return;
    setBusy(true);
    try {
      const res = await recordPayment(db, loanId, amount);
      if (res) {
        setPayStr('');
        reload();
        const split = t('pay.split', {
          i: formatMoney(res.interestPart, currency),
          p: formatMoney(res.principalPart, currency),
        });
        void syncReminders(db);
        if (res.closed) {
          Alert.alert(t('pay.closed'), split);
          onClosed(loan);
        } else {
          Alert.alert(t('pay.saved'), split);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const onClosed = (closedLoan: LoanRow) => {
    const freed = closedLoan.emi_amount ?? closedLoan.card_minimum_due ?? baselinePayment(closedLoan);
    if (!freed || freed <= 0) return;
    Alert.alert(t('app.name'), t('redirect.q', { name: closedLoan.name, amt: formatMoney(freed, currency, { compact: true }) }), [
      { text: t('redirect.skip'), style: 'cancel' },
      {
        text: t('redirect.bigYes'),
        onPress: () => Alert.alert(t('fund.title'), t('redirect.fundHint')),
      },
      {
        text: t('redirect.bigNo'),
        onPress: async () => {
          const fresh = rankLoans(await listLoans(db), isoDate()).filter((r) => r.loan.id !== closedLoan.id);
          const next = fresh[0]?.loan;
          if (!next) return;
          const base = baselinePayment(next);
          const slow = projectPayoff(next, base, 240);
          const fast = projectPayoff(next, base + freed, 240);
          const monthsSaved = slow.months !== null && fast.months !== null ? slow.months - fast.months : '—';
          const intSaved = Math.max(0, slow.totalInterest - fast.totalInterest);
          Alert.alert(t('app.name'), t('redirect.suggest', { name: next.name, amt: formatMoney(freed, currency, { compact: true }), n: monthsSaved, int: formatMoney(intSaved, currency, { compact: true }) }), [
            { text: t('redirect.skip'), style: 'cancel' },
            { text: t('redirect.show'), onPress: () => router.push('/(tabs)/plan') },
          ]);
        },
      },
    ]);
  };

  const onLongPressPayment = (paymentId: number) => {
    Alert.alert(t('common.delete'), t('loan.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deletePayment(db, paymentId, loanId);
          reload();
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.flex}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title={loan.name}
        onEdit={() => router.push({ pathname: '/loan/new', params: { id: String(loanId) } })}
      />

      <Card>
        <Money value={formatMoney(loan.principal_remaining, currency)} size="lg" />
        <ThemedText type="small" themeColor="textSecondary">
          {t('loan.remaining')} / {formatMoney(loan.principal_total, currency)}
        </ThemedText>
        <ProgressBar pct={pct} />
        <ThemedText type="smallBold" style={{ color: colors.accent }}>
          {t('loan.progress', { pct: Math.round(pct * 100) })}
        </ThemedText>
        <View style={styles.badgeWrap}>
          <Badge text={`${t(`type.${loan.type}`)}`} tone="neutral" />
          <Badge text={t(`mode.${loan.mode}`)} tone="neutral" />
          <Badge text={`${loan.interest_rate}% ${t(`period.${loan.rate_period}`)}`} tone="neutral" />
          {ranked && loan.status === 'active'
            ? ranked.reasons.map((r) => (
                <Badge key={r} text={t(r)} tone={r === 'reason.overdue' ? 'danger' : 'warning'} />
              ))
            : null}
          {loan.status === 'closed' ? <Badge text={`🎉 ${t('loan.progress', { pct: 100 })}`} tone="success" /> : null}
        </View>
        {loan.status === 'active' ? (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              {t('loan.interestThisMonth', { amt: formatMoney(Math.round(interestDue(loan)), currency) })}
            </ThemedText>
            {payoff.months !== null ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('loan.payoffEst', { n: payoff.months })}
              </ThemedText>
            ) : (
              <ThemedText type="small" style={{ color: colors.danger }}>
                {t('loan.neverPayoff')}
              </ThemedText>
            )}
            {ranked?.nextDueIso ? (
              <ThemedText type="smallBold" style={{ color: ranked.isOverdue ? colors.danger : colors.warning }}>
                {ranked.isOverdue
                  ? t('loan.overdue', { n: Math.abs(ranked.daysToDue ?? 0) })
                  : `${t('loan.nextDue', { date: ranked.nextDueIso })}`}
              </ThemedText>
            ) : null}
          </>
        ) : null}
      </Card>

      {showChart ? (
        <Card>
          <SectionHeader title={t('loan.chart')} />
          <BalanceChart points={balanceSeries} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('loan.chartSub', { amt: formatMoney(balanceSeries[0].v, currency) })}
          </ThemedText>
        </Card>
      ) : null}

      {loan.status === 'active' ? (
        <Card>
          <Field
            label={t('common.amount')}
            value={payStr}
            onChangeText={setPayStr}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <Button label={t('loan.record')} onPress={doPay} loading={busy} />
        </Card>
      ) : null}

      <SectionHeader title={t('loan.history')} />
      {data && data.payments.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('loan.noPayments')}
        </ThemedText>
      ) : (
        data?.payments.map((p) => (
          <Pressable key={p.id} onLongPress={() => onLongPressPayment(p.id)}>
            <Card style={styles.payRow}>
              <View style={{ flex: 1 }}>
                <ThemedText type="default" style={{ fontWeight: '600' }}>
                  {formatMoney(p.amount, currency)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {p.paid_at} · {t('pay.split', {
                    i: formatMoney(p.interest_part, currency),
                    p: formatMoney(p.principal_part, currency),
                  })}
                </ThemedText>
              </View>
            </Card>
          </Pressable>
        ))
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  backBtn: { padding: 6 },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  badgeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  payRow: { paddingVertical: Spacing.three },
});
