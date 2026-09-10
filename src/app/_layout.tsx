import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { ReminderSync } from '@/components/reminder-sync';
import { initNotificationHandler } from '@/core/notify';
import { migrateDbIfNeeded } from '@/db/schema';
import i18n from '@/i18n';
import { useSettings } from '@/store/settings';

SplashScreen.preventAutoHideAsync();
initNotificationHandler();

export default function RootLayout() {
  const scheme = useColorScheme();
  const language = useSettings((s) => s.language);
  const isDark = scheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="loanpay.db" onInit={migrateDbIfNeeded} useSuspense>
        <ThemeProvider
          value={{
            ...(isDark ? DarkTheme : DefaultTheme),
            colors: {
              ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
              background: colors.background,
              card: colors.backgroundElement,
              text: colors.text,
              primary: colors.accent,
              border: colors.border,
            },
          }}>
          <Suspense fallback={null}>
            <ReminderSync />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.text,
                headerTitleStyle: { fontWeight: '700' },
                contentStyle: { backgroundColor: colors.background },
                animation: Platform.OS === 'ios' ? 'default' : 'slide_from_right',
              }}>
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="loan/new" options={{ headerShown: false }} />
              <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="allocate" options={{ headerShown: false }} />
              <Stack.Screen name="short-month" options={{ headerShown: false }} />
            </Stack>
          </Suspense>
        </ThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
