import { addMonths, daysBetween, isoDate, nextDueDate } from './dates';
import { annualPct, interestDue, monthlyRate } from './interest';
import { activeLoans, type LoanRow, type ReasonKey } from './types';

export interface RankedLoan {
  loan: LoanRow;
  score: number;
  reasons: ReasonKey[];
  nextDueIso: string | null;
  daysToDue: number | null;
  isOverdue: boolean;
  monthlyInterest: number;
}

function dueInfo(loan: LoanRow, todayIso: string): { iso: string | null; days: number | null } {
  if (loan.mode === 'fixed_emi' && loan.emi_day) {
    const iso = nextDueDate(loan.emi_day, todayIso);
    return { iso, days: daysBetween(todayIso, iso) };
  }
  if ((loan.mode === 'credit_card' || loan.mode === 'flexible') && loan.due_date) {
    const days = daysBetween(todayIso, loan.due_date);
    return { iso: loan.due_date, days };
  }
  return { iso: null, days: null };
}

export function rankLoans(loans: LoanRow[], todayIso: string = isoDate()): RankedLoan[] {
  const actives = activeLoans(loans);
  const totalRemaining = actives.reduce((s, l) => s + l.principal_remaining, 0);
  const ranked = actives.map((loan) => {
    const reasons: ReasonKey[] = [];
    const rate = annualPct(loan);
    const rateScore = Math.min(rate / 48, 1);
    if (rate >= 24) reasons.push('reason.highRate');

    const { iso, days } = dueInfo(loan, todayIso);
    const isOverdue = days !== null && days < 0;
    let dueScore = 0.15;
    if (isOverdue) {
      dueScore = 1;
      reasons.push('reason.overdue');
    } else if (days !== null && days <= 7) {
      dueScore = 0.85;
      reasons.push('reason.dueSoon');
    } else if (days !== null && days <= 30) {
      dueScore = 0.55;
    }

    const share = totalRemaining > 0 ? loan.principal_remaining / totalRemaining : 1;
    const sizeScore = 1 - Math.min(share * 2, 1);
    if (sizeScore >= 0.7 && loan.principal_remaining > 0) reasons.push('reason.smallWin');

    const regret = loan.purpose_regret === 1 ? 1 : 0;
    if (regret) reasons.push('reason.failedPurpose');

    let cardScore = 0;
    if (loan.mode === 'credit_card') {
      cardScore = 1;
      reasons.push('reason.creditCard');
      const min = loan.card_minimum_due ?? Math.round(loan.principal_remaining * 0.05);
      if (min > 0 && interestDue(loan) > min * 0.5) reasons.push('reason.minimumDue');
    }

    const score =
      0.32 * rateScore + 0.24 * dueScore + 0.16 * sizeScore + 0.14 * regret + 0.14 * cardScore;
    return {
      loan,
      score,
      reasons: reasons.slice(0, 3),
      nextDueIso: iso,
      daysToDue: days,
      isOverdue,
      monthlyInterest: Math.round(interestDue(loan)),
    } satisfies RankedLoan;
  });
  return ranked.sort((a, b) => b.score - a.score);
}

export { addMonths, monthlyRate };
