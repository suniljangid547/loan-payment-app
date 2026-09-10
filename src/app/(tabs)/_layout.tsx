import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs, useTheme } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const icon = (name: React.ComponentProps<typeof MaterialCommunityIcons>['name']) => {
    const TabIcon = function TabIcon({
      color,
      size,
    }: {
      focused: boolean;
      color: React.ComponentProps<typeof MaterialCommunityIcons>['color'];
      size: number;
    }) {
      return <MaterialCommunityIcons name={name} color={color} size={size} />;
    };
    return TabIcon;
  };
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home-variant') }} />
      <Tabs.Screen name="loans" options={{ title: t('tabs.loans'), tabBarIcon: icon('cash-minus') }} />
      <Tabs.Screen name="income" options={{ title: t('tabs.income'), tabBarIcon: icon('cash-plus') }} />
      <Tabs.Screen
        name="expenses"
        options={{ title: t('tabs.expenses'), tabBarIcon: icon('food-variant') }}
      />
      <Tabs.Screen name="plan" options={{ title: t('tabs.plan'), tabBarIcon: icon('chart-line') }} />
    </Tabs>
  );
}
