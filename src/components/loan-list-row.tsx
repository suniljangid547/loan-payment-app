import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Badge, Card, Money, ProgressBar } from '@/components/ui';
import { formatMoney } from '@/core/money';
import type { RankedLoan } from '@/core/priority';
import type { ReasonKey } from '@/core/types';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function reasonTone(r: ReasonKey): 'danger' | 'warning' | 'success' {
  if (r === 'reason.overdue') return 'danger';
  if (r === 'reason.creditCard' || r === 'reason.minimumDue' || r === 'reason.highRate') return 'warning';
  return 'success';
}

export function LoanListRow({
  ranked,
  currency,
  rank,
  onPress,
}: {
  ranked: RankedLoan;
  currency: string;
  rank?: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const { loan } = ranked;
  const pct = loan.principal_total > 0 ? 1 - loan.principal_remaining / loan.principal_total : 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      <Card>
        <View style={styles.topRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.titleRow}>
              {rank ? (
                <View style={[styles.rank, { backgroundColor: rank === 1 ? colors.accent : colors.accentSoft }]}>
                  <ThemedText
                    style={{
                      color: rank === 1 ? colors.onAccent : colors.accent,
                      fontWeight: '800',
                      fontSize: 12,
                    }}>
                    {rank}
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText type="default" style={{ fontWeight: '700' }} numberOfLines={1}>
                {loan.name}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {loan.lender ? `${loan.lender} · ` : ''}
              {t(`type.${loan.type}`)}
              {ranked.isOverdue ? '' : ranked.nextDueIso ? ` · ${ranked.nextDueIso}` : ''}
            </ThemedText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Money value={formatMoney(loan.principal_remaining, currency, { compact: true })} size="md" />
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
              {t('loan.remaining')}
            </ThemedText>
          </View>
        </View>
        <ProgressBar pct={pct} />
        <View style={styles.badgeRow}>
          <Badge text={`${loan.interest_rate}% ${t(`period.${loan.rate_period}`)}`} tone="neutral" />
          {ranked.reasons.map((r) => (
            <Badge
              key={r}
              text={t(r)}
              tone={reasonTone(r)}
              icon={r === 'reason.overdue' ? 'alert' : r === 'reason.creditCard' ? 'credit-card-outline' : 'trending-up'}
            />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  titleRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  rank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
