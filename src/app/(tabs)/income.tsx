import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { Button, Card, Chips, Field, SectionHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { isoDate, monthOf } from '@/core/dates';
import { baselinePayment } from '@/core/interest';
import { formatMoney, toMinor } from '@/core/money';
import { CADENCES, INCOME_TYPES, type Cadence, type IncomeType } from '@/core/types';
import { activeLoans } from '@/core/types';
import { Spacing } from '@/constants/theme';
import {
  addPerson,
  createIncomeEvent,
  createIncomeSource,
  ensureSelfPerson,
  getShortMonthReason,
  listIncomeEvents,
  listIncomeSources,
  listLoans,
  listPersons,
} from '@/db/repos';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/store/settings';

export default function IncomeScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const { name, currency } = useSettings();
  const month = monthOf(isoDate());

  const { data, reload } = useAsync(async () => {
    await ensureSelfPerson(db, name || 'Me');
    const [persons, sources, events, loans] = await Promise.all([
      listPersons(db),
      listIncomeSources(db),
      listIncomeEvents(db, month),
      listLoans(db),
    ]);
    const self = persons.find((p) => p.is_self === 1) ?? persons[0];
    return { persons, sources, events, loans, self };
  }, [db, month, name]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const persons = data?.persons ?? [];
  const selfId = data?.self?.id ?? 1;

  const [chosenPersonId, setPersonId] = useState<number | null>(null);
  const personId =
    chosenPersonId !== null && persons.some((p) => p.id === chosenPersonId)
      ? chosenPersonId
      : selfId;
  const [newPerson, setNewPerson] = useState('');

  // record money received
  const [recAmt, setRecAmt] = useState('');
  const [recNote, setRecNote] = useState('');
  const record = async () => {
    const amount = toMinor(recAmt, currency);
    if (amount <= 0) return;
    await createIncomeEvent(db, personId, amount, isoDate(), null, recNote.trim() || null);
    setRecAmt('');
    setRecNote('');
    reload();
    const actives = data ? activeLoans(data.loans) : [];
    if (actives.length > 0) {
      const need = actives.reduce((s, l) => s + baselinePayment(l), 0);
      const monthIncome = (data?.events.reduce((s, e) => s + e.amount, 0) ?? 0) + amount;
      const alreadyLogged = await getShortMonthReason(db, month);
      if (monthIncome < need && !alreadyLogged) {
        router.push('/short-month');
      } else {
        router.push({ pathname: '/allocate', params: { amount: String(amount) } });
      }
    }
  };

  // add source
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState<IncomeType>('salary');
  const [srcCadence, setSrcCadence] = useState<Cadence>('monthly_fixed');
  const [srcExpected, setSrcExpected] = useState('');
  const addSource = async () => {
    if (!srcName.trim()) return;
    await createIncomeSource(db, {
      person_id: personId,
      name: srcName.trim(),
      type: srcType,
      cadence: srcCadence,
      expected_day: null,
      expected_amount: srcExpected ? toMinor(srcExpected, currency) : null,
    });
    setSrcName('');
    setSrcExpected('');
    reload();
  };

  const addPersonFn = async () => {
    if (!newPerson.trim()) return;
    const id = await addPerson(db, newPerson.trim());
    setNewPerson('');
    setPersonId(id);
    reload();
  };

  const total = data?.events.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="subtitle" style={{ fontSize: 26, lineHeight: 34 }}>{t('inc.title')}</ThemedText>

      <Card>
        <SectionHeader title={t('inc.record')} />
        {persons.length > 1 ? (
          <Chips<string>
            label={t('inc.who')}
            value={String(personId)}
            onChange={(v) => setPersonId(Number(v))}
            options={persons.map((p) => ({ value: String(p.id), label: p.is_self ? t('inc.me') : p.name }))}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label={t('common.amount')} value={recAmt} onChangeText={setRecAmt} keyboardType="decimal-pad" placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={`${t('common.note')} (${t('common.name')})`} value={recNote} onChangeText={setRecNote} />
          </View>
        </View>
        <Button label={t('inc.record')} onPress={record} />
        <Button label={t('sm.title')} variant="ghost" size="sm" onPress={() => router.push('/short-month')} />
        <View style={styles.personAddRow}>
          <View style={{ flex: 1 }}>
            <Field label={t('inc.addPerson')} value={newPerson} onChangeText={setNewPerson} />
          </View>
          <Button label="+" size="sm" variant="secondary" onPress={addPersonFn} style={{ marginBottom: 2 }} />
        </View>
      </Card>

      <SectionHeader title={t('inc.events')} right={<ThemedText type="smallBold" style={{ color: colors.success }}>{formatMoney(total, currency)}</ThemedText>} />
      {(data?.events.length ?? 0) === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('inc.none')}</ThemedText>
      ) : (
        data?.events.map((e) => (
          <Card key={e.id} style={styles.rowCard}>
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                {e.source_name ?? e.note ?? t('inc.record')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {e.occurred_on} · {e.person_name}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" style={{ color: colors.success }}>
              +{formatMoney(e.amount, currency)}
            </ThemedText>
          </Card>
        ))
      )}

      <SectionHeader title={t('inc.sources')} />
      {(data?.sources.length ?? 0) === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">{t('inc.none')}</ThemedText>
      ) : (
        data?.sources.map((s) => (
          <Card key={s.id} style={styles.rowCard}>
            <View style={{ flex: 1 }}>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                {s.name} <ThemedText type="small" themeColor="textSecondary">· {t(`itype.${s.type}`)} · {t(`cad.${s.cadence}`)} · {s.person_name}</ThemedText>
              </ThemedText>
            </View>
            {s.expected_amount ? (
              <ThemedText type="small" themeColor="textSecondary">
                {formatMoney(s.expected_amount, currency, { compact: true })} / {t('common.months')}
              </ThemedText>
            ) : null}
          </Card>
        ))
      )}

      <Card>
        <SectionHeader title={t('inc.addSource')} />
        <Field label={t('common.name')} value={srcName} onChangeText={setSrcName} />
        <Chips<IncomeType>
          value={srcType}
          onChange={setSrcType}
          options={INCOME_TYPES.map((v) => ({ value: v, label: t(`itype.${v}`) }))}
        />
        <Chips<Cadence>
          value={srcCadence}
          onChange={setSrcCadence}
          options={CADENCES.map((v) => ({ value: v, label: t(`cad.${v}`) }))}
        />
        <Field label={t('inc.expected')} value={srcExpected} onChangeText={setSrcExpected} keyboardType="decimal-pad" placeholder="0" />
        <Button label={t('inc.addSource')} onPress={addSource} variant="secondary" />
      </Card>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  rowCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three, gap: Spacing.two },
  personAddRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' },
});
