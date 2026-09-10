import type { LoanRow } from './types';

export function monthlyRate(loan: LoanRow): number {
  const r = loan.interest_rate / 100;
  return loan.rate_period === 'yearly' ? r / 12 : r;
}

export function annualPct(loan: LoanRow): number {
  return loan.rate_period === 'yearly' ? loan.interest_rate : loan.interest_rate * 12;
}

/** Interest charged on this loan for one month at its current balance. */
export function interestDue(loan: LoanRow): number {
  return loan.principal_remaining * monthlyRate(loan);
}

/**
 * Apply one payment to a loan: interest first, remainder to principal.
 * `interest_on_interest` (compound): unpaid interest is added to the balance.
 * `simple_on_principal` (sekda): unpaid interest is never added to balance.
 */
export function stepPayment(
  loan: LoanRow,
  payment: number,
  unpaidInterestCarry = 0,
): {
  interestPart: number;
  principalPart: number;
  newPrincipalRemaining: number;
  carriedUnpaid: number;
} {
  const due = interestDue(loan) + unpaidInterestCarry;
  const interestPart = Math.min(payment, due);
  const principalPart = Math.min(loan.principal_remaining, payment - interestPart);
  const unpaid = due - interestPart;
  const carried = unpaid > 0 && loan.compounding === 'interest_on_interest' ? unpaid : 0;
  return {
    interestPart,
    principalPart,
    newPrincipalRemaining: Math.max(0, loan.principal_remaining - principalPart),
    carriedUnpaid: carried,
  };
}

export function baselinePayment(loan: LoanRow): number {
  if (loan.mode === 'fixed_emi' && loan.emi_amount) return loan.emi_amount;
  if (loan.mode === 'credit_card') {
    return loan.card_minimum_due ?? Math.round(loan.principal_remaining * 0.05);
  }
  return Math.round(interestDue(loan));
}

export interface PayoffResult {
  months: number | null;
  totalInterest: number;
}

/** Simulate fixed monthly payments until zero balance. null = never (payment too low). */
export function projectPayoff(loan: LoanRow, monthlyPayment: number, cap = 360): PayoffResult {
  if (loan.principal_remaining <= 0) return { months: 0, totalInterest: 0 };
  if (monthlyPayment <= 0) return { months: null, totalInterest: 0 };
  let sim: LoanRow = { ...loan };
  let carry = 0;
  let interest = 0;
  for (let m = 1; m <= cap; m++) {
    const res = stepPayment(sim, monthlyPayment, carry);
    interest += res.interestPart;
    carry = res.carriedUnpaid;
    sim = { ...sim, principal_remaining: res.newPrincipalRemaining };
    if (sim.principal_remaining <= 0 && carry <= 0) {
      return { months: m, totalInterest: Math.round(interest) };
    }
  }
  return { months: null, totalInterest: Math.round(interest) };
}

/** One-time extra payment impact vs paying baseline EMI only (over a 360-month horizon). */
export interface ExtraImpact {
  monthsSaved: number | null;
  interestSaved: number;
}

export function interestSavedWithExtra(loan: LoanRow, extra: number): ExtraImpact {
  const base = baselinePayment(loan);
  const without = projectPayoff(loan, base);
  const withExtraLoan: LoanRow = {
    ...loan,
    principal_remaining: Math.max(0, loan.principal_remaining - extra),
  };
  const withExtra = projectPayoff(withExtraLoan, base);
  let monthsSaved: number | null = null;
  if (without.months !== null && withExtra.months !== null) {
    monthsSaved = Math.max(0, without.months - withExtra.months);
  }
  return { monthsSaved, interestSaved: Math.max(0, without.totalInterest - withExtra.totalInterest) };
}

/** How much monthly interest drops if `extra` is applied to principal right now. */
export function monthlyInterestDrop(loan: LoanRow, extra: number): number {
  return Math.round(extra * monthlyRate(loan));
}

/** Estimate credit-card cost if only minimum is paid on the bill. */
export function cardMinOnlyMonths(loan: LoanRow): PayoffResult {
  return projectPayoff(loan, loan.card_minimum_due ?? Math.round(loan.principal_remaining * 0.05));
}
