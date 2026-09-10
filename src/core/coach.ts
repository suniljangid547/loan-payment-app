import { baselinePayment, projectPayoff } from './interest';
import { rankLoans } from './priority';
import { activeLoans, type LoanRow } from './types';

export interface CoachCategoryInput {
  category_id: number;
  category_name: string | null;
  category_name_key: string | null;
  is_fixed: 0 | 1 | boolean;
  spent: number;
  limit_amount: number | null;
}

export interface CoachSuggestion {
  kind: 'over' | 'cut';
  categoryId: number;
  categoryLabelKey: string | null;
  categoryLabel: string | null;
  spent: number;
  cut: number;
  overAmt: number;
  targetLoanId: number;
  targetLoanName: string;
  monthsSaved: number | null;
  /** baseline never closes → extra payment makes it close in ~N months */
  closesIn: number | null;
  interestSaved: number;
}

export const CUT_RATIO = 0.25;
const MIN_CUT = 10000; // ₹100/month — below this the nudge is noise
const MIN_SPENT = 50000; // ₹500 — don't coach on tiny spends

/**
 * Deterministic spending coach (Q15–16): the biggest non-essential category
 * either over budget or trimmed by 25% becomes an extra EMI on the #1
 * priority loan. All numbers come from real data — no invented figures.
 */
export function spendingCoach(
  summary: CoachCategoryInput[],
  loans: LoanRow[],
  todayIso: string,
): CoachSuggestion | null {
  const actives = activeLoans(loans);
  if (actives.length === 0) return null;
  const top = rankLoans(loans, todayIso)[0]?.loan;
  if (!top) return null;

  const candidates = summary
    .filter((s) => !s.is_fixed && s.spent >= MIN_SPENT)
    .sort((a, b) => b.spent - a.spent);
  if (candidates.length === 0) return null;

  const base = baselinePayment(top);
  const without = projectPayoff(top, base, 360);
  const withExtra = (extra: number) => {
    const p = projectPayoff(top, base + extra, 360);
    if (without.months !== null && p.months !== null) {
      return {
        monthsSaved: Math.max(0, without.months - p.months),
        closesIn: null,
        interestSaved: Math.max(0, without.totalInterest - p.totalInterest),
      };
    }
    return {
      monthsSaved: null,
      // genuine trap: a payment exists but never covers interest — not a
      // 0%-interest flexible loan whose baseline is simply no payment
      closesIn: without.months === null && base > 0 ? p.months : null,
      interestSaved: 0,
    };
  };

  const build = (
    kind: CoachSuggestion['kind'],
    c: CoachCategoryInput,
    cut: number,
    overAmt: number,
  ): CoachSuggestion => {
    const w = withExtra(cut);
    return {
      kind,
      categoryId: c.category_id,
      categoryLabelKey: c.category_name_key,
      categoryLabel: c.category_name,
      spent: c.spent,
      cut,
      overAmt,
      targetLoanId: top.id,
      targetLoanName: top.name,
      monthsSaved: w.monthsSaved,
      closesIn: w.closesIn,
      interestSaved: w.interestSaved,
    };
  };

  // 1) over-budget variable category → suggest getting back to the limit
  const over = candidates.find((s) => s.limit_amount != null && s.spent > s.limit_amount);
  if (over) {
    const cut = Math.min(over.spent - (over.limit_amount ?? 0), over.spent);
    if (cut >= MIN_CUT) return build('over', over, cut, cut);
  }

  // 2) biggest variable category → 25% cut
  const best = candidates[0];
  const cut = Math.max(Math.round(best.spent * CUT_RATIO), 0);
  if (cut < MIN_CUT) return null;
  const w = withExtra(cut);
  if ((w.monthsSaved ?? 0) <= 0 && (w.closesIn ?? 0) <= 0 && w.interestSaved <= 0) return null;
  return build('cut', best, cut, 0);
}
