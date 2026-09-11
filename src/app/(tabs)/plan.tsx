import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { Button, Card, Field, SectionHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { BalanceChart, type ChartPoint } from '@/components/chart';
import { addMonths, isoDate } from '@/core/dates';
import { baselinePayment } from '@/core/interest';
import { fromMinor, formatMoney, toMinor } from '@/core/money';
import { buildPlan, type PlanResult } from '@/core/plan';
import { rankLoans } from '@/core/priority';
import { activeLoans } from '@/core/types';
import { Spacing } from '@/constants/theme';
import { listLoans } from '@/db/repos';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

export default function PlanScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const currency = useSettings((s) => s.currency);

  const { data: loans, reload } = useAsync(() => listLoans(db), [db]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const actives = activeLoans(loans ?? []);
  const ranked = rankLoans(loans ?? [], isoDate());

  const [availStr, setAvailStr] = useState('');
  const [redirect, setRedirect] = useState(true);
  const [plan, setPlan] = useState<PlanResult | null>(null);

  // default = sum of current monthly payments, derived on the fly
  const defaultAvail =
    actives.length > 0
      ? String(Math.round(fromMinor(actives.reduce((s, l) => s + baselinePayment(l), 0), currency)) || '')
      : '';
  const availValue = availStr === '' ? defaultAvail : availStr;

  const runPlan = () => {
    const available = toMinor(availValue, currency);
    if (available <= 0 || actives.length === 0) return;
    setPlan(buildPlan(loans ?? [], available, { redirectFreedEmis: redirect, horizon: 12 }));
  };

  // interest saved vs paying only the unavoidable minimums (same 12-month window)
  const interestSaved = (() => {
    if (!plan) return null;
    const baseTotal = actives.reduce((s, l) => s + baselinePayment(l), 0);
    if (baseTotal <= 0 || baseTotal >= toMinor(availValue, currency)) return null;
    const minOnly = buildPlan(loans ?? [], baseTotal, {
      redirectFreedEmis: false,
      horizon: 12,
    });
    const saved = minOnly.totalInterest - plan.totalInterest;
    return saved > 0 ? saved : null;
  })();

  const projection: ChartPoint[] = plan
    ? [
        {
          t: Date.parse(isoDate()),
          v: plan.rows.reduce((s, r) => s + r.startBalance, 0),
        },
        ...plan.months.map((m, i) => ({
          t: Date.parse(addMonths(isoDate(), i + 1)),
          v: m.totalRemaining,
        })),
      ]
    : [];

  const buildShareMessage = (): string => {
    const allLoans = loans ?? [];
    const remaining = actives.reduce((s, l) => s + l.principal_remaining, 0);
    const borrowed = allLoans.reduce((s, l) => s + l.principal_total, 0);
    const lines: string[] = [];
    if (remaining > 0) {
      lines.push(
        t('share.debt', {
          amt: formatMoney(remaining, currency),
          pct: borrowed > 0 ? Math.round((1 - remaining / borrowed) * 100) : 0,
        }),
      );
    }
    if (ranked.length > 0) {
      lines.push(t('share.priorities'));
      ranked.slice(0, 3).forEach((r, i) => {
        lines.push(
          t('share.item', {
            n: i + 1,
            name: r.loan.name,
            reason: r.reasons.map((k) => t(k)).join(', ') || formatMoney(r.monthlyInterest, currency),
          }),
        );
      });
    }
    if (plan) {
      lines.push(
        t('share.projection', {
          c: plan.clearedCount,
          t: plan.totalCount,
          n: plan.cappedAt,
          int: formatMoney(plan.totalInterest, currency),
        }),
      );
      if (interestSaved !== null) {
        lines.push(t('share.saved', { amt: formatMoney(interestSaved, currency) }));
      }
    }
    lines.push(t('share.footer'));
    return lines.join('\n');
  };

  const sharePlan = async () => {
    try {
      await Share.share({ message: buildShareMessage() });
    } catch {
      // user cancelled the share sheet
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle">{t('plan.title')}</ThemedText>

      <Card>
        <SectionHeader title={t('plan.available')} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label={t('plan.available')} value={availValue} onChangeText={setAvailStr} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={styles.switchRow}>
          <ThemedText type="small" style={{ flex: 1 }}>
            {t('plan.redirect')}
          </ThemedText>
          <Switch value={redirect} onValueChange={setRedirect} trackColor={{ true: colors.accent }} />
        </View>
        <Button label={t('plan.run')} onPress={runPlan} disabled={actives.length === 0} />
        {actives.length > 0 ? (
          <Button label={t('share.plan')} variant="secondary" onPress={() => void sharePlan()} />
        ) : null}
      </Card>

      <SectionHeader title={t('plan.priority')} />
      {ranked.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('dash.noLoans.title')}</ThemedText>
      ) : (
        ranked.map((r, i) => (
          <Card key={r.loan.id} style={styles.rankCard}>
            <ThemedText type="smallBold" style={{ color: colors.accent }}>
              {t('plan.rank', { n: i + 1 })}
            </ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                {r.loan.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {r.reasons.map((k) => t(k)).join(' · ') || formatMoney(r.monthlyInterest, currency) }
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMoney(r.monthlyInterest, currency)}/{t('common.months')}
            </ThemedText>
          </Card>
        ))
      )}

      {plan ? (
        <>
          <SectionHeader title={t('plan.sim')} />
          <Card>
            <ThemedText type="default" style={{ fontWeight: '700' }}>
              {t('plan.cleared', { c: plan.clearedCount, t: plan.totalCount, n: plan.cappedAt })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('plan.totalInterest', { amt: formatMoney(plan.totalInterest, currency) })}
            </ThemedText>
            {interestSaved !== null ? (
              <ThemedText type="smallBold" style={{ color: colors.success }}>
                {t('plan.interestSaved', { amt: formatMoney(interestSaved, currency, { compact: true }) })}
              </ThemedText>
            ) : null}
          </Card>
          <Card>
            <SectionHeader title={t('plan.chart')} />
            <BalanceChart points={projection} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('plan.chartSub')}
            </ThemedText>
          </Card>
          {plan.rows.map((row) => (
            <View key={row.loanId} style={styles.planRow}>
              <ThemedText type="small" style={{ flex: 1 }}>
                {row.name}
              </ThemedText>
              <ThemedText
                type="smallBold"
                style={{ color: row.payoffMonth ? colors.success : colors.danger }}>
                {row.payoffMonth
                  ? t('plan.payoffIn', { n: row.payoffMonth })
                  : t('plan.never', { n: plan.cappedAt })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ width: 92, textAlign: 'right' }}>
                {formatMoney(Math.round(row.interestPaid), currency, { compact: true })}
              </ThemedText>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rankCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  planRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', paddingHorizontal: Spacing.one },
});
