import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSQLiteContext } from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { LoanListRow } from '@/components/loan-list-row';
import { Badge, Button, Card, EmptyState, Money, ProgressBar, SectionHeader, StatTile } from '@/components/ui';
import { addMonths, daysBetween, isoDate, monthOf } from '@/core/dates';
import { spendingCoach } from '@/core/coach';
import { baselinePayment, projectPayoff } from '@/core/interest';
import { formatMoney, toMinor } from '@/core/money';
import { rankLoans } from '@/core/priority';
import { activeLoans } from '@/core/types';
import { Spacing } from '@/constants/theme';
import {
  addFundTxn,
  debtTotals,
  fundBalance,
  incomeTotal,
  listLoans,
  monthSpendSummary,
} from '@/db/repos';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { onboarded, name, currency, hasInsurance, insuranceDismissed, fundTarget } = useSettings();
  const update = useSettings((s) => s.update);
  const today = isoDate();
  const month = monthOf(today);
  const [fundStr, setFundStr] = useState('');

  const { data, reload } = useAsync(async () => {
    const loans = await listLoans(db);
    const totals = await debtTotals(db);
    const income = await incomeTotal(db, month);
    const spendRows = await monthSpendSummary(db, month);
    const spent = spendRows.reduce((s, r) => s + r.spent, 0);
    const fund = await fundBalance(db);
    return { loans, totals, income, spendRows, spent, fund };
  }, [db, month]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (!onboarded) return <Redirect href="/onboarding" />;

  const loans = data?.loans ?? [];
  const actives = activeLoans(loans);
  const ranked = rankLoans(loans, today);
  const totalRemaining = data?.totals.total_remaining ?? 0;
  const totalBorrowed = data?.totals.total_borrowed ?? 0;
  const pctPaid = totalBorrowed > 0 ? 1 - totalRemaining / totalBorrowed : 0;
  const dueSoon = ranked.filter((r) => r.daysToDue !== null && r.daysToDue <= 7);

  let monthsLeft: number | null = null;
  for (const l of actives) {
    const p = projectPayoff(l, baselinePayment(l), 60);
    if (p.months === null) {
      monthsLeft = null;
      break;
    }
    monthsLeft = monthsLeft === null ? p.months : Math.max(monthsLeft, p.months);
  }

  const fund = data?.fund ?? 0;
  const spent = data?.spent ?? 0;
  const fundGoal = fundTarget ?? Math.max(spent, toMinor('10000', currency));
  const fundPct = fundGoal > 0 ? Math.min(1, fund / fundGoal) : 0;
  const monthlyNeed = actives.reduce((s, l) => s + baselinePayment(l), 0);
  const coach = spendingCoach(data?.spendRows ?? [], loans, today);
  const coachCat = coach
    ? coach.categoryLabelKey
      ? t(coach.categoryLabelKey)
      : (coach.categoryLabel ?? t('cat.other'))
    : null;
  const addFund = async () => {
    const amt = toMinor(fundStr, currency);
    if (amt <= 0) return;
    await addFundTxn(db, amt, isoDate(), null);
    setFundStr('');
    reload();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <ThemedText type="default" themeColor="textSecondary" style={{ fontSize: 15 }}>
          {t('dash.hello', { name })}
        </ThemedText>

        <Card>
          <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
            {t('dash.totalDebt')}
          </ThemedText>
          <Money value={formatMoney(totalRemaining, currency)} size="xl" />
          <ProgressBar pct={pctPaid} />
          <View style={styles.rowBetween}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('dash.paidOff', { pct: Math.round(pctPaid * 100) })}
            </ThemedText>
            {monthsLeft !== null && actives.length > 0 ? (
              <ThemedText type="smallBold" style={{ color: colors.accent }}>
                {t('dash.monthsLeft', { n: monthsLeft })}
              </ThemedText>
            ) : null}
          </View>
          {actives.length > 0 && monthsLeft === null ? (
            <ThemedText type="small" style={{ color: colors.warning }}>
              {t('loan.neverPayoff')}
            </ThemedText>
          ) : null}
        </Card>

        <View style={styles.statsRow}>
          <StatTile
            label={t('dash.incomeThisMonth')}
            value={formatMoney(data?.income ?? 0, currency, { compact: true })}
            color={colors.success}
          />
          <StatTile
            label={t('dash.expenseThisMonth')}
            value={formatMoney(data?.spent ?? 0, currency, { compact: true })}
          />
        </View>

        <View style={styles.quickRow}>
          <Button label={t('dash.addIncome')} variant="primary" size="sm" style={{ flex: 1 }} onPress={() => router.push('/(tabs)/income')} />
          <Button label={t('dash.addExpense')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push('/(tabs)/expenses')} />
          <Button label={t('dash.addLoan')} variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push('/loan/new')} />
        </View>

        {actives.length > 0 && hasInsurance === false && !insuranceDismissed ? (
          <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning }}>
            <ThemedText type="smallBold" style={{ color: colors.warning, fontSize: 15 }}>
              {t('ins.title')}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.text }}>
              {t('ins.body', {
                loans: actives.length,
                need: formatMoney(monthlyNeed, currency, { compact: true }),
                amt: formatMoney(toMinor('500', currency), currency, { compact: true }),
              })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('ins.free')}
            </ThemedText>
            <Button label={t('ins.cta')} variant="ghost" size="sm" onPress={() => update({ insuranceDismissed: true })} />
          </Card>
        ) : null}

        {coach && coachCat ? (
          <Card style={{ backgroundColor: colors.accentSoft, borderColor: colors.accent }}>
            <ThemedText type="smallBold" style={{ color: colors.accent, fontSize: 15 }}>
              💡 {t('coach.title')}
            </ThemedText>
            <ThemedText type="small" style={{ color: colors.text }}>
              {coach.kind === 'over'
                ? t('coach.over', { cat: coachCat, amt: formatMoney(coach.cut, currency) })
                : t('coach.cut', {
                    cat: coachCat,
                    amt: formatMoney(coach.cut, currency),
                    pct: Math.round((coach.cut / coach.spent) * 100),
                  })}
            </ThemedText>
            {(coach.monthsSaved ?? 0) > 0 ? (
              <ThemedText type="smallBold" style={{ color: colors.text }}>
                {t('coach.impact', {
                  loan: coach.targetLoanName,
                  n: coach.monthsSaved,
                  int: formatMoney(coach.interestSaved, currency, { compact: true }),
                })}
              </ThemedText>
            ) : (coach.closesIn ?? 0) > 0 ? (
              <ThemedText type="smallBold" style={{ color: colors.text }}>
                {t('coach.impactNow', { loan: coach.targetLoanName, n: coach.closesIn })}
              </ThemedText>
            ) : coach.interestSaved > 0 ? (
              <ThemedText type="smallBold" style={{ color: colors.text }}>
                {t('coach.impactInt', {
                  loan: coach.targetLoanName,
                  int: formatMoney(coach.interestSaved, currency, { compact: true }),
                })}
              </ThemedText>
            ) : null}
            <Button
              label={t('redirect.show')}
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(tabs)/plan')}
            />
          </Card>
        ) : null}

        <Card>
          <View style={styles.rowBetween}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.kicker}>
              {t('fund.title')}
            </ThemedText>
            <Badge
              text={fundPct >= 1 ? t('fund.goalReached') : `${Math.round(fundPct * 100)}%`}
              tone={fundPct >= 1 ? 'success' : 'neutral'}
            />
          </View>
          <View style={styles.rowBetween}>
            <Money value={formatMoney(fund, currency, { compact: true })} size="md" color={colors.accent} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('fund.target')} {formatMoney(fundGoal, currency, { compact: true })}
            </ThemedText>
          </View>
          <ProgressBar pct={fundPct} color={colors.accent} />
          <View style={styles.rowBetween}>
            <TextInput
              value={fundStr}
              onChangeText={setFundStr}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { flex: 1, backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            />
            <Button label={t('fund.add')} size="sm" onPress={addFund} style={{ minWidth: 110 }} />
          </View>
          {fundPct < 1 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('fund.nudge')}
            </ThemedText>
          ) : null}
        </Card>

        {actives.length === 0 ? (
          <EmptyState
            icon="hand-heart-outline"
            title={t('dash.noLoans.title')}
            subtitle={t('dash.noLoans.sub')}
            action={<Button label={t('dash.addLoan')} onPress={() => router.push('/loan/new')} />}
          />
        ) : (
          <>
            <SectionHeader title={t('dash.dueNext7')} />
            {dueSoon.length === 0 ? (
              <ThemedText type="small" style={{ color: colors.success }}>
                {t('dash.nothingDue')}
              </ThemedText>
            ) : (
              dueSoon.map((r) => (
                <Card key={`due-${r.loan.id}`} style={styles.dueCard}>
                  <ThemedText type="default" style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
                    {r.loan.name}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: r.isOverdue ? colors.danger : colors.warning }}>
                    {r.isOverdue
                      ? t('loan.overdue', { n: Math.abs(r.daysToDue ?? 0) })
                      : t('loan.dueIn', { n: daysBetween(today, r.nextDueIso ?? addMonths(today, 1)) })}
                  </ThemedText>
                </Card>
              ))
            )}

            <SectionHeader
              title={t('dash.topPriority')}
              right={
                <ThemedText type="link" style={{ color: colors.accent, fontWeight: '700' }} onPress={() => router.push('/(tabs)/loans')}>
                  {t('dash.seeAll')}
                </ThemedText>
              }
            />
            {ranked.slice(0, 3).map((r, i) => (
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  kicker: { fontSize: 12.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: Spacing.two },
  quickRow: { flexDirection: 'row', gap: Spacing.two },
  dueCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.two },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    fontWeight: '600',
  },
});
