export const LOAN_MODES = ['fixed_emi', 'interest_only', 'flexible', 'credit_card'] as const;
export type LoanMode = (typeof LOAN_MODES)[number];

export type RatePeriod = 'yearly' | 'monthly';
export type Compounding = 'simple_on_principal' | 'interest_on_interest';

export const LOAN_TYPES = [
  'bank',
  'nbfc',
  'gold',
  'vehicle',
  'kheti',
  'personal',
  'sekda',
  'friend',
  'credit_card',
  'other',
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const INCOME_TYPES = [
  'salary',
  'business',
  'commission',
  'bonus',
  'kheti',
  'rent',
  'freelance',
  'deal',
  'other',
] as const;
export type IncomeType = (typeof INCOME_TYPES)[number];

export const CADENCES = ['monthly_fixed', 'irregular', 'one_time'] as const;
export type Cadence = (typeof CADENCES)[number];

export const PAY_METHODS = ['upi', 'cash', 'card', 'bank_transfer', 'other'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

export const REASON_KEYS = [
  'reason.highRate',
  'reason.dueSoon',
  'reason.overdue',
  'reason.smallWin',
  'reason.failedPurpose',
  'reason.creditCard',
  'reason.minimumDue',
] as const;
export type ReasonKey = (typeof REASON_KEYS)[number];

export interface LoanRow {
  id: number;
  name: string;
  lender: string | null;
  type: LoanType;
  purpose: string | null;
  purpose_regret: 0 | 1;
  mode: LoanMode;
  principal_total: number;
  principal_remaining: number;
  interest_rate: number;
  rate_period: RatePeriod;
  compounding: Compounding;
  emi_amount: number | null;
  emi_day: number | null;
  flexible_months: number | null;
  card_minimum_due: number | null;
  due_date: string | null;
  status: 'active' | 'closed';
  created_at: string;
  closed_at: string | null;
}

export interface PaymentRow {
  id: number;
  loan_id: number;
  amount: number;
  interest_part: number;
  principal_part: number;
  paid_at: string;
  note: string | null;
}

export interface PersonRow {
  id: number;
  name: string;
  is_self: 0 | 1;
}

export interface IncomeSourceRow {
  id: number;
  person_id: number;
  name: string;
  type: IncomeType;
  cadence: Cadence;
  expected_day: number | null;
  expected_amount: number | null;
}

export interface IncomeEventRow {
  id: number;
  source_id: number | null;
  person_id: number;
  amount: number;
  occurred_on: string;
  note: string | null;
}

export interface ExpenseCategoryRow {
  id: number;
  name: string | null;
  name_key: string | null;
  is_fixed: 0 | 1;
  sort: number;
}

export interface BudgetRow {
  id: number;
  month: string;
  category_id: number;
  limit_amount: number;
}

export interface ExpenseRow {
  id: number;
  category_id: number;
  amount: number;
  pay_method: PayMethod;
  occurred_on: string;
  note: string | null;
}

export function activeLoans(loans: LoanRow[]): LoanRow[] {
  return loans.filter((l) => l.status === 'active' && l.principal_remaining > 0);
}
