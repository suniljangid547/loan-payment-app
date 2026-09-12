/**
 * Hallucination-safe "LLM coach" — purely deterministic, offline.
 * All numbers come from the rules engines (priority, plan, coach). This
 * module only *explains* them in Hinglish/English/Hindi using templates
 * so there is never a free-form model that can invent a figure.
 * When a real cloud LLM is wired later, it must receive only these
 * pre-computed facts and be prompted to "explain, don't calculate".
 */

import { formatMoney } from './money';
import { type TranslationKey } from '@/i18n/translations';
import { t } from '@/i18n';
import type { LoanRow } from './types';

export interface CoachFacts {
  topLoan: LoanRow | null;
  monthlyInterest: number; // minor
  reasons: string[]; // already localized fragments
  extra: number; // minor
  interestSaved: number; // minor
  monthsSaved: number | null;
  currency: string;
  lang: 'en' | 'hi' | 'hinglish';
}

export interface CoachLine {
  emoji: string;
  text: string;
}

/** Build 2–3 short coach lines from verified facts. Zero network, zero hallucination. */
export function coachLines(facts: CoachFacts): CoachLine[] {
  const { topLoan, currency } = facts;
  if (!topLoan) return [{ emoji: '👋', text: t('dash.noLoans.sub') }];
  const drop = facts.extra > 0 ? formatMoney(facts.extra, currency) : null;

  const lines: CoachLine[] = [
    {
      emoji: '🎯',
      text: t('reason.highRate').length
        ? localizedTopLoan(facts)
        : `${topLoan.name} · ${formatMoney(facts.monthlyInterest, currency)}/mo`,
    },
  ];

  if (facts.reasons.length > 0) {
    lines.push({ emoji: '📌', text: facts.reasons.slice(0, 2).join(' · ') });
  }

  if (facts.extra > 0 && facts.interestSaved > 0) {
    const saved = formatMoney(facts.interestSaved, currency, { compact: true });
    const n = facts.monthsSaved ?? 0;
    const key: TranslationKey =
      n > 0 ? 'coach.impact' : 'coach.impactInt';
    lines.push({
      emoji: '💡',
      text:
        n > 0
          ? t(key, { loan: topLoan.name, n, int: saved })
          : t(key, { loan: topLoan.name, int: saved }),
    });
    if (drop) {
      void drop;
    }
  }

  return lines.slice(0, 3);
}

function localizedTopLoan(facts: CoachFacts): string {
  const { topLoan, monthlyInterest, currency } = facts;
  if (!topLoan) return '';
  const why =
    facts.reasons[0] ??
    (facts.lang === 'hi'
      ? 'सबसे ज्यादा ब्याज'
      : facts.lang === 'hinglish'
        ? 'sabse mehnga byaj'
        : 'highest interest');
  return `${topLoan.name} — ${why} · ${formatMoney(monthlyInterest, currency)}/mo`;
}

export function coachQuestionBanks(): string[] {
  return [
    t('redirect.q', { name: '{loan}', amt: '{amt}' }),
  ];
}
