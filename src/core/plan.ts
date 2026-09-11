import { addMonths, isoDate, monthOf } from './dates';
import { interestDue } from './interest';
import { rankLoans } from './priority';
import { activeLoans, type LoanRow } from './types';

export interface PlanLoanRow {
  loanId: number;
  name: string;
  startBalance: number;
  payoffMonth: number | null;
  interestPaid: number;
  principalPaid: number;
}

export interface MonthSlice {
  month: string; // YYYY-MM
  payments: { loanId: number; amount: number }[];
  /** total debt (all loans) remaining at the end of this month */
  totalRemaining: number;
}

export interface PlanResult {
  months: MonthSlice[];
  rows: PlanLoanRow[];
  totalInterest: number;
  clearedCount: number;
  totalCount: number;
  cappedAt: number;
}

/**
 * Simulate `horizon` months of repayment.
 * Each month: pay unavoidable amounts (EMI / card minimum / accrued interest),
 * surplus goes to loans by AI priority rank. Optionally, payments of closed
 * loans get redirected to the next ranked loan.
 */
export function buildPlan(
  loans: LoanRow[],
  monthlyAvailable: number,
  opts: { redirectFreedEmis?: boolean; horizon?: number; todayIso?: string } = {},
): PlanResult {
  const horizon = opts.horizon ?? 12;
  const today = opts.todayIso ?? isoDate();
  const order = rankLoans(loans, today).map((r) => r.loan.id);
  const state = new Map<number, LoanRow>();
  for (const l of activeLoans(loans)) state.set(l.id, { ...l });
  const stats = new Map<number, PlanLoanRow>();
  for (const l of state.values()) {
    stats.set(l.id, {
      loanId: l.id,
      name: l.name,
      startBalance: l.principal_remaining,
      payoffMonth: null,
      interestPaid: 0,
      principalPaid: 0,
    });
  }
  const freedPool = { amount: 0 };
  const months: MonthSlice[] = [];

  for (let m = 1; m <= horizon; m++) {
    let pool = monthlyAvailable + freedPool.amount;
    const payments: { loanId: number; amount: number }[] = [];
    const rankedOrder: LoanRow[] = [];
    for (const id of order) {
      const l = state.get(id);
      if (l && l.principal_remaining > 0) rankedOrder.push(l);
    }
    // 1) unavoidable: EMI / card minimum / interest accrual (protect credit)
    for (const loan of rankedOrder) {
      if (pool <= 0) break;
      let need = 0;
      if (loan.mode === 'fixed_emi' && loan.emi_amount) need = loan.emi_amount;
      else if (loan.mode === 'credit_card')
        need = loan.card_minimum_due ?? Math.round(loan.principal_remaining * 0.05);
      else if (loan.mode === 'interest_only') need = Math.round(interestDue(loan));
      const pay = Math.min(pool, need);
      if (pay > 0) {
        applyPayment(state, stats, loan, pay);
        pool -= pay;
        payments.push({ loanId: loan.id, amount: pay });
        if (loan.principal_remaining <= 0) {
          stats.get(loan.id)!.payoffMonth = m;
          if (opts.redirectFreedEmis && loan.emi_amount) freedPool.amount += loan.emi_amount;
        }
      }
    }
    // 2) surplus → top of priority list
    if (pool > 0) {
      const first = rankedOrder.find((l) => l.principal_remaining > 0);
      if (first) {
        const pay = Math.min(pool, first.principal_remaining);
        if (pay > 0) {
          applyPayment(state, stats, first, pay);
          payments.push({ loanId: first.id, amount: pay });
          if (first.principal_remaining <= 0) {
            stats.get(first.id)!.payoffMonth = m;
            if (opts.redirectFreedEmis && first.emi_amount) freedPool.amount += first.emi_amount;
          }
        }
      }
    }
    months.push({
      month: monthOf(addMonths(today, m)),
      payments,
      totalRemaining: [...state.values()].reduce((s, l) => s + l.principal_remaining, 0),
    });
  }

  const rows = [...stats.values()];
  for (const r of rows) {
    const l = state.get(r.loanId);
    if (l && l.principal_remaining <= 0 && r.payoffMonth === null) r.payoffMonth = horizon;
  }
  return {
    months,
    rows: rows.sort((a, b) => (a.payoffMonth ?? 999) - (b.payoffMonth ?? 999)),
    totalInterest: Math.round(rows.reduce((s, r) => s + r.interestPaid, 0)),
    clearedCount: rows.filter((r) => r.payoffMonth !== null).length,
    totalCount: rows.length,
    cappedAt: horizon,
  };
}

function applyPayment(
  state: Map<number, LoanRow>,
  stats: Map<number, PlanLoanRow>,
  loanRef: LoanRow,
  amount: number,
) {
  const loan = state.get(loanRef.id);
  if (!loan) return;
  const due = interestDue(loan);
  const interestPart = Math.min(amount, due);
  const principalPart = Math.min(loan.principal_remaining, amount - interestPart);
  if (
    interestPart === 0 &&
    loan.compounding === 'interest_on_interest' &&
    loan.mode === 'credit_card'
  ) {
    loan.principal_remaining = loan.principal_remaining + due - 0;
  } else if (interestPart < due && loan.compounding === 'interest_on_interest') {
    loan.principal_remaining += due - interestPart;
  }
  loan.principal_remaining = Math.max(0, loan.principal_remaining - principalPart);
  const st = stats.get(loan.id);
  if (st) {
    st.interestPaid += interestPart;
    st.principalPaid += principalPart;
  }
  loanRef.principal_remaining = loan.principal_remaining;
}
