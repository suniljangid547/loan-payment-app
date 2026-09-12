import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { Badge, Button, Card, Chips, Field, ProgressBar, SectionHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { addMonths, currentMonthLabel, isoDate, monthOf } from '@/core/dates';
import { formatMoney, toMinor } from '@/core/money';
import { parseReceiptText } from '@/core/ocr';
import { isPremium, paywallCopy } from '@/core/paywall';
import { voiceHint } from '@/core/widget';
import { PAY_METHODS, type PayMethod } from '@/core/types';
import { Spacing } from '@/constants/theme';
import {
  createExpense,
  deleteExpense,
  listCategories,
  listExpenses,
  monthSpendSummary,
  upsertBudget,
} from '@/db/repos';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type PersistedSettings } from '@/store/settings';

export default function ExpensesScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const currency = useSettings((s) => s.currency);
  const [month, setMonth] = useState(monthOf(isoDate()));

  const { data, reload } = useAsync(async () => {
    const [summary, categories, expenses] = await Promise.all([
      monthSpendSummary(db, month),
      listCategories(db),
      listExpenses(db, month),
    ]);
    return { summary, categories, expenses };
  }, [db, month]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const [amtStr, setAmtStr] = useState('');
  const [catId, setCatId] = useState<number | null>(null);
  const [method, setMethod] = useState<PayMethod>('upi');
  const [note, setNote] = useState('');
  const [budgetFor, setBudgetFor] = useState<number | null>(null);
  const [budgetStr, setBudgetStr] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const settings = useSettings();
  const wallCopy = paywallCopy(settings.language);

  const categories = data?.categories ?? [];
  const chosenCat = catId ?? categories[0]?.id ?? null;

  const addExpense = async () => {
    const amount = toMinor(amtStr, currency);
    if (amount <= 0 || chosenCat == null) return;
    await createExpense(db, chosenCat, amount, method, isoDate(), note.trim() || null);
    setAmtStr('');
    setNote('');
    reload();
  };

  const setBudget = async (categoryId: number) => {
    const limit = toMinor(budgetStr, currency);
    if (limit <= 0) return;
    await upsertBudget(db, month, categoryId, limit);
    setBudgetFor(null);
    setBudgetStr('');
    reload();
  };

  const confirmDelete = (expenseId: number) => {
    Alert.alert(t('common.delete'), t('exp.add'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(db, expenseId);
          reload();
        },
      },
    ]);
  };

  const catLabel = (s: { category_name: string | null; category_name_key: string | null }) =>
    s.category_name_key ? t(s.category_name_key) : (s.category_name ?? t('cat.other'));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.monthRow}>
        <Pressable onPress={() => setMonth(monthOf(addMonths(`${month}-01`, -1)))} hitSlop={12} style={styles.monthBtn}>
          <ThemedText type="default">‹</ThemedText>
        </Pressable>
        <ThemedText type="subtitle" style={{ fontSize: 20, lineHeight: 28 }}>
          {currentMonthLabel(month)}
        </ThemedText>
        <Pressable
          onPress={() => setMonth(monthOf(addMonths(`${month}-01`, 1)))}
          hitSlop={12}
          style={styles.monthBtn}
          disabled={month >= monthOf(isoDate())}>
          <ThemedText type="default">›</ThemedText>
        </Pressable>
      </View>

      <Card>
        <SectionHeader title={t('exp.add')} />
        <Field label={t('common.amount')} value={amtStr} onChangeText={setAmtStr} keyboardType="decimal-pad" placeholder="0" />
        <Chips<string>
          label={t('exp.category')}
          value={chosenCat != null ? String(chosenCat) : undefined}
          onChange={(v) => setCatId(Number(v))}
          options={categories.map((c) => ({
            value: String(c.id),
            label: c.name_key ? t(c.name_key) : (c.name ?? ''),
          }))}
        />
        <Chips<PayMethod>
          label={t('exp.method')}
          value={method}
          onChange={setMethod}
          options={PAY_METHODS.map((m) => ({ value: m, label: t(`paym.${m}`) }))}
        />
        <Field label={t('common.note')} value={note} onChangeText={setNote} hint={voiceHint(settings.language)} />
        {receiptUri ? (
          <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: colors.backgroundSelected }} resizeMode="cover" />
        ) : null}
        <View style={{ flexDirection: 'row', gap: Spacing.two }}>
          <Button
            label={`📷 ${t('exp.add')}`}
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onPress={async () => {
              const currentMonth = monthOf(isoDate());
              const freeLimit = 5;
              const s = useSettings.getState() as PersistedSettings & { receiptScansThisMonth: number; receiptScanMonth: string | null };
              const inMonth = s.receiptScanMonth === currentMonth;
              const used = inMonth ? s.receiptScansThisMonth : 0;
              if (!isPremium() && used >= freeLimit) {
                setPaywallOpen(true);
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (res.canceled || !res.assets[0]) return;
              const uri = res.assets[0].uri;
              setReceiptUri(uri);
              const fileName = (res.assets[0].fileName ?? '') as string;
              const parsed = parseReceiptText(fileName);
              if (parsed.amount) setAmtStr(String(parsed.amount / 100));
              if (!isPremium()) {
                useSettings.getState().update({
                  receiptScansThisMonth: used + 1,
                  receiptScanMonth: currentMonth,
                } as Partial<PersistedSettings>);
              }
            }}
          />
          <Button
            label="📸 Camera"
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onPress={async () => {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) return;
              const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
              if (res.canceled || !res.assets[0]) return;
              setReceiptUri(res.assets[0].uri);
            }}
          />
        </View>
        {paywallOpen ? (
          <Card style={{ backgroundColor: colors.warningSoft, borderColor: colors.warning }}>
            <ThemedText type="smallBold">{wallCopy.title}</ThemedText>
            {wallCopy.bullets.map((b) => (
              <ThemedText key={b} type="small">• {b}</ThemedText>
            ))}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button label={wallCopy.cta} size="sm" style={{ flex: 1 }} onPress={() => { useSettings.getState().update({ premium: true } as Partial<PersistedSettings>); setPaywallOpen(false); }} />
              <Button label={wallCopy.later} variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setPaywallOpen(false)} />
            </View>
          </Card>
        ) : null}
        <Button label={t('exp.add')} onPress={addExpense} />
      </Card>

      <SectionHeader title={t('exp.budget')} />
      {(data?.summary.length ?? 0) === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('common.none')}</ThemedText>
      ) : (
        data?.summary.map((s) => {
          const over = s.limit_amount != null && s.spent > s.limit_amount;
          const ratio = s.limit_amount && s.limit_amount > 0 ? s.spent / s.limit_amount : 0;
          const near = !over && ratio >= 0.8;
          return (
            <Card key={s.category_id}>
              <View style={styles.rowBetween}>
                <ThemedText type="default" style={{ fontWeight: '600' }}>
                  {catLabel(s)}
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: over ? colors.danger : near ? colors.warning : colors.text }}>
                  {s.limit_amount
                    ? t('exp.spent', {
                        a: formatMoney(s.spent, currency, { compact: true }),
                        b: formatMoney(s.limit_amount, currency, { compact: true }),
                      })
                    : formatMoney(s.spent, currency, { compact: true })}
                </ThemedText>
              </View>
              {s.limit_amount ? (
                <ProgressBar
                  pct={ratio}
                  color={over ? colors.danger : near ? colors.warning : colors.accent}
                />
              ) : null}
              {over ? (
                <ThemedText type="small" style={{ color: colors.danger }}>
                  {t('exp.over', { amt: formatMoney(s.spent - (s.limit_amount ?? 0), currency) })}
                </ThemedText>
              ) : near ? (
                <ThemedText type="small" style={{ color: colors.warning }}>
                  {t('exp.close', { pct: Math.round(ratio * 100) })}
                </ThemedText>
              ) : null}
              {budgetFor === s.category_id ? (
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1, marginRight: Spacing.two }}>
                    <Field label={t('exp.budget')} value={budgetStr} onChangeText={setBudgetStr} keyboardType="decimal-pad" placeholder="0" />
                  </View>
                  <Button label={t('exp.setBudget')} variant="secondary" onPress={() => setBudget(s.category_id)} style={{ marginBottom: 2 }} />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setBudgetFor(s.category_id);
                    setBudgetStr(s.limit_amount ? String(s.limit_amount / 100) : '');
                  }}
                  hitSlop={8}>
                  <ThemedText type="link">{s.limit_amount ? t('exp.budget') : t('exp.setBudget')}</ThemedText>
                </Pressable>
              )}
            </Card>
          );
        })
      )}

      <SectionHeader title={t('exp.method')} />
      {(data?.expenses.length ?? 0) === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('common.none')}</ThemedText>
      ) : (
        PAY_METHODS.map((m) => {
          const total = data!.expenses.reduce((s, e) => (e.pay_method === m ? s + e.amount : s), 0);
          if (total <= 0) return null;
          const monthTotal = data!.expenses.reduce((s, e) => s + e.amount, 0);
          return (
            <Card key={`split-${m}`}>
              <View style={styles.rowBetween}>
                <Badge text={t(`paym.${m}`)} tone="neutral" />
                <ThemedText type="smallBold">
                  {formatMoney(total, currency)}
                  <ThemedText type="small" themeColor="textSecondary">
                    {' '}
                    · {Math.round((total / monthTotal) * 100)}%
                  </ThemedText>
                </ThemedText>
              </View>
              <ProgressBar pct={total / monthTotal} />
            </Card>
          );
        })
      )}

      <SectionHeader title={t('tabs.expenses')} />
      {(data?.expenses.length ?? 0) === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('common.none')}</ThemedText>
      ) : (
        data?.expenses.map((e) => {
          const cat = categories.find((c) => c.id === e.category_id);
          return (
            <Pressable key={e.id} onLongPress={() => confirmDelete(e.id)}>
              <View style={styles.expenseRow}>
                <ThemedText type="small" style={{ width: 86 }} themeColor="textSecondary">
                  {e.occurred_on}
                </ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="small" style={{ fontWeight: '600' }}>
                    {cat ? (cat.name_key ? t(cat.name_key) : cat.name) : ''}
                  </ThemedText>
                  {e.note ? (
                    <ThemedText type="small" themeColor="textSecondary">{e.note}</ThemedText>
                  ) : null}
                </View>
                <Badge text={t(`paym.${e.pay_method}`)} tone="neutral" />
                <ThemedText type="smallBold">{formatMoney(e.amount, currency)}</ThemedText>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
