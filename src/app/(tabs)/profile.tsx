import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import expoConfig from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { Button, Card, SectionHeader, Select } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { voiceHint } from '@/core/widget';
import { paywallCopy } from '@/core/paywall';
import { isoDate } from '@/core/dates';
import { exportBackup, restoreBackup, validateBackup, type BackupSettings } from '@/db/backup';
import { DATABASE_VERSION } from '@/db/schema';
import { syncReminders } from '@/core/notify';
import { Spacing } from '@/constants/theme';
import i18n from '@/i18n';
import { useTheme } from '@/hooks/use-theme';
import {
  COUNTRIES,
  countryByCode,
  currencyForCountry,
  useSettings,
  type LangDef,
  type PersistedSettings,
} from '@/store/settings';

const ALL_LANGS: LangDef[] = Object.values(
  COUNTRIES.reduce<Record<string, LangDef>>((acc, c) => {
    for (const l of c.languages) acc[l.code] = l;
    return acc;
  }, {}),
);

const PRIVACY_URL = 'https://suniljangid547.github.io/loan-payment-app/privacy-policy.html';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const colors = useTheme();
  const settings = useSettings();
  const update = useSettings((s) => s.update);
  const [busy, setBusy] = useState(false);
  const version = expoConfig?.version ?? '1.0.0';

  const pickLanguage = (code: string) => {
    update({ language: code });
    void i18n.changeLanguage(code);
  };

  const pickCountry = (code: string) => {
    update({ country: code, currency: currencyForCountry(code) });
  };

  const exportNow = async () => {
    setBusy(true);
    try {
      const backup = await exportBackup(db, {
        onboarded: settings.onboarded,
        name: settings.name,
        language: settings.language,
        country: settings.country,
        currency: settings.currency,
        hasInsurance: settings.hasInsurance,
        insuranceDismissed: settings.insuranceDismissed,
        fundTarget: settings.fundTarget,
        skills: settings.skills,
      });
      const file = new File(Paths.cache, `loanpay-backup-${isoDate()}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(backup, null, 2));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: t('prof.backup'),
        });
      } else {
        Alert.alert(t('prof.backup'), t('prof.shareUnavailable'));
      }
    } catch {
      Alert.alert(t('misc.error'));
    } finally {
      setBusy(false);
    }
  };

  const importNow = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(new File(res.assets[0].uri).textSync());
      } catch {
        Alert.alert(t('misc.error'), t('prof.badFile'));
        return;
      }
      const probe = parsed as { app?: string; schemaVersion?: number } | null;
      if (
        probe &&
        typeof probe === 'object' &&
        probe.app === 'loanpay' &&
        typeof probe.schemaVersion === 'number' &&
        probe.schemaVersion > 0
      ) {
        const backup = validateBackup(parsed);
        if (backup) {
          Alert.alert(t('prof.import'), t('prof.importWarn'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.yes'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await restoreBackup(db, backup);
                  applySettings(backup.settings);
                  void syncReminders(db);
                  Alert.alert(t('app.name'), t('prof.restored'));
                } catch {
                  Alert.alert(t('misc.error'));
                }
              },
            },
          ]);
          return;
        }
        if ((probe.schemaVersion ?? 0) > DATABASE_VERSION) {
          Alert.alert(t('misc.error'), t('prof.newerFile'));
          return;
        }
      }
      Alert.alert(t('misc.error'), t('prof.badFile'));
    } catch {
      Alert.alert(t('misc.error'));
    }
  };

  const applySettings = (s: BackupSettings | null) => {
    if (!s) return;
    const next: Partial<PersistedSettings> = {
      onboarded: typeof s.onboarded === 'boolean' ? s.onboarded : settings.onboarded,
      name: typeof s.name === 'string' ? s.name : settings.name,
      language: typeof s.language === 'string' ? s.language : settings.language,
      country: typeof s.country === 'string' ? s.country : settings.country,
      currency: typeof s.currency === 'string' ? s.currency : settings.currency,
      hasInsurance: typeof s.hasInsurance === 'boolean' ? s.hasInsurance : null,
      insuranceDismissed: s.insuranceDismissed === true,
      fundTarget: typeof s.fundTarget === 'number' ? s.fundTarget : null,
      skills: Array.isArray(s.skills)
        ? s.skills.filter((x): x is string => typeof x === 'string')
        : [],
    };
    if (typeof (s as unknown as Record<string, unknown>).premium === 'boolean') {
      (next as Record<string, unknown>).premium = (s as unknown as Record<string, unknown>).premium;
    }
    update(next);
    if (typeof s.language === 'string') void i18n.changeLanguage(s.language);
  };

  const premium = (settings as unknown as { premium?: boolean }).premium ?? false;
  const wallCopy = paywallCopy(settings.language);

  const shareFamily = async () => {
    try {
      const backup = await exportBackup(db, {
        onboarded: settings.onboarded,
        name: settings.name,
        language: settings.language,
        country: settings.country,
        currency: settings.currency,
        hasInsurance: settings.hasInsurance,
        insuranceDismissed: settings.insuranceDismissed,
        fundTarget: settings.fundTarget,
        skills: settings.skills,
      });
      const payload = JSON.stringify({ ...backup, _share: 'family-readonly', sharedAt: isoDate() }, null, 2);
      await Share.share({ message: payload.slice(0, 8000) });
    } catch {
      Alert.alert(t('misc.error'));
    }
  };

  const countryDef = countryByCode(settings.country);
  const langOptions = countryDef.languages.map((l) => ({
    value: l.code,
    label: `${l.native} (${l.english})`,
  }));
  const countryLabel = (c: (typeof COUNTRIES)[number]) => `${c.flag}  ${c.name} · ${c.currency}`;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <SectionHeader title={t('onb.countryLabel')} />
        <Card>
          <Select
            label={t('onb.countryLabel')}
            value={settings.country}
            onChange={pickCountry}
            placeholder={t('onb.countryLabel')}
            options={COUNTRIES.map((c) => ({ value: c.code, label: countryLabel(c) }))}
          />
          <Select
            label={t('onb.languageLabel')}
            value={settings.language}
            onChange={pickLanguage}
            placeholder={t('onb.languageLabel')}
            options={
              countryDef.languages.some((l) => l.code === settings.language)
                ? langOptions
                : ALL_LANGS.map((l) => ({ value: l.code, label: `${l.native} (${l.english})` }))
            }
          />
        </Card>

        <SectionHeader title={t('prof.backup')} />
        <Card>
          <Button label={t('prof.export')} onPress={exportNow} loading={busy} />
          <Button label={t('prof.import')} variant="secondary" onPress={importNow} />
          <Button label="Family read-only share (WhatsApp)" variant="secondary" onPress={shareFamily} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('prof.privacy')}
          </ThemedText>
        </Card>

        <SectionHeader title={premium ? 'Premium ✓' : 'Premium'} />
        <Card style={premium ? { backgroundColor: colors.accentSoft, borderColor: colors.accent } : undefined}>
          <ThemedText type="smallBold">{wallCopy.title}</ThemedText>
          {wallCopy.bullets.map((b) => (
            <ThemedText key={b} type="small">• {b}</ThemedText>
          ))}
          {premium ? (
            <ThemedText type="small" style={{ color: colors.success }}>Active on this phone — no key needed.</ThemedText>
          ) : (
            <Button label={wallCopy.cta} onPress={() => update({ premium: true } as Partial<PersistedSettings>)} />
          )}
          <ThemedText type="small" themeColor="textSecondary">{voiceHint(settings.language)}</ThemedText>
        </Card>

        <SectionHeader title={t('prof.about')} />
        <Card>
          <ThemedText type="smallBold">
            {t('app.name')} · {t('prof.version', { v: version })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('prof.disclaimer')}
          </ThemedText>
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(PRIVACY_URL)}>
            <ThemedText type="link">{t('prof.policy')}</ThemedText>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
});
