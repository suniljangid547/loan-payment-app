import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, Field, Select } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ensureSelfPerson } from '@/db/repos';
import i18n from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import {
  COUNTRIES,
  countryByCode,
  currencyForCountry,
  useSettings,
  type Language,
} from '@/store/settings';

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const update = useSettings((s) => s.update);

  const [step, setStep] = useState<0 | 1>(0);
  const [country, setCountry] = useState<string>('IN');
  const [language, setLanguage] = useState<Language>('en');
  const [name, setName] = useState('');
  const [insurance, setInsurance] = useState<'yes' | 'no' | null>(null);
  const [busy, setBusy] = useState(false);

  const countryDef = countryByCode(country);
  const langOptions = countryDef.languages.map((l) => ({
    value: l.code,
    label: `${l.native} (${l.english})`,
  }));

  const pickLanguage = (code: Language) => {
    setLanguage(code);
    void i18n.changeLanguage(code);
  };

  const pickCountry = (code: string) => {
    setCountry(code);
    const def = countryByCode(code);
    if (!def.languages.some((l) => l.code === language)) {
      pickLanguage(def.languages[0].code);
    }
  };

  const start = async () => {
    if (!name.trim()) {
      Alert.alert(t('misc.error'), t('onb.nameLabel'));
      return;
    }
    setBusy(true);
    try {
      await ensureSelfPerson(db, name.trim());
      update({
        onboarded: true,
        name: name.trim(),
        language,
        country,
        currency: currencyForCountry(country),
        hasInsurance: insurance === 'yes',
      });
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <ThemedText type="code" style={{ color: colors.accent }}>
        {t('app.name')}
      </ThemedText>
      <ThemedText type="title" style={{ fontSize: 34, lineHeight: 42 }}>
        {t('onb.title')}
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary">
        {t('onb.sub')}
      </ThemedText>

      <View style={styles.dots}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: step === i ? colors.accent : colors.backgroundSelected },
            ]}
          />
        ))}
      </View>

      {step === 0 ? (
        <Card style={{ marginTop: Spacing.two }}>
          <Select
            label={t('onb.countryLabel')}
            value={country}
            onChange={pickCountry}
            placeholder={t('onb.countryLabel')}
            options={COUNTRIES.map((c) => ({
              value: c.code,
              label: `${c.flag}  ${c.name} · ${c.currency}`,
            }))}
          />
          <Chips<string>
            label={t('onb.languageLabel')}
            value={language}
            onChange={pickLanguage}
            options={langOptions}
          />
        </Card>
      ) : (
        <Card style={{ marginTop: Spacing.two }}>
          <Field
            label={t('onb.nameLabel')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder={t('common.name')}
            autoFocus
          />
          <Chips<'yes' | 'no'>
            label={t('onb.insurance')}
            value={insurance ?? undefined}
            onChange={setInsurance}
            options={[
              { value: 'yes', label: t('common.yes') },
              { value: 'no', label: t('common.no') },
            ]}
          />
        </Card>
      )}

      <View style={styles.actions}>
        {step === 1 ? (
          <Pressable
            onPress={() => setStep(0)}
            hitSlop={12}
            accessibilityRole="button"
            style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={colors.text} />
            <ThemedText type="small">{t('common.back')}</ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        {step === 0 ? (
          <Button label={t('common.next')} onPress={() => setStep(1)} style={{ minWidth: 120 }} />
        ) : (
          <Button label={t('onb.start')} onPress={start} loading={busy} style={{ minWidth: 120 }} />
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    paddingTop: Spacing.six,
    gap: Spacing.three,
    flexGrow: 1,
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  dot: { width: 26, height: 5, borderRadius: 999 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.two },
});
