import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, Field, ScreenHeader } from '@/components/ui';
import { addMonths, isoDate } from '@/core/dates';
import { toMinor } from '@/core/money';
import {
  LOAN_MODES,
  LOAN_TYPES,
  type Compounding,
  type LoanMode,
  type LoanType,
  type RatePeriod,
} from '@/core/types';
import { Spacing } from '@/constants/theme';
import { createLoan, deleteLoan, getLoan, updateLoan, type LoanInput } from '@/db/repos';
import { syncReminders } from '@/core/notify';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

export default function LoanFormScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const currency = useSettings((s) => s.currency);
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;

  const { data: existing } = useAsync(
    () => (editingId ? getLoan(db, editingId) : Promise.resolve(null)),
    [db, editingId],
  );

  const [name, setName] = useState('');
  const [lender, setLender] = useState('');
  const [type, setType] = useState<LoanType>('personal');
  const [mode, setMode] = useState<LoanMode>('fixed_emi');
  const [purpose, setPurpose] = useState('');
  const [regret, setRegret] = useState(false);
  const [totalStr, setTotalStr] = useState('');
  const [remainingStr, setRemainingStr] = useState('');
  const [rateStr, setRateStr] = useState('');
  const [ratePeriod, setRatePeriod] = useState<RatePeriod>('yearly');
  const [compounding, setCompounding] = useState<Compounding>('interest_on_interest');
  const [emiStr, setEmiStr] = useState('');
  const [emiDayStr, setEmiDayStr] = useState('');
  const [flexMonthsStr, setFlexMonthsStr] = useState('');
  const [cardMinStr, setCardMinStr] = useState('');
  const [dueDateStr, setDueDateStr] = useState('');
  const [busy, setBusy] = useState(false);

  const [prefilledId, setPrefilledId] = useState<number | null>(null);
  if (existing && prefilledId !== existing.id) {
    setPrefilledId(existing.id);
    setName(existing.name);
    setLender(existing.lender ?? '');
    setType(existing.type);
    setMode(existing.mode);
    setPurpose(existing.purpose ?? '');
    setRegret(existing.purpose_regret === 1);
    setTotalStr(String(existing.principal_total / 100));
    setRemainingStr(String(existing.principal_remaining / 100));
    setRateStr(String(existing.interest_rate));
    setRatePeriod(existing.rate_period);
    setCompounding(existing.compounding);
    setEmiStr(existing.emi_amount ? String(existing.emi_amount / 100) : '');
    setEmiDayStr(existing.emi_day ? String(existing.emi_day) : '');
    setFlexMonthsStr(existing.flexible_months ? String(existing.flexible_months) : '');
    setCardMinStr(existing.card_minimum_due ? String(existing.card_minimum_due / 100) : '');
    setDueDateStr(existing.due_date ?? '');
  }

  const save = async () => {
    const total = toMinor(totalStr, currency);
    const remaining = remainingStr.trim() === '' ? total : toMinor(remainingStr, currency);
    if (!name.trim() || total <= 0) {
      Alert.alert(t('misc.error'), `${t('loan.name')} · ${t('loan.total')}`);
      return;
    }
    const flexibleMonths = flexMonthsStr ? Math.max(1, parseInt(flexMonthsStr, 10)) : null;
    const input: LoanInput = {
      name: name.trim(),
      lender: lender.trim() || null,
      type,
      purpose: purpose.trim() || null,
      purpose_regret: regret,
      mode,
      principal_total: total,
      principal_remaining: Math.min(remaining, total),
      interest_rate: rateStr ? parseFloat(rateStr) || 0 : 0,
      rate_period: ratePeriod,
      compounding,
      emi_amount: emiStr ? toMinor(emiStr, currency) : null,
      emi_day: emiDayStr ? Math.min(28, Math.max(1, parseInt(emiDayStr, 10) || 1)) : null,
      flexible_months: flexibleMonths,
      card_minimum_due: cardMinStr ? toMinor(cardMinStr, currency) : null,
      due_date:
        mode === 'flexible' && flexibleMonths
          ? addMonths(isoDate(), flexibleMonths)
          : dueDateStr.trim() || null,
    };
    setBusy(true);
    try {
      if (editingId) await updateLoan(db, editingId, input);
      else await createLoan(db, input);
      void syncReminders(db);
      router.back();
    } catch {
      Alert.alert(t('misc.error'));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!editingId) return;
    Alert.alert(t('loan.delete'), t('loan.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteLoan(db, editingId);
          void syncReminders(db);
          router.dismissTo('/(tabs)/loans');
        },
      },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ScreenHeader title={editingId ? t('loan.edit') : t('loan.new')} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Field label={t('loan.name')} value={name} onChangeText={setName} />
          <Field label={`${t('loan.lender')} (${t('common.note')})`} value={lender} onChangeText={setLender} />
          <Chips<LoanType>
            label={t('loan.type')}
            value={type}
            onChange={setType}
            options={LOAN_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
          />
          <Chips<LoanMode>
            label={t('loan.mode')}
            value={mode}
            onChange={setMode}
            options={LOAN_MODES.map((v) => ({ value: v, label: t(`mode.${v}`) }))}
          />
        </Card>

        <Card>
          <Field
            label={t('loan.total')}
            value={totalStr}
            onChangeText={setTotalStr}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <Field
            label={t('loan.remaining')}
            value={remainingStr}
            onChangeText={setRemainingStr}
            keyboardType="decimal-pad"
            placeholder="0"
            hint={t('loan.remainingHint')}
          />
          <View style={styles.rateRow}>
            <View style={{ flex: 1 }}>
              <Field
                label={t('loan.rate')}
                value={rateStr}
                onChangeText={setRateStr}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
          </View>
          <Chips<RatePeriod>
            label={t('loan.ratePeriod')}
            value={ratePeriod}
            onChange={setRatePeriod}
            options={[
              { value: 'yearly', label: t('period.yearly') },
              { value: 'monthly', label: t('period.monthly') },
            ]}
          />
          <Chips<Compounding>
            label={t('loan.byaj')}
            value={compounding}
            onChange={setCompounding}
            options={[
              { value: 'simple_on_principal', label: t('byaj.simple') },
              { value: 'interest_on_interest', label: t('byaj.compound') },
            ]}
          />
        </Card>

        {mode === 'fixed_emi' ? (
          <Card>
            <Field label={t('loan.emiAmount')} value={emiStr} onChangeText={setEmiStr} keyboardType="decimal-pad" />
            <Field
              label={t('loan.emiDay')}
              value={emiDayStr}
              onChangeText={setEmiDayStr}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Card>
        ) : null}

        {mode === 'credit_card' ? (
          <Card>
            <Field label={t('loan.cardMin')} value={cardMinStr} onChangeText={setCardMinStr} keyboardType="decimal-pad" />
            <Field
              label={t('loan.dueDate')}
              value={dueDateStr}
              onChangeText={setDueDateStr}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </Card>
        ) : null}

        {mode === 'flexible' ? (
          <Card>
            <Field
              label={t('loan.flexAsk')}
              value={flexMonthsStr}
              onChangeText={setFlexMonthsStr}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Card>
        ) : null}

        <Card>
          <Field label={t('loan.purpose')} value={purpose} onChangeText={setPurpose} />
          <Chips<'yes' | 'no'>
            label={t('loan.purposeDone')}
            value={regret ? 'no' : 'yes'}
            onChange={(v) => setRegret(v === 'no')}
            options={[
              { value: 'yes', label: t('common.yes') },
              { value: 'no', label: t('common.no') },
            ]}
          />
        </Card>

        <Button label={editingId ? t('common.save') : t('common.add')} onPress={save} loading={busy} />
        {editingId ? (
          <Button label={t('loan.delete')} variant="danger" onPress={remove} style={{ marginTop: Spacing.two }} />
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {currency} · {t('loan.remainingHint')}
        </ThemedText>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  backBtn: { padding: 6 },
  content: { padding: Spacing.three, paddingTop: 0, gap: Spacing.three, paddingBottom: Spacing.six },
  rateRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
});
