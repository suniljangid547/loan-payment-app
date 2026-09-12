/**
 * M5 widget data + voice-input affordance.
 * - Expo widgets (native) are not yet available in Expo Go; this module
 *   exposes a pure, testable serializer for the "today's plan" payload that
 *   a native widget can later consume via a shared JSON file.
 * - Voice input: the OS keyboard mic already works in every TextInput
 *   (no code needed). We only add a small hint util and a helper to
 *   suggest which field benefits most from dictation.
 */

import { addMonths, daysBetween, isoDate, monthOf } from './dates';
import { formatMoney } from './money';
import type { LoanRow } from './types';

export interface WidgetPayload {
  generatedAt: string; // ISO
  month: string; // YYYY-MM
  totalRemaining: number; // minor
  dueThisWeek: { id: number; name: string; dueIso: string; days: number }[];
  topPriority?: { id: number; name: string; reason: string };
  idea?: string;
  coach?: string;
  disclaimer: string;
}

export function buildWidgetPayload(opts: {
  loans: LoanRow[];
  totalRemaining: number;
  todayIso?: string;
  topReason?: string;
  ideaLabel?: string | null;
  coachLine?: string | null;
  currency: string;
}): WidgetPayload {
  const today = opts.todayIso ?? isoDate();
  const month = monthOf(today);
  const dueThisWeek: WidgetPayload['dueThisWeek'] = [];

  for (const l of opts.loans.filter((x) => x.status === 'active' && x.principal_remaining > 0)) {
    let dueIso: string | null = null;
    if (l.mode === 'fixed_emi' && l.emi_day) {
      const d = l.emi_day;
      const candidate = `${month}-${String(d).padStart(2, '0')}`;
      const d2 = new Date(`${candidate}T12:00:00`);
      const t = new Date(`${today}T12:00:00`);
      dueIso = d2 < t ? addMonths(candidate, 1).slice(0, 10) : candidate;
    } else if (l.due_date) {
      dueIso = l.due_date;
    }
    if (!dueIso) continue;
    const days = daysBetween(today, dueIso);
    if (days >= 0 && days <= 7) dueThisWeek.push({ id: l.id, name: l.name, dueIso, days });
  }

  dueThisWeek.sort((a, b) => a.days - b.days);

  const active = opts.loans.filter((l) => l.status === 'active' && l.principal_remaining > 0);
  const top = active[0] as LoanRow | undefined;

  return {
    generatedAt: new Date().toISOString(),
    month,
    totalRemaining: opts.totalRemaining,
    dueThisWeek: dueThisWeek.slice(0, 3),
    topPriority: top ? { id: top.id, name: top.name, reason: opts.topReason ?? `— ${formatMoney(0, opts.currency)}` } : undefined,
    idea: opts.ideaLabel ?? undefined,
    coach: opts.coachLine ?? undefined,
    disclaimer: 'Not a lender · figures are estimates — verify with your lender.',
  };
}

/** Small copy helper: which fields are dictation-friendly. */
export function voiceHint(lang: string): string {
  if (lang === 'hi') return '🎤 कीबोर्ड के माइक से बोलकर भरें';
  if (lang === 'hinglish') return '🎤 keyboard ke mic se bol kar bharo';
  return '🎤 Tap the keyboard mic to dictate';
}
